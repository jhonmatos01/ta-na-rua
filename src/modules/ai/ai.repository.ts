import type { PoolClient, QueryResultRow } from 'pg';

import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';
import { DefaultPriorityService, type PriorityService } from '../confirmations/priority.service.js';
import type { RiskLevel } from '../occurrences/occurrences.types.js';
import type {
  AiAnalysisContext,
  AiAnalysisRepository,
  AiCategoryOption,
  AiNearbyOccurrence,
  PersistAiAnalysisInput,
  PersistAiAnalysisResult,
} from './ai.types.js';

interface ContextRow extends QueryResultRow {
  occurrence_id: string;
  report_id: string;
  created_by: string;
  municipality_id: string;
  status: string;
  confirmation_count: number;
  first_reported_at: Date;
  image_url: string;
  description: string;
  latitude: string;
  longitude: string;
}

interface CategoryRow extends QueryResultRow {
  id: string;
  code: string;
  name: string;
}

interface NearbyRow extends QueryResultRow {
  id: string;
  category: string | null;
  distance_meters: string;
  description: string;
  image_urls: unknown;
}

interface PriorityRow extends QueryResultRow {
  confirmation_count: number;
  severity: number | null;
  risk_level: RiskLevel | null;
  first_reported_at: Date;
}

function mapImageUrls(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

async function lockOccurrence(
  client: PoolClient,
  occurrenceId: string,
): Promise<{ status: string; createdBy: string } | null> {
  const result = await client.query<{ status: string; created_by: string }>(
    `SELECT status, created_by
     FROM occurrences
     WHERE id = $1 AND deleted_at IS NULL
     FOR UPDATE`,
    [occurrenceId],
  );
  const row = result.rows[0];
  return row === undefined ? null : { status: row.status, createdBy: row.created_by };
}

export class PostgresAiAnalysisRepository implements AiAnalysisRepository {
  public constructor(
    private readonly priorityService: PriorityService = new DefaultPriorityService(),
  ) {}

  public async loadContext(occurrenceId: string): Promise<AiAnalysisContext | null> {
    const contextResult = await pool.query<ContextRow>(
      `SELECT
         o.id AS occurrence_id,
         r.id AS report_id,
         o.created_by,
         o.municipality_id,
         o.status,
         o.confirmation_count,
         o.first_reported_at,
         i.file_url AS image_url,
         r.original_description AS description,
         r.latitude,
         r.longitude
       FROM occurrences o
       JOIN LATERAL (
         SELECT id, original_description, latitude, longitude, created_at
         FROM occurrence_reports
         WHERE occurrence_id = o.id
         ORDER BY created_at, id
         LIMIT 1
       ) r ON TRUE
       JOIN LATERAL (
         SELECT file_url
         FROM occurrence_images
         WHERE occurrence_id = o.id
         ORDER BY (image_type = 'INITIAL') DESC, created_at, id
         LIMIT 1
       ) i ON TRUE
       WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [occurrenceId],
    );
    const row = contextResult.rows[0];
    if (row === undefined) return null;

    const [categoryResult, nearbyResult] = await Promise.all([
      pool.query<CategoryRow>(
        `SELECT id, code, name FROM categories WHERE active = TRUE ORDER BY code`,
      ),
      pool.query<NearbyRow>(
        `SELECT
           candidate.id,
           category.code AS category,
           ST_Distance(candidate.location, source.location)::text AS distance_meters,
           COALESCE(candidate.description, candidate.title) AS description,
           COALESCE((
             SELECT jsonb_agg(image.file_url ORDER BY image.created_at)
             FROM occurrence_images image
             WHERE image.occurrence_id = candidate.id
           ), '[]'::jsonb) AS image_urls
         FROM occurrences source
         JOIN occurrences candidate
           ON candidate.id <> source.id
          AND candidate.deleted_at IS NULL
          AND candidate.status NOT IN ('CLOSED', 'REJECTED', 'DUPLICATE')
          AND candidate.created_at >= CURRENT_TIMESTAMP - ($4::int * INTERVAL '1 day')
          AND ST_DWithin(candidate.location, source.location, $3::double precision)
         LEFT JOIN categories category ON category.id = candidate.category_id
         WHERE source.id = $1
           AND source.municipality_id = $2
         ORDER BY ST_Distance(candidate.location, source.location), candidate.created_at DESC
         LIMIT 10`,
        [occurrenceId, row.municipality_id, env.DUPLICATE_RADIUS_METERS, env.DUPLICATE_PERIOD_DAYS],
      ),
    ]);

    const categories: AiCategoryOption[] = categoryResult.rows.map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
    }));
    const nearbyOccurrences: AiNearbyOccurrence[] = nearbyResult.rows.map((candidate) => ({
      id: candidate.id,
      category: candidate.category,
      distanceMeters: Number(candidate.distance_meters),
      description: candidate.description,
      imageUrls: mapImageUrls(candidate.image_urls),
    }));

    return {
      occurrenceId: row.occurrence_id,
      reportId: row.report_id,
      createdBy: row.created_by,
      status: row.status,
      confirmationCount: row.confirmation_count,
      firstReportedAt: row.first_reported_at,
      request: {
        reportId: row.report_id,
        imageUrl: row.image_url,
        description: row.description,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        nearbyOccurrences,
        availableCategories: categories.map(({ code, name }) => ({ code, name })),
      },
      categories,
    };
  }

  public async persist(input: PersistAiAnalysisInput): Promise<PersistAiAnalysisResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const occurrence = await lockOccurrence(client, input.occurrenceId);
      if (occurrence === null) throw new Error('Ocorrencia da analise de IA nao foi encontrada.');

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ai_analyses (
           occurrence_id, report_id, analysis_type, model_name, suggested_category,
           suggested_subcategory, suggested_severity, suggested_risk, confidence,
           summary, possible_duplicates, raw_result, requires_human_review
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9::numeric,
           $10, $11::jsonb, $12::jsonb, $13
         ) RETURNING id`,
        [
          input.occurrenceId,
          input.reportId,
          input.analysisType,
          input.modelName,
          input.suggestedCategory,
          input.suggestedSubcategory,
          input.suggestedSeverity,
          input.suggestedRisk,
          input.confidence,
          input.summary,
          JSON.stringify(input.possibleDuplicates),
          JSON.stringify(input.rawResult),
          input.requiresHumanReview,
        ],
      );
      const analysisId = inserted.rows[0]!.id;

      if (
        input.applyClassification &&
        input.categoryId !== null &&
        input.suggestedSeverity !== null &&
        input.suggestedRisk !== null &&
        input.priorityScore !== null
      ) {
        await client.query(
          `UPDATE occurrences
           SET category_id = $2,
               severity = $3,
               risk_level = $4,
               priority_score = $5::numeric,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [
            input.occurrenceId,
            input.categoryId,
            input.suggestedSeverity,
            input.suggestedRisk,
            input.priorityScore,
          ],
        );
      }

      await client.query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, new_data)
         VALUES ('AI_ANALYSIS_RECORDED', 'ai_analysis', $1, $2::jsonb)`,
        [
          analysisId,
          JSON.stringify({
            occurrenceId: input.occurrenceId,
            analysisType: input.analysisType,
            state: input.state,
            confidence: input.confidence,
            requiresHumanReview: input.requiresHumanReview,
            appliedClassification: input.applyClassification,
            possibleDuplicateCount: input.possibleDuplicates.length,
          }),
        ],
      );
      await client.query(
        `INSERT INTO notifications
           (user_id, type, title, message, entity_type, entity_id)
         VALUES ($1, 'SYSTEM', $2, $3, 'occurrence', $4)`,
        [
          occurrence.createdBy,
          input.requiresHumanReview
            ? 'Ocorrencia em revisao tecnica'
            : 'Classificacao automatica concluida',
          input.requiresHumanReview
            ? 'A analise automatica foi registrada e sera revisada sem alterar o status da ocorrencia.'
            : 'A classificacao automatica foi registrada sem alterar o status da ocorrencia.',
          input.occurrenceId,
        ],
      );
      await client.query('COMMIT');
      return { analysisId, occurrenceStatus: occurrence.status };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async recalculatePriority(occurrenceId: string, now: Date): Promise<number | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<PriorityRow>(
        `SELECT confirmation_count, severity, risk_level, first_reported_at
         FROM occurrences
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [occurrenceId],
      );
      const row = result.rows[0];
      if (row === undefined) {
        await client.query('ROLLBACK');
        return null;
      }
      const priorityScore = this.priorityService.calculate({
        confirmationCount: row.confirmation_count,
        severity: row.severity,
        riskLevel: row.risk_level,
        firstReportedAt: row.first_reported_at,
        calculatedAt: now,
      });
      await client.query(
        `UPDATE occurrences SET priority_score = $2::numeric, updated_at = $3 WHERE id = $1`,
        [occurrenceId, priorityScore, now],
      );
      await client.query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, new_data, created_at)
         VALUES ('AI_INTERNAL_PRIORITY_RECALCULATED', 'occurrence', $1, $2::jsonb, $3)`,
        [occurrenceId, JSON.stringify({ priorityScore }), now],
      );
      await client.query('COMMIT');
      return priorityScore;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
