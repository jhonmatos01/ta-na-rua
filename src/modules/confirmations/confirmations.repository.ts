import type { PoolClient, QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { OccurrenceStatus, RiskLevel } from '../occurrences/occurrences.types.js';
import {
  confirmableOccurrenceStatuses,
  type AddConfirmationResult,
  type CalculatePriority,
  type ConfirmationRecord,
  type ConfirmationsRepository,
  type ConfirmationSummaryRecord,
  type CreateConfirmationData,
  type LockedOccurrence,
  type PriorityRecalculationResult,
  type RemoveConfirmationData,
  type RemoveConfirmationResult,
} from './confirmations.types.js';

interface LockedOccurrenceRow extends QueryResultRow {
  id: string;
  protocol: string;
  created_by: string;
  municipality_id: string;
  status: OccurrenceStatus;
  severity: number | null;
  risk_level: RiskLevel | null;
  first_reported_at: Date;
  confirmation_count: number;
  priority_score: string;
}

interface ConfirmationRow extends QueryResultRow {
  id: string;
  occurrence_id: string;
  directly_affected: boolean;
  problem_worsened: boolean;
  comment: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ConfirmationSummaryRow extends QueryResultRow {
  occurrence_id: string;
  protocol: string;
  created_by: string;
  municipality_id: string;
  status: OccurrenceStatus;
  confirmation_count: number;
  priority_score: string;
  confirmed_by_user: boolean;
}

function mapLockedOccurrence(row: LockedOccurrenceRow): LockedOccurrence {
  return {
    id: row.id,
    protocol: row.protocol,
    createdBy: row.created_by,
    municipalityId: row.municipality_id,
    status: row.status,
    severity: row.severity,
    riskLevel: row.risk_level,
    firstReportedAt: row.first_reported_at,
  };
}

function mapConfirmation(row: ConfirmationRow): ConfirmationRecord {
  return {
    id: row.id,
    occurrenceId: row.occurrence_id,
    directlyAffected: row.directly_affected,
    problemWorsened: row.problem_worsened,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function summary(
  occurrence: LockedOccurrence,
  confirmationCount: number,
  priorityScore: number,
  confirmedByUser: boolean,
): ConfirmationSummaryRecord {
  return {
    occurrenceId: occurrence.id,
    protocol: occurrence.protocol,
    createdBy: occurrence.createdBy,
    municipalityId: occurrence.municipalityId,
    status: occurrence.status,
    confirmationCount,
    priorityScore,
    confirmedByUser,
  };
}

async function lockOccurrence(
  client: PoolClient,
  occurrenceId: string,
): Promise<LockedOccurrenceRow | undefined> {
  const result = await client.query<LockedOccurrenceRow>(
    `SELECT id, protocol, created_by, municipality_id, status, severity, risk_level,
            first_reported_at, confirmation_count, priority_score
       FROM occurrences
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE`,
    [occurrenceId],
  );
  return result.rows[0];
}

async function sourceConfirmationCount(client: PoolClient, occurrenceId: string): Promise<number> {
  const result = await client.query<{ total: string }>(
    'SELECT COUNT(*)::text AS total FROM occurrence_confirmations WHERE occurrence_id = $1',
    [occurrenceId],
  );
  return Number(result.rows[0]?.total ?? 0);
}

async function updateCounters(
  client: PoolClient,
  occurrenceId: string,
  confirmationCount: number,
  priorityScore: number,
  now: Date,
): Promise<void> {
  await client.query(
    `UPDATE occurrences
        SET confirmation_count = $2, priority_score = $3, updated_at = $4
      WHERE id = $1`,
    [occurrenceId, confirmationCount, priorityScore, now],
  );
}

async function insertAudit(
  client: PoolClient,
  actorId: string,
  action: string,
  occurrenceId: string,
  context: RequestContext,
  previousData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
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
      previousData === null ? null : JSON.stringify(previousData),
      newData === null ? null : JSON.stringify(newData),
      context.ipAddress,
      context.userAgent,
      now,
    ],
  );
}

function priorityFor(
  occurrence: LockedOccurrence,
  confirmationCount: number,
  calculatedAt: Date,
  calculatePriority: CalculatePriority,
): number {
  return calculatePriority({
    confirmationCount,
    severity: occurrence.severity,
    riskLevel: occurrence.riskLevel,
    firstReportedAt: occurrence.firstReportedAt,
    calculatedAt,
  });
}

export class PostgresConfirmationsRepository implements ConfirmationsRepository {
  public async add(
    data: CreateConfirmationData,
    calculatePriority: CalculatePriority,
  ): Promise<AddConfirmationResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await lockOccurrence(client, data.occurrenceId);
      if (row === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'occurrence_not_found' };
      }
      if (!confirmableOccurrenceStatuses.includes(row.status)) {
        await client.query('ROLLBACK');
        return { kind: 'not_confirmable', status: row.status };
      }

      const inserted = await client.query<ConfirmationRow>(
        `INSERT INTO occurrence_confirmations (
           occurrence_id, user_id, directly_affected, problem_worsened, comment,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (occurrence_id, user_id) DO NOTHING
         RETURNING id, occurrence_id, directly_affected, problem_worsened, comment,
                   created_at, updated_at`,
        [
          data.occurrenceId,
          data.userId,
          data.input.directlyAffected,
          data.input.problemWorsened,
          data.input.comment,
          data.now,
        ],
      );
      const confirmationRow = inserted.rows[0];
      if (confirmationRow === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'duplicate' };
      }

      const occurrence = mapLockedOccurrence(row);
      const confirmationCount = await sourceConfirmationCount(client, data.occurrenceId);
      const priorityScore = priorityFor(occurrence, confirmationCount, data.now, calculatePriority);
      await updateCounters(client, data.occurrenceId, confirmationCount, priorityScore, data.now);
      await client.query(
        `INSERT INTO notifications (
           user_id, type, title, message, entity_type, entity_id, created_at
         ) VALUES ($1, 'OCCURRENCE_CONFIRMED', $2, $3, 'occurrence', $4, $5)`,
        [
          occurrence.createdBy,
          'Nova confirmacao na ocorrencia',
          `A ocorrencia ${occurrence.protocol} recebeu uma nova confirmacao.`,
          occurrence.id,
          data.now,
        ],
      );
      await insertAudit(
        client,
        data.userId,
        'OCCURRENCE_CONFIRMED',
        occurrence.id,
        data.context,
        null,
        {
          confirmationId: confirmationRow.id,
          confirmationCount,
          priorityScore,
          directlyAffected: data.input.directlyAffected,
          problemWorsened: data.input.problemWorsened,
        },
        data.now,
      );
      await client.query('COMMIT');

      return {
        kind: 'created',
        confirmation: mapConfirmation(confirmationRow),
        summary: summary(occurrence, confirmationCount, priorityScore, true),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async remove(
    data: RemoveConfirmationData,
    calculatePriority: CalculatePriority,
  ): Promise<RemoveConfirmationResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = await lockOccurrence(client, data.occurrenceId);
      if (row === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'occurrence_not_found' };
      }
      const removed = await client.query<ConfirmationRow>(
        `DELETE FROM occurrence_confirmations
          WHERE occurrence_id = $1 AND user_id = $2
          RETURNING id, occurrence_id, directly_affected, problem_worsened, comment,
                    created_at, updated_at`,
        [data.occurrenceId, data.userId],
      );
      const confirmation = removed.rows[0];
      if (confirmation === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'confirmation_not_found' };
      }

      const occurrence = mapLockedOccurrence(row);
      const confirmationCount = await sourceConfirmationCount(client, data.occurrenceId);
      const priorityScore = priorityFor(occurrence, confirmationCount, data.now, calculatePriority);
      await updateCounters(client, data.occurrenceId, confirmationCount, priorityScore, data.now);
      await insertAudit(
        client,
        data.userId,
        'OCCURRENCE_CONFIRMATION_REMOVED',
        occurrence.id,
        data.context,
        {
          confirmationId: confirmation.id,
          directlyAffected: confirmation.directly_affected,
          problemWorsened: confirmation.problem_worsened,
        },
        { confirmationCount, priorityScore },
        data.now,
      );
      await client.query('COMMIT');

      return {
        kind: 'removed',
        summary: summary(occurrence, confirmationCount, priorityScore, false),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async getSummary(
    occurrenceId: string,
    userId?: string,
  ): Promise<ConfirmationSummaryRecord | null> {
    const result = await pool.query<ConfirmationSummaryRow>(
      `SELECT o.id AS occurrence_id, o.protocol, o.created_by, o.municipality_id, o.status,
              o.confirmation_count, o.priority_score,
              CASE WHEN $2::uuid IS NULL THEN FALSE ELSE EXISTS (
                SELECT 1 FROM occurrence_confirmations oc
                 WHERE oc.occurrence_id = o.id AND oc.user_id = $2::uuid
              ) END AS confirmed_by_user
         FROM occurrences o
        WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [occurrenceId, userId ?? null],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return {
      occurrenceId: row.occurrence_id,
      protocol: row.protocol,
      createdBy: row.created_by,
      municipalityId: row.municipality_id,
      status: row.status,
      confirmationCount: row.confirmation_count,
      priorityScore: Number(row.priority_score),
      confirmedByUser: row.confirmed_by_user,
    };
  }

  public async recalculateAll(
    calculatedAt: Date,
    calculatePriority: CalculatePriority,
  ): Promise<PriorityRecalculationResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const occurrences = await client.query<LockedOccurrenceRow>(
        `SELECT id, protocol, created_by, municipality_id, status, severity, risk_level,
                first_reported_at, confirmation_count, priority_score
           FROM occurrences
          WHERE deleted_at IS NULL
          ORDER BY id
          FOR UPDATE`,
      );
      let correctedCounters = 0;
      for (const row of occurrences.rows) {
        const occurrence = mapLockedOccurrence(row);
        const confirmationCount = await sourceConfirmationCount(client, occurrence.id);
        const priorityScore = priorityFor(
          occurrence,
          confirmationCount,
          calculatedAt,
          calculatePriority,
        );
        if (row.confirmation_count !== confirmationCount) correctedCounters += 1;
        if (
          row.confirmation_count !== confirmationCount ||
          Number(row.priority_score) !== priorityScore
        ) {
          await updateCounters(
            client,
            occurrence.id,
            confirmationCount,
            priorityScore,
            calculatedAt,
          );
        }
      }
      await client.query('COMMIT');
      return { processed: occurrences.rowCount ?? 0, correctedCounters };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
