import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { closeDatabase, pool } from './pool.js';

const requiredTables = [
  'ai_analyses',
  'audit_logs',
  'categories',
  'departments',
  'municipalities',
  'neighborhoods',
  'notifications',
  'occurrence_confirmations',
  'occurrence_images',
  'occurrence_reports',
  'occurrence_status_history',
  'occurrences',
  'outbox_events',
  'protocol_counters',
  'refresh_tokens',
  'repair_evaluations',
  'users',
  'webhook_events',
] as const;

const requiredEnums = [
  'ai_analysis_type',
  'image_type',
  'moderation_status',
  'notification_type',
  'occurrence_status',
  'outbox_event_status',
  'report_source',
  'risk_level',
  'user_role',
  'user_status',
  'webhook_event_status',
] as const;

const requiredIndexes = [
  'occurrence_confirmations_occurrence_user_uidx',
  'occurrence_reports_location_gist_idx',
  'occurrences_dashboard_idx',
  'occurrences_location_gist_idx',
  'occurrences_municipality_created_idx',
  'occurrences_protocol_uidx',
  'occurrences_resolution_idx',
  'notifications_user_read_created_idx',
  'outbox_events_status_available_idx',
  'repair_evaluations_occurrence_user_uidx',
  'users_email_uidx',
  'users_phone_uidx',
  'webhook_events_provider_external_uidx',
  'webhook_events_status_received_idx',
] as const;

interface NameRow {
  name: string;
}

interface CountRow {
  count: number;
}

interface GeographyRow {
  tableName: string;
  columnName: string;
  dataType: string;
}

interface SeedCountRow {
  entity: string;
  count: number;
}

interface AuthenticationSeedRow {
  totalUsers: number;
  argonUsers: number;
  roleCount: number;
  municipalityCount: number;
  blockedUsers: number;
  revokedTokens: number;
}

interface OccurrenceSeedRow {
  totalOccurrences: number;
  validProtocols: number;
  uniqueProtocols: number;
  pointLocations: number;
  withReport: number;
  withImage: number;
  withHistory: number;
  validConfirmationCounters: number;
  validPriorityScores: number;
}

interface Phase5DataRow {
  invalidDepartmentMunicipalities: number;
  invalidOccurrenceAssignments: number;
  invalidStatusTransitions: number;
  invalidOperationalFields: number;
}

interface Phase6DataRow {
  invalidScores: number;
  unrelatedEvaluations: number;
  duplicateEvaluations: number;
  pendingAutomaticContestations: number;
}

interface Phase7DataRow {
  invalidAnalysisFields: number;
  unknownCategories: number;
  missingRawState: number;
  lowConfidenceWithoutReview: number;
  unsafeRawResults: number;
}

interface Phase8DataRow {
  dashboardOccurrences: number;
  invalidResolutionDurations: number;
  invalidNeighborhoodMunicipalities: number;
  invalidHeatmapLocations: number;
}

interface Phase9DataRow {
  webhookEvents: number;
  outboxEvents: number;
  invalidPayloadHashes: number;
  invalidAttempts: number;
  unsafeOperationalData: number;
}

function assertAllPresent(expected: readonly string[], actualRows: NameRow[], label: string): void {
  const actual = new Set(actualRows.map((row) => row.name));
  const missing = expected.filter((name) => !actual.has(name));

  if (missing.length > 0) {
    throw new Error(`${label} ausentes: ${missing.join(', ')}`);
  }
}

async function validateSchema(): Promise<void> {
  const [
    tables,
    enums,
    indexes,
    constraints,
    geography,
    seedCounts,
    authSeed,
    occurrenceSeed,
    phase5Data,
    phase6Data,
    phase7Data,
    phase8Data,
    phase9Data,
    postgis,
  ] = await Promise.all([
    pool.query<NameRow>(
      `SELECT table_name AS name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name = ANY($1::text[])`,
      [requiredTables],
    ),
    pool.query<NameRow>(
      `SELECT typname AS name
         FROM pg_type
         JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND typtype = 'e'
          AND typname = ANY($1::text[])`,
      [requiredEnums],
    ),
    pool.query<NameRow>(
      `SELECT indexname AS name
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = ANY($1::text[])`,
      [requiredIndexes],
    ),
    pool.query<CountRow>(
      `SELECT COUNT(*)::integer AS count
         FROM pg_constraint
         JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
        WHERE pg_namespace.nspname = 'public'
          AND contype IN ('c', 'f', 'u')`,
    ),
    pool.query<GeographyRow>(
      `SELECT table_name AS "tableName",
              column_name AS "columnName",
              udt_name AS "dataType"
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN (('occurrences', 'location'), ('occurrence_reports', 'location'))`,
    ),
    pool.query<SeedCountRow>(
      `SELECT 'municipalities' AS entity, COUNT(*)::integer AS count FROM municipalities
       UNION ALL SELECT 'neighborhoods', COUNT(*)::integer FROM neighborhoods
       UNION ALL SELECT 'categories', COUNT(*)::integer FROM categories
       UNION ALL SELECT 'departments', COUNT(*)::integer FROM departments
       UNION ALL SELECT 'users', COUNT(*)::integer FROM users
       UNION ALL SELECT 'occurrences', COUNT(*)::integer FROM occurrences
       UNION ALL SELECT 'occurrence_reports', COUNT(*)::integer FROM occurrence_reports
       UNION ALL SELECT 'occurrence_images', COUNT(*)::integer FROM occurrence_images
       UNION ALL SELECT 'occurrence_confirmations', COUNT(*)::integer FROM occurrence_confirmations
       UNION ALL SELECT 'occurrence_status_history', COUNT(*)::integer FROM occurrence_status_history
       UNION ALL SELECT 'repair_evaluations', COUNT(*)::integer FROM repair_evaluations
       UNION ALL SELECT 'ai_analyses', COUNT(*)::integer FROM ai_analyses
       UNION ALL SELECT 'notifications', COUNT(*)::integer FROM notifications
       UNION ALL SELECT 'webhook_events', COUNT(*)::integer FROM webhook_events
       UNION ALL SELECT 'outbox_events', COUNT(*)::integer FROM outbox_events`,
    ),
    pool.query<AuthenticationSeedRow>(
      `SELECT
         COUNT(*)::integer AS "totalUsers",
         COUNT(*) FILTER (WHERE password_hash LIKE '$argon2id$%')::integer AS "argonUsers",
         COUNT(DISTINCT role)::integer AS "roleCount",
         COUNT(DISTINCT municipality_id)::integer AS "municipalityCount",
         COUNT(*) FILTER (WHERE status = 'BLOCKED')::integer AS "blockedUsers",
         (SELECT COUNT(*)::integer FROM refresh_tokens WHERE revoked_at IS NOT NULL) AS "revokedTokens"
       FROM users`,
    ),
    pool.query<OccurrenceSeedRow>(
      `SELECT
         COUNT(*)::integer AS "totalOccurrences",
         COUNT(*) FILTER (WHERE protocol ~ '^TNR-[0-9]{4}-[0-9]{6}$')::integer AS "validProtocols",
         COUNT(DISTINCT protocol)::integer AS "uniqueProtocols",
         COUNT(*) FILTER (
           WHERE ST_GeometryType(location::geometry) = 'ST_Point'
             AND ST_SRID(location::geometry) = 4326
         )::integer AS "pointLocations",
         COUNT(*) FILTER (WHERE EXISTS(
           SELECT 1 FROM occurrence_reports r WHERE r.occurrence_id = occurrences.id
         ))::integer AS "withReport",
         COUNT(*) FILTER (WHERE EXISTS(
           SELECT 1 FROM occurrence_images i WHERE i.occurrence_id = occurrences.id
         ))::integer AS "withImage",
         COUNT(*) FILTER (WHERE EXISTS(
           SELECT 1 FROM occurrence_status_history h WHERE h.occurrence_id = occurrences.id
         ))::integer AS "withHistory",
         COUNT(*) FILTER (WHERE confirmation_count = (
           SELECT COUNT(*)::integer FROM occurrence_confirmations c
            WHERE c.occurrence_id = occurrences.id
         ))::integer AS "validConfirmationCounters",
         COUNT(*) FILTER (WHERE priority_score BETWEEN 0 AND 100)::integer AS "validPriorityScores"
       FROM occurrences WHERE deleted_at IS NULL`,
    ),
    pool.query<Phase5DataRow>(
      `WITH valid_transitions(previous_status, new_status) AS (
         VALUES
           ('PENDING_REVIEW'::occurrence_status, 'PUBLISHED'::occurrence_status),
           ('PENDING_REVIEW', 'REJECTED'), ('PENDING_REVIEW', 'DUPLICATE'),
           ('PUBLISHED', 'FORWARDED'), ('PUBLISHED', 'REJECTED'),
           ('PUBLISHED', 'DUPLICATE'), ('FORWARDED', 'ACKNOWLEDGED'),
           ('FORWARDED', 'UNDER_ANALYSIS'), ('ACKNOWLEDGED', 'UNDER_ANALYSIS'),
           ('UNDER_ANALYSIS', 'SCHEDULED'), ('UNDER_ANALYSIS', 'IN_PROGRESS'),
           ('UNDER_ANALYSIS', 'REJECTED'), ('SCHEDULED', 'IN_PROGRESS'),
           ('SCHEDULED', 'UNDER_ANALYSIS'), ('IN_PROGRESS', 'RESOLVED'),
           ('IN_PROGRESS', 'UNDER_ANALYSIS'), ('RESOLVED', 'CLOSED'),
           ('RESOLVED', 'CONTESTED'), ('RESOLVED', 'IN_PROGRESS'),
           ('CLOSED', 'CONTESTED'), ('CONTESTED', 'IN_PROGRESS'),
           ('CONTESTED', 'RESOLVED'), ('REJECTED', 'PENDING_REVIEW'),
           ('DUPLICATE', 'PENDING_REVIEW')
       )
       SELECT
         (SELECT COUNT(*)::integer
            FROM departments d
            LEFT JOIN municipalities m ON m.id = d.municipality_id
           WHERE m.id IS NULL) AS "invalidDepartmentMunicipalities",
         (SELECT COUNT(*)::integer
            FROM occurrences o
            JOIN departments d ON d.id = o.assigned_department_id
           WHERE o.deleted_at IS NULL AND d.municipality_id <> o.municipality_id)
           AS "invalidOccurrenceAssignments",
         (SELECT COUNT(*)::integer
            FROM occurrence_status_history h
           WHERE h.previous_status IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM valid_transitions v
                WHERE v.previous_status = h.previous_status AND v.new_status = h.new_status
             )) AS "invalidStatusTransitions",
         (SELECT COUNT(*)::integer
            FROM occurrences o
           WHERE o.deleted_at IS NULL AND (
             (o.status IN ('RESOLVED', 'CLOSED') AND o.resolved_at IS NULL) OR
             (o.status = 'CLOSED' AND o.closed_at IS NULL) OR
             (o.status = 'DUPLICATE' AND o.duplicate_of_occurrence_id IS NULL)
           )) AS "invalidOperationalFields"`,
    ),
    pool.query<Phase6DataRow>(
      `SELECT
         (SELECT COUNT(*)::integer
            FROM repair_evaluations e
           WHERE e.rating NOT BETWEEN 1 AND 5
              OR (e.service_quality IS NOT NULL AND e.service_quality NOT BETWEEN 1 AND 5))
           AS "invalidScores",
         (SELECT COUNT(*)::integer
            FROM repair_evaluations e
            JOIN occurrences o ON o.id = e.occurrence_id
           WHERE e.user_id <> o.created_by
             AND NOT EXISTS (
               SELECT 1 FROM occurrence_reports r
                WHERE r.occurrence_id = e.occurrence_id AND r.reported_by = e.user_id
             )
             AND NOT EXISTS (
               SELECT 1 FROM occurrence_confirmations c
                WHERE c.occurrence_id = e.occurrence_id AND c.user_id = e.user_id
             )) AS "unrelatedEvaluations",
         (SELECT COUNT(*)::integer
            FROM (
              SELECT occurrence_id, user_id
                FROM repair_evaluations
               GROUP BY occurrence_id, user_id
              HAVING COUNT(*) > 1
            ) duplicated) AS "duplicateEvaluations",
         (SELECT COUNT(*)::integer
            FROM occurrences o
            JOIN (
              SELECT occurrence_id,
                     COUNT(*)::integer AS total,
                     COUNT(*) FILTER (WHERE problem_resolved = FALSE)::integer AS negatives
                FROM repair_evaluations
               GROUP BY occurrence_id
            ) aggregate ON aggregate.occurrence_id = o.id
           WHERE o.deleted_at IS NULL
             AND o.status IN ('RESOLVED', 'CLOSED')
             AND aggregate.total >= $1
             AND aggregate.negatives::numeric / aggregate.total >= $2)
           AS "pendingAutomaticContestations"`,
      [env.EVALUATION_MIN_COUNT_FOR_CONTESTATION, env.EVALUATION_NEGATIVE_THRESHOLD],
    ),
    pool.query<Phase7DataRow>(
      `SELECT
         COUNT(*) FILTER (
           WHERE confidence NOT BETWEEN 0 AND 1
              OR (suggested_severity IS NOT NULL AND suggested_severity NOT BETWEEN 1 AND 5)
              OR (suggested_risk IS NOT NULL AND suggested_risk NOT IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
              OR jsonb_typeof(possible_duplicates) <> 'array'
         )::integer AS "invalidAnalysisFields",
         COUNT(*) FILTER (
           WHERE suggested_category IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM categories c WHERE c.code = ai_analyses.suggested_category
             )
         )::integer AS "unknownCategories",
         COUNT(*) FILTER (WHERE NOT raw_result ? 'state')::integer AS "missingRawState",
         COUNT(*) FILTER (
           WHERE confidence < $1 AND requires_human_review = FALSE
         )::integer AS "lowConfidenceWithoutReview",
         COUNT(*) FILTER (
           WHERE raw_result::text ~* '"(authorization|cookie|secret|token|password|api[-_]?key)"[[:space:]]*:'
         )::integer AS "unsafeRawResults"
       FROM ai_analyses`,
      [env.AI_MIN_CONFIDENCE],
    ),
    pool.query<Phase8DataRow>(
      `SELECT
         COUNT(*)::integer AS "dashboardOccurrences",
         COUNT(*) FILTER (
           WHERE o.resolved_at IS NOT NULL AND o.resolved_at < o.first_reported_at
         )::integer AS "invalidResolutionDurations",
         COUNT(*) FILTER (
           WHERE o.neighborhood_id IS NOT NULL AND n.municipality_id <> o.municipality_id
         )::integer AS "invalidNeighborhoodMunicipalities",
         COUNT(*) FILTER (
           WHERE o.location IS NULL OR GeometryType(o.location::geometry) <> 'POINT'
         )::integer AS "invalidHeatmapLocations"
       FROM occurrences o
       LEFT JOIN neighborhoods n ON n.id = o.neighborhood_id
       WHERE o.deleted_at IS NULL`,
    ),
    pool.query<Phase9DataRow>(
      `SELECT
         (SELECT COUNT(*)::integer FROM webhook_events) AS "webhookEvents",
         (SELECT COUNT(*)::integer FROM outbox_events) AS "outboxEvents",
         (SELECT COUNT(*)::integer FROM webhook_events
           WHERE payload_hash !~ '^[a-f0-9]{64}$') AS "invalidPayloadHashes",
         (SELECT COUNT(*)::integer FROM outbox_events
           WHERE attempts < 0) AS "invalidAttempts",
         (
           (SELECT COUNT(*) FROM webhook_events
             WHERE COALESCE(error_message, '') ~* '(authorization|cookie|secret|password|api[-_]?key)')
           +
           (SELECT COUNT(*) FROM outbox_events
             WHERE payload::text ~* '"(authorization|cookie|secret|password|api[-_]?key)"[[:space:]]*:')
         )::integer AS "unsafeOperationalData"`,
    ),
    pool.query<{ version: string }>('SELECT PostGIS_Version() AS version'),
  ]);

  assertAllPresent(requiredTables, tables.rows, 'Tabelas');
  assertAllPresent(requiredEnums, enums.rows, 'Enums');
  assertAllPresent(requiredIndexes, indexes.rows, 'Indices');

  if (constraints.rows[0] === undefined || constraints.rows[0].count < 30) {
    throw new Error('Quantidade de constraints abaixo do minimo esperado para a Fase 1.');
  }

  if (geography.rows.length !== 2 || geography.rows.some((row) => row.dataType !== 'geography')) {
    throw new Error(
      'As colunas geograficas obrigatorias nao utilizam o tipo geography do PostGIS.',
    );
  }

  const minimumSeedCounts = new Map<string, number>([
    ['municipalities', 2],
    ['neighborhoods', 3],
    ['categories', 11],
    ['departments', 3],
    ['users', 7],
    ['occurrences', 2],
    ['occurrence_reports', 2],
    ['occurrence_images', 2],
    ['occurrence_confirmations', 1],
    ['occurrence_status_history', 3],
    ['repair_evaluations', 1],
    ['ai_analyses', 1],
    ['notifications', 2],
    ['webhook_events', 1],
    ['outbox_events', 1],
  ]);

  for (const row of seedCounts.rows) {
    const minimum = minimumSeedCounts.get(row.entity);
    if (minimum !== undefined && row.count < minimum) {
      throw new Error(`Seed incompleto em ${row.entity}: ${row.count}/${minimum}.`);
    }
  }

  const authenticationSeed = authSeed.rows[0];
  if (
    authenticationSeed === undefined ||
    authenticationSeed.totalUsers < 7 ||
    authenticationSeed.argonUsers !== authenticationSeed.totalUsers ||
    authenticationSeed.roleCount !== 4 ||
    authenticationSeed.municipalityCount < 2 ||
    authenticationSeed.blockedUsers < 1 ||
    authenticationSeed.revokedTokens < 1
  ) {
    throw new Error('Seed de autenticacao da Fase 2 esta incompleto ou contem hash nao Argon2id.');
  }

  const operations = phase5Data.rows[0];
  if (
    operations === undefined ||
    operations.invalidDepartmentMunicipalities !== 0 ||
    operations.invalidOccurrenceAssignments !== 0 ||
    operations.invalidStatusTransitions !== 0 ||
    operations.invalidOperationalFields !== 0
  ) {
    throw new Error(
      'Dados operacionais da Fase 5 contem municipio, transicao ou campo inconsistente.',
    );
  }

  const evaluations = phase6Data.rows[0];
  if (
    evaluations === undefined ||
    evaluations.invalidScores !== 0 ||
    evaluations.unrelatedEvaluations !== 0 ||
    evaluations.duplicateEvaluations !== 0 ||
    evaluations.pendingAutomaticContestations !== 0
  ) {
    throw new Error(
      'Dados da Fase 6 contem nota, relacao, unicidade ou contestacao automatica inconsistente.',
    );
  }

  const occurrenceData = occurrenceSeed.rows[0];
  if (
    occurrenceData === undefined ||
    occurrenceData.totalOccurrences < 2 ||
    occurrenceData.validProtocols !== occurrenceData.totalOccurrences ||
    occurrenceData.uniqueProtocols !== occurrenceData.totalOccurrences ||
    occurrenceData.pointLocations !== occurrenceData.totalOccurrences ||
    occurrenceData.withReport !== occurrenceData.totalOccurrences ||
    occurrenceData.withImage !== occurrenceData.totalOccurrences ||
    occurrenceData.withHistory !== occurrenceData.totalOccurrences ||
    occurrenceData.validConfirmationCounters !== occurrenceData.totalOccurrences ||
    occurrenceData.validPriorityScores !== occurrenceData.totalOccurrences
  ) {
    throw new Error(
      'Dados de ocorrencias invalidos: protocolo, ponto, dependencias, contador ou prioridade inconsistente.',
    );
  }

  const aiData = phase7Data.rows[0];
  if (
    aiData === undefined ||
    aiData.invalidAnalysisFields !== 0 ||
    aiData.unknownCategories !== 0 ||
    aiData.missingRawState !== 0 ||
    aiData.lowConfidenceWithoutReview !== 0 ||
    aiData.unsafeRawResults !== 0
  ) {
    throw new Error(
      'Dados da Fase 7 contem classificacao, revisao, estado bruto ou campo sensivel inconsistente.',
    );
  }

  const dashboardData = phase8Data.rows[0];
  if (
    dashboardData === undefined ||
    dashboardData.dashboardOccurrences < 2 ||
    dashboardData.invalidResolutionDurations !== 0 ||
    dashboardData.invalidNeighborhoodMunicipalities !== 0 ||
    dashboardData.invalidHeatmapLocations !== 0
  ) {
    throw new Error(
      'Dados da Fase 8 contem duracao, bairro municipal ou localizacao de mapa inconsistente.',
    );
  }

  const integrationData = phase9Data.rows[0];
  if (
    integrationData === undefined ||
    integrationData.webhookEvents < 1 ||
    integrationData.outboxEvents < 1 ||
    integrationData.invalidPayloadHashes !== 0 ||
    integrationData.invalidAttempts !== 0 ||
    integrationData.unsafeOperationalData !== 0
  ) {
    throw new Error(
      'Dados da Fase 9 contem hash, tentativa, estado ou campo sensivel inconsistente.',
    );
  }

  logger.info(
    {
      tables: tables.rowCount,
      enums: enums.rowCount,
      requiredIndexes: indexes.rowCount,
      constraints: constraints.rows[0]?.count,
      geographyColumns: geography.rows,
      seedCounts: seedCounts.rows,
      authenticationSeed,
      occurrenceData,
      phase5Data: operations,
      phase6Data: evaluations,
      phase7Data: aiData,
      phase8Data: dashboardData,
      phase9Data: integrationData,
      postgisVersion: postgis.rows[0]?.version,
    },
    'Schema e dados ate a Fase 9 validados com sucesso.',
  );
}

try {
  await validateSchema();
} catch (error) {
  logger.error({ err: error }, 'Falha na validacao do schema e dos dados ate a Fase 9.');
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
