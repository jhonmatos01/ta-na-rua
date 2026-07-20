import type { QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import type {
  DashboardExportRow,
  DashboardFilters,
  DashboardGroup,
  DashboardRepository,
  DashboardSummary,
  HeatmapCell,
  PriorityRankingItem,
  ResolutionTimeResult,
} from './dashboard.types.js';

interface SummaryRow extends QueryResultRow {
  totalOccurrences: string;
  activeOccurrences: string;
  resolvedOccurrences: string;
  closedOccurrences: string;
  contestedOccurrences: string;
  rejectedOccurrences: string;
  duplicateOccurrences: string;
  totalConfirmations: string;
  averagePriorityScore: string;
  resolutionRate: string;
}

interface GroupRow extends QueryResultRow {
  key: string | null;
  code?: string | null;
  name: string;
  count: string;
  total_count: string;
}

interface RankingRow extends QueryResultRow {
  occurrence_id: string;
  protocol: string;
  title: string;
  municipality_id: string;
  municipality_name: string;
  category_code: string | null;
  category_name: string | null;
  neighborhood_name: string | null;
  status: string;
  severity: number | null;
  risk_level: string | null;
  priority_score: string;
  confirmation_count: number;
  created_at: Date;
}

interface ResolutionRow extends QueryResultRow {
  resolvedOccurrences: string;
  averageHours: string | null;
  medianHours: string | null;
  percentile90Hours: string | null;
  minimumHours: string | null;
  maximumHours: string | null;
}

interface HeatmapRow extends QueryResultRow {
  latitude: string;
  longitude: string;
  occurrence_count: string;
  average_priority_score: string;
}

interface ExportRow extends QueryResultRow {
  protocol: string;
  title: string;
  municipality_name: string;
  category_code: string | null;
  category_name: string | null;
  neighborhood_name: string | null;
  status: string;
  severity: number | null;
  risk_level: string | null;
  priority_score: string;
  confirmation_count: number;
  first_reported_at: Date;
  resolved_at: Date | null;
  created_at: Date;
}

interface WhereClause {
  sql: string;
  values: unknown[];
}

function dashboardWhere(filters: DashboardFilters): WhereClause {
  const values: unknown[] = [];
  const conditions = ['o.deleted_at IS NULL'];
  const add = (condition: string, value: unknown): void => {
    values.push(value);
    conditions.push(condition.replace('?', `$${values.length}`));
  };

  if (filters.municipalityId !== undefined) {
    add('o.municipality_id = ?', filters.municipalityId);
  }
  if (filters.categoryId !== undefined) {
    add('o.category_id = ?', filters.categoryId);
  }
  if (filters.neighborhoodId !== undefined) {
    add('o.neighborhood_id = ?', filters.neighborhoodId);
  }
  if (filters.status !== undefined) {
    add('o.status = ?::occurrence_status', filters.status);
  }
  if (filters.startDate !== undefined) {
    add('o.created_at >= ?', filters.startDate);
  }
  if (filters.endDate !== undefined) {
    add('o.created_at <= ?', filters.endDate);
  }

  return { sql: conditions.join(' AND '), values };
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Number(((count / total) * 100).toFixed(2));
}

function mapGroup(row: GroupRow): DashboardGroup {
  const count = Number(row.count);
  const total = Number(row.total_count);
  return {
    key: row.key,
    ...(row.code === undefined ? {} : { code: row.code }),
    name: row.name,
    count,
    percentage: percentage(count, total),
  };
}

function nullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export class PostgresDashboardRepository implements DashboardRepository {
  public async summary(filters: DashboardFilters): Promise<DashboardSummary> {
    const where = dashboardWhere(filters);
    const result = await pool.query<SummaryRow>(
      `SELECT
         COUNT(*)::text AS "totalOccurrences",
         COUNT(*) FILTER (
           WHERE o.status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE')
         )::text AS "activeOccurrences",
         COUNT(*) FILTER (WHERE o.status = 'RESOLVED')::text AS "resolvedOccurrences",
         COUNT(*) FILTER (WHERE o.status = 'CLOSED')::text AS "closedOccurrences",
         COUNT(*) FILTER (WHERE o.status = 'CONTESTED')::text AS "contestedOccurrences",
         COUNT(*) FILTER (WHERE o.status = 'REJECTED')::text AS "rejectedOccurrences",
         COUNT(*) FILTER (WHERE o.status = 'DUPLICATE')::text AS "duplicateOccurrences",
         COALESCE(SUM(o.confirmation_count), 0)::text AS "totalConfirmations",
         ROUND(COALESCE(AVG(o.priority_score), 0), 2)::text AS "averagePriorityScore",
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(
                COUNT(*) FILTER (WHERE o.status IN ('RESOLVED', 'CLOSED'))::numeric
                * 100 / COUNT(*), 2
              )
          END::text AS "resolutionRate"
       FROM occurrences o
       WHERE ${where.sql}`,
      where.values,
    );
    const row = result.rows[0];
    if (row === undefined) {
      return {
        totalOccurrences: 0,
        activeOccurrences: 0,
        resolvedOccurrences: 0,
        closedOccurrences: 0,
        contestedOccurrences: 0,
        rejectedOccurrences: 0,
        duplicateOccurrences: 0,
        totalConfirmations: 0,
        averagePriorityScore: 0,
        resolutionRate: 0,
      };
    }
    return {
      totalOccurrences: Number(row.totalOccurrences),
      activeOccurrences: Number(row.activeOccurrences),
      resolvedOccurrences: Number(row.resolvedOccurrences),
      closedOccurrences: Number(row.closedOccurrences),
      contestedOccurrences: Number(row.contestedOccurrences),
      rejectedOccurrences: Number(row.rejectedOccurrences),
      duplicateOccurrences: Number(row.duplicateOccurrences),
      totalConfirmations: Number(row.totalConfirmations),
      averagePriorityScore: Number(row.averagePriorityScore),
      resolutionRate: Number(row.resolutionRate),
    };
  }

  public async byCategory(filters: DashboardFilters): Promise<DashboardGroup[]> {
    const where = dashboardWhere(filters);
    const result = await pool.query<GroupRow>(
      `SELECT c.id::text AS key, c.code, COALESCE(c.name, 'Nao classificada') AS name,
              COUNT(*)::text AS count, SUM(COUNT(*)) OVER()::text AS total_count
       FROM occurrences o
       LEFT JOIN categories c ON c.id = o.category_id
       WHERE ${where.sql}
       GROUP BY c.id, c.code, c.name
       ORDER BY COUNT(*) DESC, name ASC`,
      where.values,
    );
    return result.rows.map(mapGroup);
  }

  public async byNeighborhood(filters: DashboardFilters): Promise<DashboardGroup[]> {
    const where = dashboardWhere(filters);
    const result = await pool.query<GroupRow>(
      `SELECT n.id::text AS key, COALESCE(n.name, o.neighborhood_text, 'Nao informado') AS name,
              COUNT(*)::text AS count, SUM(COUNT(*)) OVER()::text AS total_count
       FROM occurrences o
       LEFT JOIN neighborhoods n ON n.id = o.neighborhood_id
       WHERE ${where.sql}
       GROUP BY n.id, COALESCE(n.name, o.neighborhood_text, 'Nao informado')
       ORDER BY COUNT(*) DESC, name ASC`,
      where.values,
    );
    return result.rows.map(mapGroup);
  }

  public async byStatus(filters: DashboardFilters): Promise<DashboardGroup[]> {
    const where = dashboardWhere(filters);
    const result = await pool.query<GroupRow>(
      `SELECT o.status::text AS key, o.status::text AS name,
              COUNT(*)::text AS count, SUM(COUNT(*)) OVER()::text AS total_count
       FROM occurrences o
       WHERE ${where.sql}
       GROUP BY o.status
       ORDER BY array_position(
         ARRAY[
           'PENDING_REVIEW', 'PUBLISHED', 'FORWARDED', 'ACKNOWLEDGED',
           'UNDER_ANALYSIS', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED',
           'CONTESTED', 'CLOSED', 'REJECTED', 'DUPLICATE'
         ]::occurrence_status[], o.status
       )`,
      where.values,
    );
    return result.rows.map(mapGroup);
  }

  public async priorityRanking(
    filters: DashboardFilters,
    limit: number,
  ): Promise<PriorityRankingItem[]> {
    const where = dashboardWhere(filters);
    const values = [...where.values, limit];
    const result = await pool.query<RankingRow>(
      `SELECT o.id AS occurrence_id, o.protocol, o.title,
              o.municipality_id, m.name AS municipality_name,
              c.code AS category_code, c.name AS category_name,
              COALESCE(n.name, o.neighborhood_text) AS neighborhood_name,
              o.status::text, o.severity, o.risk_level::text,
              o.priority_score::text, o.confirmation_count, o.created_at
       FROM occurrences o
       JOIN municipalities m ON m.id = o.municipality_id
       LEFT JOIN categories c ON c.id = o.category_id
       LEFT JOIN neighborhoods n ON n.id = o.neighborhood_id
       WHERE ${where.sql}
       ORDER BY o.priority_score DESC, o.confirmation_count DESC,
                o.first_reported_at ASC, o.id ASC
       LIMIT $${values.length}`,
      values,
    );
    return result.rows.map((row) => ({
      occurrenceId: row.occurrence_id,
      protocol: row.protocol,
      title: row.title,
      municipalityId: row.municipality_id,
      municipalityName: row.municipality_name,
      categoryCode: row.category_code,
      categoryName: row.category_name,
      neighborhoodName: row.neighborhood_name,
      status: row.status,
      severity: row.severity,
      riskLevel: row.risk_level,
      priorityScore: Number(row.priority_score),
      confirmationCount: row.confirmation_count,
      createdAt: row.created_at,
    }));
  }

  public async resolutionTime(filters: DashboardFilters): Promise<ResolutionTimeResult> {
    const where = dashboardWhere(filters);
    const result = await pool.query<ResolutionRow>(
      `WITH durations AS (
         SELECT EXTRACT(EPOCH FROM (o.resolved_at - o.first_reported_at)) / 3600 AS hours
         FROM occurrences o
         WHERE ${where.sql}
           AND o.resolved_at IS NOT NULL
           AND o.resolved_at >= o.first_reported_at
       )
       SELECT COUNT(*)::text AS "resolvedOccurrences",
              ROUND(AVG(hours)::numeric, 2)::text AS "averageHours",
              ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours))::numeric, 2)::text
                AS "medianHours",
              ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY hours))::numeric, 2)::text
                AS "percentile90Hours",
              ROUND(MIN(hours)::numeric, 2)::text AS "minimumHours",
              ROUND(MAX(hours)::numeric, 2)::text AS "maximumHours"
       FROM durations`,
      where.values,
    );
    const row = result.rows[0];
    return {
      resolvedOccurrences: Number(row?.resolvedOccurrences ?? 0),
      averageHours: nullableNumber(row?.averageHours ?? null),
      medianHours: nullableNumber(row?.medianHours ?? null),
      percentile90Hours: nullableNumber(row?.percentile90Hours ?? null),
      minimumHours: nullableNumber(row?.minimumHours ?? null),
      maximumHours: nullableNumber(row?.maximumHours ?? null),
    };
  }

  public async heatmap(filters: DashboardFilters): Promise<HeatmapCell[]> {
    const where = dashboardWhere(filters);
    const result = await pool.query<HeatmapRow>(
      `WITH cells AS (
         SELECT ST_SnapToGrid(ST_Transform(o.location::geometry, 3857), 250) AS cell,
                o.priority_score
         FROM occurrences o
         WHERE ${where.sql}
       )
       SELECT ROUND(ST_Y(ST_Transform(cell, 4326))::numeric, 6)::text AS latitude,
              ROUND(ST_X(ST_Transform(cell, 4326))::numeric, 6)::text AS longitude,
              COUNT(*)::text AS occurrence_count,
              ROUND(AVG(priority_score), 2)::text AS average_priority_score
       FROM cells
       GROUP BY cell
       ORDER BY COUNT(*) DESC, latitude, longitude
       LIMIT 1000`,
      where.values,
    );
    return result.rows.map((row) => ({
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      occurrenceCount: Number(row.occurrence_count),
      averagePriorityScore: Number(row.average_priority_score),
    }));
  }

  public async exportRows(filters: DashboardFilters, limit: number): Promise<DashboardExportRow[]> {
    const where = dashboardWhere(filters);
    const values = [...where.values, limit];
    const result = await pool.query<ExportRow>(
      `SELECT o.protocol, o.title, m.name AS municipality_name,
              c.code AS category_code, c.name AS category_name,
              COALESCE(n.name, o.neighborhood_text) AS neighborhood_name,
              o.status::text, o.severity, o.risk_level::text,
              o.priority_score::text, o.confirmation_count,
              o.first_reported_at, o.resolved_at, o.created_at
       FROM occurrences o
       JOIN municipalities m ON m.id = o.municipality_id
       LEFT JOIN categories c ON c.id = o.category_id
       LEFT JOIN neighborhoods n ON n.id = o.neighborhood_id
       WHERE ${where.sql}
       ORDER BY o.created_at DESC, o.id ASC
       LIMIT $${values.length}`,
      values,
    );
    return result.rows.map((row) => ({
      protocol: row.protocol,
      title: row.title,
      municipalityName: row.municipality_name,
      categoryCode: row.category_code,
      categoryName: row.category_name,
      neighborhoodName: row.neighborhood_name,
      status: row.status,
      severity: row.severity,
      riskLevel: row.risk_level,
      priorityScore: Number(row.priority_score),
      confirmationCount: row.confirmation_count,
      firstReportedAt: row.first_reported_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    }));
  }
}
