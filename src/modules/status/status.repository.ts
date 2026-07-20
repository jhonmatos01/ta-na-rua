import type { PoolClient, QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { OccurrenceStatus, RiskLevel } from '../occurrences/occurrences.types.js';
import type {
  AssignmentData,
  AssignmentResult,
  LockedStatusOccurrence,
  PreparedStatusTransition,
  PrepareAssignment,
  PrepareStatusTransition,
  StatusHistoryRecord,
  StatusOccurrenceVisibility,
  StatusRepository,
  StatusTransitionData,
  StatusTransitionResult,
} from './status.types.js';

interface StatusOccurrenceRow extends QueryResultRow {
  id: string;
  protocol: string;
  created_by: string;
  municipality_id: string;
  status: OccurrenceStatus;
  assigned_department_id: string | null;
  assigned_by: string | null;
  assigned_at: Date | null;
  expected_resolution_at: Date | null;
  scheduled_for: Date | null;
  resolution_description: string | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  closed_at: Date | null;
  closed_by: string | null;
  duplicate_of_occurrence_id: string | null;
  confirmation_count: number;
  priority_score: string;
  severity: number | null;
  risk_level: RiskLevel | null;
  first_reported_at: Date;
}

const statusOccurrenceColumns = `
  id, protocol, created_by, municipality_id, status,
  assigned_department_id, assigned_by, assigned_at, expected_resolution_at,
  scheduled_for, resolution_description, resolved_at, resolved_by,
  closed_at, closed_by, duplicate_of_occurrence_id, confirmation_count,
  priority_score, severity, risk_level, first_reported_at
`;

function mapOccurrence(row: StatusOccurrenceRow): LockedStatusOccurrence {
  return {
    id: row.id,
    protocol: row.protocol,
    createdBy: row.created_by,
    municipalityId: row.municipality_id,
    status: row.status,
    assignedDepartmentId: row.assigned_department_id,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    expectedResolutionAt: row.expected_resolution_at,
    scheduledFor: row.scheduled_for,
    resolutionDescription: row.resolution_description,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    duplicateOfOccurrenceId: row.duplicate_of_occurrence_id,
    confirmationCount: row.confirmation_count,
    priorityScore: Number(row.priority_score),
    severity: row.severity,
    riskLevel: row.risk_level,
    firstReportedAt: row.first_reported_at,
  };
}

async function lockOccurrence(
  client: PoolClient,
  occurrenceId: string,
): Promise<StatusOccurrenceRow | undefined> {
  const result = await client.query<StatusOccurrenceRow>(
    `SELECT ${statusOccurrenceColumns}
       FROM occurrences
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE`,
    [occurrenceId],
  );
  return result.rows[0];
}

async function validDepartment(
  client: PoolClient,
  departmentId: string,
  municipalityId: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM departments
      WHERE id = $1 AND municipality_id = $2 AND active = TRUE`,
    [departmentId, municipalityId],
  );
  return result.rowCount === 1;
}

async function validDuplicateTarget(
  client: PoolClient,
  targetId: string,
  occurrence: LockedStatusOccurrence,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM occurrences
      WHERE id = $1 AND id <> $2 AND municipality_id = $3 AND deleted_at IS NULL
        AND status NOT IN ('REJECTED', 'DUPLICATE', 'CLOSED')`,
    [targetId, occurrence.id, occurrence.municipalityId],
  );
  return result.rowCount === 1;
}

async function insertAudit(
  client: PoolClient,
  actorId: string,
  action: string,
  occurrenceId: string,
  previousData: Record<string, unknown>,
  newData: Record<string, unknown>,
  context: RequestContext,
  now: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (
       user_id, action, entity_type, entity_id, previous_data, new_data,
       ip_address, user_agent, created_at
     ) VALUES ($1, $2, 'occurrence', $3, $4::jsonb, $5::jsonb, $6, $7, $8)`,
    [
      actorId,
      action,
      occurrenceId,
      JSON.stringify(previousData),
      JSON.stringify(newData),
      context.ipAddress,
      context.userAgent,
      now,
    ],
  );
}

async function notifyRelated(
  client: PoolClient,
  occurrence: LockedStatusOccurrence,
  title: string,
  message: string,
  now: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO notifications (
       user_id, type, title, message, entity_type, entity_id, created_at
     )
     SELECT related.user_id, 'STATUS_CHANGED', $2, $3, 'occurrence', $1, $4
       FROM (
         SELECT created_by AS user_id FROM occurrences WHERE id = $1
         UNION SELECT reported_by FROM occurrence_reports WHERE occurrence_id = $1
         UNION SELECT user_id FROM occurrence_confirmations WHERE occurrence_id = $1
       ) related`,
    [occurrence.id, title, message, now],
  );
}

async function enqueueOutbox(
  client: PoolClient,
  eventType: string,
  occurrence: LockedStatusOccurrence,
  payload: Record<string, unknown>,
  now: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO outbox_events (
       event_type, entity_type, entity_id, payload, status, available_at, created_at
     ) VALUES ($1, 'occurrence', $2, $3::jsonb, 'PENDING', $4, $4)`,
    [
      eventType,
      occurrence.id,
      JSON.stringify({
        occurrenceId: occurrence.id,
        protocol: occurrence.protocol,
        municipalityId: occurrence.municipalityId,
        ...payload,
      }),
      now,
    ],
  );
}

async function updateTransition(
  client: PoolClient,
  occurrenceId: string,
  prepared: PreparedStatusTransition,
  now: Date,
): Promise<StatusOccurrenceRow> {
  const result = await client.query<StatusOccurrenceRow>(
    `UPDATE occurrences
        SET status = $2,
            assigned_department_id = $3, assigned_by = $4, assigned_at = $5,
            expected_resolution_at = $6, scheduled_for = $7,
            resolution_description = $8, resolved_at = $9, resolved_by = $10,
            closed_at = $11, closed_by = $12, duplicate_of_occurrence_id = $13,
            priority_score = $14, updated_at = $15
      WHERE id = $1
      RETURNING ${statusOccurrenceColumns}`,
    [
      occurrenceId,
      prepared.status,
      prepared.assignedDepartmentId,
      prepared.assignedBy,
      prepared.assignedAt,
      prepared.expectedResolutionAt,
      prepared.scheduledFor,
      prepared.resolutionDescription,
      prepared.resolvedAt,
      prepared.resolvedBy,
      prepared.closedAt,
      prepared.closedBy,
      prepared.duplicateOfOccurrenceId,
      prepared.priorityScore,
      now,
    ],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error('Falha ao atualizar status da ocorrencia.');
  return row;
}

export class PostgresStatusRepository implements StatusRepository {
  public async transition(
    data: StatusTransitionData,
    prepare: PrepareStatusTransition,
  ): Promise<StatusTransitionResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await lockOccurrence(client, data.occurrenceId);
      if (row === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'occurrence_not_found' };
      }
      const occurrence = mapOccurrence(row);
      const prepared = prepare(occurrence);
      if (
        prepared.assignedDepartmentId !== null &&
        !(await validDepartment(client, prepared.assignedDepartmentId, occurrence.municipalityId))
      ) {
        await client.query('ROLLBACK');
        return { kind: 'department_not_found' };
      }
      if (
        prepared.duplicateOfOccurrenceId !== null &&
        !(await validDuplicateTarget(client, prepared.duplicateOfOccurrenceId, occurrence))
      ) {
        await client.query('ROLLBACK');
        return { kind: 'duplicate_target_invalid' };
      }
      const updatedRow = await updateTransition(client, occurrence.id, prepared, data.now);
      await client.query(
        `INSERT INTO occurrence_status_history (
           occurrence_id, previous_status, new_status, changed_by, reason,
           public_message, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          occurrence.id,
          occurrence.status,
          prepared.status,
          data.actorId,
          data.input.reason ?? null,
          data.input.publicMessage ?? null,
          data.now,
        ],
      );
      await insertAudit(
        client,
        data.actorId,
        'OCCURRENCE_STATUS_CHANGED',
        occurrence.id,
        {
          status: occurrence.status,
          assignedDepartmentId: occurrence.assignedDepartmentId,
          expectedResolutionAt: occurrence.expectedResolutionAt,
          scheduledFor: occurrence.scheduledFor,
          duplicateOfOccurrenceId: occurrence.duplicateOfOccurrenceId,
        },
        {
          status: prepared.status,
          assignedDepartmentId: prepared.assignedDepartmentId,
          expectedResolutionAt: prepared.expectedResolutionAt,
          scheduledFor: prepared.scheduledFor,
          duplicateOfOccurrenceId: prepared.duplicateOfOccurrenceId,
          reason: data.input.reason ?? null,
        },
        data.context,
        data.now,
      );
      await notifyRelated(
        client,
        occurrence,
        'Status da ocorrencia atualizado',
        data.input.publicMessage ??
          `A ocorrencia ${occurrence.protocol} mudou de ${occurrence.status} para ${prepared.status}.`,
        data.now,
      );
      await enqueueOutbox(
        client,
        'OCCURRENCE_STATUS_CHANGED',
        occurrence,
        {
          previousStatus: occurrence.status,
          status: prepared.status,
          publicMessage: data.input.publicMessage ?? null,
          changedAt: data.now.toISOString(),
        },
        data.now,
      );
      await client.query('COMMIT');
      return { kind: 'updated', occurrence: mapOccurrence(updatedRow) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async assign(data: AssignmentData, prepare: PrepareAssignment): Promise<AssignmentResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await lockOccurrence(client, data.occurrenceId);
      if (row === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'occurrence_not_found' };
      }
      const occurrence = mapOccurrence(row);
      const prepared = prepare(occurrence);
      if (!(await validDepartment(client, prepared.departmentId, occurrence.municipalityId))) {
        await client.query('ROLLBACK');
        return { kind: 'department_not_found' };
      }
      const result = await client.query<StatusOccurrenceRow>(
        `UPDATE occurrences
            SET assigned_department_id = $2, assigned_by = $3, assigned_at = $4,
                expected_resolution_at = $5, updated_at = $4
          WHERE id = $1
          RETURNING ${statusOccurrenceColumns}`,
        [
          occurrence.id,
          prepared.departmentId,
          data.actorId,
          data.now,
          prepared.expectedResolutionAt,
        ],
      );
      const updated = result.rows[0];
      if (updated === undefined) throw new Error('Falha ao atribuir departamento.');
      await insertAudit(
        client,
        data.actorId,
        occurrence.assignedDepartmentId === null
          ? 'OCCURRENCE_DEPARTMENT_ASSIGNED'
          : 'OCCURRENCE_ASSIGNMENT_UPDATED',
        occurrence.id,
        {
          assignedDepartmentId: occurrence.assignedDepartmentId,
          expectedResolutionAt: occurrence.expectedResolutionAt,
        },
        {
          assignedDepartmentId: prepared.departmentId,
          expectedResolutionAt: prepared.expectedResolutionAt,
          reason: data.input.reason ?? null,
        },
        data.context,
        data.now,
      );
      await notifyRelated(
        client,
        occurrence,
        'Atendimento municipal atualizado',
        data.input.publicMessage ??
          `A ocorrencia ${occurrence.protocol} recebeu uma atualizacao de atendimento.`,
        data.now,
      );
      await enqueueOutbox(
        client,
        'OCCURRENCE_ASSIGNMENT_UPDATED',
        occurrence,
        {
          departmentId: prepared.departmentId,
          expectedResolutionAt: prepared.expectedResolutionAt?.toISOString() ?? null,
          changedAt: data.now.toISOString(),
        },
        data.now,
      );
      await client.query('COMMIT');
      return { kind: 'updated', occurrence: mapOccurrence(updated) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async findVisibility(occurrenceId: string): Promise<StatusOccurrenceVisibility | null> {
    const result = await pool.query<
      QueryResultRow & {
        id: string;
        created_by: string;
        municipality_id: string;
        status: OccurrenceStatus;
      }
    >(
      `SELECT id, created_by, municipality_id, status
         FROM occurrences WHERE id = $1 AND deleted_at IS NULL`,
      [occurrenceId],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          id: row.id,
          createdBy: row.created_by,
          municipalityId: row.municipality_id,
          status: row.status,
        };
  }

  public async history(occurrenceId: string): Promise<StatusHistoryRecord[]> {
    const result = await pool.query<
      QueryResultRow & {
        id: string;
        previous_status: OccurrenceStatus | null;
        new_status: OccurrenceStatus;
        reason: string | null;
        public_message: string | null;
        changed_by: string;
        created_at: Date;
      }
    >(
      `SELECT id, previous_status, new_status, reason, public_message, changed_by, created_at
         FROM occurrence_status_history
        WHERE occurrence_id = $1
        ORDER BY created_at ASC, id ASC`,
      [occurrenceId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      reason: row.reason,
      publicMessage: row.public_message,
      changedBy: row.changed_by,
      createdAt: row.created_at,
    }));
  }
}
