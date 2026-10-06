import type { PoolClient, QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { OccurrenceStatus, RiskLevel } from '../occurrences/occurrences.types.js';
import {
  editableEvaluationStatuses,
  evaluableStatuses,
  evaluationEditDeadline,
  isEvaluationEditable,
  shouldContest,
  type EvaluationPolicy,
} from './evaluation-policy.js';
import type {
  CalculatePriority,
  CreateEvaluationData,
  CreateEvaluationResult,
  EvaluationListResult,
  EvaluationOccurrence,
  EvaluationRecord,
  EvaluationSummaryRecord,
  EvaluationsRepository,
  EvaluationVisibility,
  UpdateEvaluationData,
  UpdateEvaluationResult,
} from './evaluations.types.js';

interface EvaluationOccurrenceRow extends QueryResultRow {
  id: string;
  protocol: string;
  created_by: string;
  municipality_id: string;
  status: OccurrenceStatus;
  confirmation_count: number;
  priority_score: string;
  severity: number | null;
  risk_level: RiskLevel | null;
  first_reported_at: Date;
}

interface EvaluationRow extends QueryResultRow {
  id: string;
  occurrence_id: string;
  user_id: string;
  rating: number;
  problem_resolved: boolean;
  service_quality: number | null;
  comment: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SummaryRow extends QueryResultRow {
  occurrence_id: string;
  occurrence_status: OccurrenceStatus;
  total: number;
  negative_count: number;
  average_rating: string | null;
  average_service_quality: string | null;
}

const evaluationColumns = `
  id, occurrence_id, user_id, rating, problem_resolved, service_quality,
  comment, created_at, updated_at
`;

function mapOccurrence(row: EvaluationOccurrenceRow): EvaluationOccurrence {
  return {
    id: row.id,
    protocol: row.protocol,
    createdBy: row.created_by,
    municipalityId: row.municipality_id,
    status: row.status,
    confirmationCount: row.confirmation_count,
    priorityScore: Number(row.priority_score),
    severity: row.severity,
    riskLevel: row.risk_level,
    firstReportedAt: row.first_reported_at,
  };
}

function mapEvaluation(row: EvaluationRow): EvaluationRecord {
  return {
    id: row.id,
    occurrenceId: row.occurrence_id,
    userId: row.user_id,
    rating: row.rating,
    problemResolved: row.problem_resolved,
    serviceQuality: row.service_quality,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSummary(row: SummaryRow): EvaluationSummaryRecord {
  return {
    occurrenceId: row.occurrence_id,
    occurrenceStatus: row.occurrence_status,
    total: row.total,
    negativeCount: row.negative_count,
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
    averageServiceQuality:
      row.average_service_quality === null ? null : Number(row.average_service_quality),
  };
}

async function lockOccurrence(
  client: PoolClient,
  occurrenceId: string,
): Promise<EvaluationOccurrenceRow | undefined> {
  const result = await client.query<EvaluationOccurrenceRow>(
    `SELECT id, protocol, created_by, municipality_id, status, confirmation_count,
            priority_score, severity, risk_level, first_reported_at
       FROM occurrences
      WHERE id = $1 AND deleted_at IS NULL
      FOR UPDATE`,
    [occurrenceId],
  );
  return result.rows[0];
}

async function isRelatedUser(
  client: PoolClient,
  occurrence: EvaluationOccurrence,
  userId: string,
): Promise<boolean> {
  if (occurrence.createdBy === userId) return true;
  const result = await client.query(
    `SELECT 1
       WHERE EXISTS (
         SELECT 1 FROM occurrence_reports
          WHERE occurrence_id = $1 AND reported_by = $2
       ) OR EXISTS (
         SELECT 1 FROM occurrence_confirmations
          WHERE occurrence_id = $1 AND user_id = $2
       )`,
    [occurrence.id, userId],
  );
  return result.rowCount === 1;
}

async function sourceSummary(
  client: PoolClient,
  occurrenceId: string,
): Promise<EvaluationSummaryRecord> {
  const result = await client.query<SummaryRow>(
    `SELECT o.id AS occurrence_id, o.status AS occurrence_status,
            COUNT(e.id)::integer AS total,
            COUNT(e.id) FILTER (WHERE e.problem_resolved = FALSE)::integer AS negative_count,
            ROUND(AVG(e.rating)::numeric, 2)::text AS average_rating,
            ROUND(AVG(e.service_quality)::numeric, 2)::text AS average_service_quality
       FROM occurrences o
       LEFT JOIN repair_evaluations e ON e.occurrence_id = o.id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      GROUP BY o.id, o.status`,
    [occurrenceId],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error('Falha ao resumir avaliacoes da ocorrencia.');
  return mapSummary(row);
}

async function insertAudit(
  client: PoolClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  previousData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  context: RequestContext,
  now: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (
       user_id, action, entity_type, entity_id, previous_data, new_data,
       ip_address, user_agent, created_at
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)`,
    [
      actorId,
      action,
      entityType,
      entityId,
      previousData === null ? null : JSON.stringify(previousData),
      newData === null ? null : JSON.stringify(newData),
      context.ipAddress,
      context.userAgent,
      now,
    ],
  );
}

async function acknowledgeEvaluation(
  client: PoolClient,
  userId: string,
  occurrence: EvaluationOccurrence,
  updated: boolean,
  now: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO notifications (
       user_id, type, title, message, entity_type, entity_id, created_at
     ) VALUES ($1, 'SYSTEM', $2, $3, 'occurrence', $4, $5)`,
    [
      userId,
      updated ? 'Avaliacao atualizada' : 'Avaliacao registrada',
      `Sua avaliacao da ocorrencia ${occurrence.protocol} foi ${updated ? 'atualizada' : 'registrada'}.`,
      occurrence.id,
      now,
    ],
  );
}

async function notifyContestation(
  client: PoolClient,
  occurrence: EvaluationOccurrence,
  now: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO notifications (
       user_id, type, title, message, entity_type, entity_id, created_at
     )
     SELECT targets.user_id, 'STATUS_CHANGED', 'Ocorrencia contestada',
            $2, 'occurrence', $1, $3
       FROM (
         SELECT created_by AS user_id FROM occurrences WHERE id = $1
         UNION SELECT reported_by FROM occurrence_reports WHERE occurrence_id = $1
         UNION SELECT user_id FROM occurrence_confirmations WHERE occurrence_id = $1
         UNION
         SELECT id FROM users
          WHERE deleted_at IS NULL AND status = 'ACTIVE'
            AND (
              role IN ('MODERATOR', 'ADMIN')
              OR (role = 'CITY_OPERATOR' AND municipality_id = $4)
            )
       ) targets`,
    [
      occurrence.id,
      `A ocorrencia ${occurrence.protocol} foi contestada automaticamente pelas avaliacoes.`,
      now,
      occurrence.municipalityId,
    ],
  );
}

async function contestIfNeeded(
  client: PoolClient,
  occurrence: EvaluationOccurrence,
  summary: EvaluationSummaryRecord,
  actorId: string,
  context: RequestContext,
  now: Date,
  policy: EvaluationPolicy,
  calculatePriority: CalculatePriority,
): Promise<boolean> {
  if (
    !evaluableStatuses.includes(occurrence.status) ||
    !shouldContest(summary.total, summary.negativeCount, policy)
  ) {
    return false;
  }
  const priorityScore = calculatePriority({
    confirmationCount: occurrence.confirmationCount,
    severity: occurrence.severity,
    riskLevel: occurrence.riskLevel,
    firstReportedAt: occurrence.firstReportedAt,
    calculatedAt: now,
  });
  const reason = `Contestacao automatica: ${summary.negativeCount} de ${summary.total} avaliacoes indicam problema nao resolvido.`;
  await client.query(
    `UPDATE occurrences
        SET status = 'CONTESTED', resolved_at = NULL, resolved_by = NULL,
            closed_at = NULL, closed_by = NULL, priority_score = $2, updated_at = $3
      WHERE id = $1`,
    [occurrence.id, priorityScore, now],
  );
  await client.query(
    `INSERT INTO occurrence_status_history (
       occurrence_id, previous_status, new_status, changed_by, reason,
       public_message, created_at
     ) VALUES ($1, $2, 'CONTESTED', $3, $4, $5, $6)`,
    [
      occurrence.id,
      occurrence.status,
      actorId,
      reason,
      'A ocorrencia foi reaberta para revisao apos avaliacoes dos cidadaos.',
      now,
    ],
  );
  await insertAudit(
    client,
    actorId,
    'OCCURRENCE_AUTOMATICALLY_CONTESTED',
    'occurrence',
    occurrence.id,
    { status: occurrence.status, priorityScore: occurrence.priorityScore },
    {
      status: 'CONTESTED',
      priorityScore,
      evaluationCount: summary.total,
      negativeEvaluationCount: summary.negativeCount,
      negativeThreshold: policy.negativeThreshold,
    },
    context,
    now,
  );
  await notifyContestation(client, occurrence, now);
  return true;
}

function evaluationAuditData(evaluation: EvaluationRecord): Record<string, unknown> {
  return {
    rating: evaluation.rating,
    problemResolved: evaluation.problemResolved,
    serviceQuality: evaluation.serviceQuality,
    comment: evaluation.comment,
  };
}

export class PostgresEvaluationsRepository implements EvaluationsRepository {
  public async create(
    data: CreateEvaluationData,
    policy: EvaluationPolicy,
    calculatePriority: CalculatePriority,
  ): Promise<CreateEvaluationResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const occurrenceRow = await lockOccurrence(client, data.occurrenceId);
      if (occurrenceRow === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'occurrence_not_found' };
      }
      const occurrence = mapOccurrence(occurrenceRow);
      if (!evaluableStatuses.includes(occurrence.status)) {
        await client.query('ROLLBACK');
        return { kind: 'status_not_evaluable', status: occurrence.status };
      }
      if (!(await isRelatedUser(client, occurrence, data.userId))) {
        await client.query('ROLLBACK');
        return { kind: 'user_not_related' };
      }
      const inserted = await client.query<EvaluationRow>(
        `INSERT INTO repair_evaluations (
           occurrence_id, user_id, rating, problem_resolved, service_quality,
           comment, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT (occurrence_id, user_id) DO NOTHING
         RETURNING ${evaluationColumns}`,
        [
          occurrence.id,
          data.userId,
          data.input.rating,
          data.input.problemResolved,
          data.input.serviceQuality,
          data.input.comment,
          data.now,
        ],
      );
      const row = inserted.rows[0];
      if (row === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'duplicate' };
      }
      const evaluation = mapEvaluation(row);
      const summary = await sourceSummary(client, occurrence.id);
      await insertAudit(
        client,
        data.userId,
        'REPAIR_EVALUATION_CREATED',
        'repair_evaluation',
        evaluation.id,
        null,
        evaluationAuditData(evaluation),
        data.context,
        data.now,
      );
      await acknowledgeEvaluation(client, data.userId, occurrence, false, data.now);
      const occurrenceContested = await contestIfNeeded(
        client,
        occurrence,
        summary,
        data.userId,
        data.context,
        data.now,
        policy,
        calculatePriority,
      );
      await client.query('COMMIT');
      return {
        kind: 'created',
        evaluation,
        summary: occurrenceContested ? { ...summary, occurrenceStatus: 'CONTESTED' } : summary,
        occurrenceContested,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async update(
    data: UpdateEvaluationData,
    policy: EvaluationPolicy,
    calculatePriority: CalculatePriority,
  ): Promise<UpdateEvaluationResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const occurrenceRow = await lockOccurrence(client, data.occurrenceId);
      if (occurrenceRow === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'occurrence_not_found' };
      }
      const occurrence = mapOccurrence(occurrenceRow);
      if (!editableEvaluationStatuses.includes(occurrence.status)) {
        await client.query('ROLLBACK');
        return { kind: 'status_not_editable', status: occurrence.status };
      }
      const currentResult = await client.query<EvaluationRow>(
        `SELECT ${evaluationColumns}
           FROM repair_evaluations
          WHERE occurrence_id = $1 AND user_id = $2
          FOR UPDATE`,
        [occurrence.id, data.userId],
      );
      const currentRow = currentResult.rows[0];
      if (currentRow === undefined) {
        await client.query('ROLLBACK');
        return { kind: 'evaluation_not_found' };
      }
      const current = mapEvaluation(currentRow);
      if (!isEvaluationEditable(current.createdAt, data.now, policy.editWindowDays)) {
        await client.query('ROLLBACK');
        return {
          kind: 'edit_window_expired',
          deadline: evaluationEditDeadline(current.createdAt, policy.editWindowDays),
        };
      }
      const updatedResult = await client.query<EvaluationRow>(
        `UPDATE repair_evaluations
            SET rating = COALESCE($3, rating),
                problem_resolved = COALESCE($4, problem_resolved),
                service_quality = CASE WHEN $5 THEN $6 ELSE service_quality END,
                comment = CASE WHEN $7 THEN $8 ELSE comment END,
                updated_at = $9
          WHERE occurrence_id = $1 AND user_id = $2
          RETURNING ${evaluationColumns}`,
        [
          occurrence.id,
          data.userId,
          data.input.rating ?? null,
          data.input.problemResolved ?? null,
          Object.hasOwn(data.input, 'serviceQuality'),
          data.input.serviceQuality ?? null,
          Object.hasOwn(data.input, 'comment'),
          data.input.comment ?? null,
          data.now,
        ],
      );
      const updatedRow = updatedResult.rows[0];
      if (updatedRow === undefined) throw new Error('Falha ao atualizar avaliacao.');
      const evaluation = mapEvaluation(updatedRow);
      const summary = await sourceSummary(client, occurrence.id);
      await insertAudit(
        client,
        data.userId,
        'REPAIR_EVALUATION_UPDATED',
        'repair_evaluation',
        evaluation.id,
        evaluationAuditData(current),
        evaluationAuditData(evaluation),
        data.context,
        data.now,
      );
      await acknowledgeEvaluation(client, data.userId, occurrence, true, data.now);
      const occurrenceContested = await contestIfNeeded(
        client,
        occurrence,
        summary,
        data.userId,
        data.context,
        data.now,
        policy,
        calculatePriority,
      );
      await client.query('COMMIT');
      return {
        kind: 'updated',
        evaluation,
        summary: occurrenceContested ? { ...summary, occurrenceStatus: 'CONTESTED' } : summary,
        occurrenceContested,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async findVisibility(
    occurrenceId: string,
    userId?: string,
  ): Promise<EvaluationVisibility | null> {
    const result = await pool.query<
      QueryResultRow & {
        id: string;
        created_by: string;
        municipality_id: string;
        status: OccurrenceStatus;
        related_to_user: boolean;
      }
    >(
      `SELECT o.id, o.created_by, o.municipality_id, o.status,
              CASE WHEN $2::uuid IS NULL THEN FALSE ELSE (
                o.created_by = $2::uuid
                OR EXISTS (
                  SELECT 1 FROM occurrence_reports r
                   WHERE r.occurrence_id = o.id AND r.reported_by = $2::uuid
                )
                OR EXISTS (
                  SELECT 1 FROM occurrence_confirmations c
                   WHERE c.occurrence_id = o.id AND c.user_id = $2::uuid
                )
              ) END AS related_to_user
         FROM occurrences o
        WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [occurrenceId, userId ?? null],
    );
    const row = result.rows[0];
    return row === undefined
      ? null
      : {
          id: row.id,
          createdBy: row.created_by,
          municipalityId: row.municipality_id,
          status: row.status,
          relatedToUser: row.related_to_user,
        };
  }

  public async findMine(occurrenceId: string, userId: string): Promise<EvaluationRecord | null> {
    const result = await pool.query<EvaluationRow>(
      `SELECT ${evaluationColumns} FROM repair_evaluations WHERE occurrence_id = $1 AND user_id = $2`,
      [occurrenceId, userId],
    );
    return result.rows[0] ? mapEvaluation(result.rows[0]) : null;
  }

  public async list(
    occurrenceId: string,
    offset: number,
    limit: number,
  ): Promise<EvaluationListResult> {
    const [itemsResult, countResult] = await Promise.all([
      pool.query<EvaluationRow>(
        `SELECT ${evaluationColumns}
           FROM repair_evaluations
          WHERE occurrence_id = $1
          ORDER BY created_at DESC, id DESC
          OFFSET $2 LIMIT $3`,
        [occurrenceId, offset, limit],
      ),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::integer AS total
           FROM repair_evaluations WHERE occurrence_id = $1`,
        [occurrenceId],
      ),
    ]);
    return {
      items: itemsResult.rows.map(mapEvaluation),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  public async summary(occurrenceId: string): Promise<EvaluationSummaryRecord | null> {
    const client = await pool.connect();
    try {
      return await sourceSummary(client, occurrenceId);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Falha ao resumir avaliacoes da ocorrencia.'
      ) {
        return null;
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
