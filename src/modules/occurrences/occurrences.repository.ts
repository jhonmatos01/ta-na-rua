import type { PoolClient, QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import {
  OccurrenceImageLimitError,
  type CreateOccurrenceData,
  type HistoryRecord,
  type LocationValidation,
  type OccurrenceImageRecord,
  type OccurrenceListResult,
  type OccurrenceRecord,
  type OccurrenceRepository,
  type OccurrenceVisibility,
} from './occurrences.types.js';
import type {
  CreateOccurrenceInput,
  MapQuery,
  NearbyQuery,
  OccurrenceListQuery,
  UpdateOccurrenceInput,
} from './occurrences.schemas.js';

interface OccurrenceRow extends QueryResultRow {
  id: string;
  protocol: string;
  title: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  municipality_id: string;
  municipality_name: string;
  neighborhood_id: string | null;
  neighborhood_name: string | null;
  neighborhood_text: string | null;
  created_by: string;
  status: OccurrenceRecord['status'];
  severity: number | null;
  priority_score: string;
  risk_level: OccurrenceRecord['riskLevel'];
  address: string | null;
  latitude: string;
  longitude: string;
  location_accuracy: string | null;
  anonymous_publication: boolean;
  confirmation_count: number;
  first_reported_at: Date;
  created_at: Date;
  updated_at: Date;
  images: unknown;
  distance_meters?: string | null;
}

interface ImageJson {
  id: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  imageType: string;
  moderationStatus: string;
  createdAt: string;
}

interface ImageRow extends QueryResultRow {
  id: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  image_type: string;
  moderation_status: string;
  created_at: Date;
}

const occurrenceSelect = `
  o.id, o.protocol, o.title, o.description, o.category_id, c.name AS category_name,
  o.municipality_id, m.name AS municipality_name, o.neighborhood_id,
  n.name AS neighborhood_name, o.neighborhood_text, o.created_by, o.status,
  o.severity, o.priority_score, o.risk_level, o.address, o.latitude, o.longitude,
  o.location_accuracy, o.anonymous_publication, o.confirmation_count,
  o.first_reported_at, o.created_at, o.updated_at
`;

const occurrenceGroupBy = `
  o.id, c.name, m.name, n.name
`;

function mapImageJson(value: ImageJson): OccurrenceImageRecord {
  return {
    id: value.id,
    fileUrl: value.fileUrl,
    mimeType: value.mimeType,
    fileSize: value.fileSize,
    imageType: value.imageType,
    moderationStatus: value.moderationStatus,
    createdAt: new Date(value.createdAt),
  };
}

function mapImageRow(row: ImageRow): OccurrenceImageRecord {
  return {
    id: row.id,
    fileUrl: row.file_url,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    imageType: row.image_type,
    moderationStatus: row.moderation_status,
    createdAt: row.created_at,
  };
}

function mapOccurrence(row: OccurrenceRow): OccurrenceRecord {
  const images = Array.isArray(row.images) ? (row.images as ImageJson[]).map(mapImageJson) : [];
  return {
    id: row.id,
    protocol: row.protocol,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    municipalityId: row.municipality_id,
    municipalityName: row.municipality_name,
    neighborhoodId: row.neighborhood_id,
    neighborhoodName: row.neighborhood_name,
    neighborhoodText: row.neighborhood_text,
    createdBy: row.created_by,
    status: row.status,
    severity: row.severity,
    priorityScore: Number(row.priority_score),
    riskLevel: row.risk_level,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    locationAccuracy: row.location_accuracy === null ? null : Number(row.location_accuracy),
    anonymousPublication: row.anonymous_publication,
    confirmationCount: row.confirmation_count,
    firstReportedAt: row.first_reported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images,
    ...(row.distance_meters === undefined || row.distance_meters === null
      ? {}
      : { distanceMeters: Number(row.distance_meters) }),
  };
}

function imageAggregate(publicOnly: boolean): string {
  const moderation = publicOnly ? " AND oi.moderation_status = 'APPROVED'" : '';
  return `
    LEFT JOIN occurrence_images oi ON oi.occurrence_id = o.id${moderation}
  `;
}

function imageJsonAggregate(): string {
  return `COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'fileUrl', oi.file_url,
        'mimeType', oi.mime_type,
        'fileSize', oi.file_size,
        'imageType', oi.image_type,
        'moderationStatus', oi.moderation_status,
        'createdAt', oi.created_at
      ) ORDER BY oi.created_at
    ) FILTER (WHERE oi.id IS NOT NULL), '[]'::jsonb
  ) AS images`;
}

function baseConditions(visibility: OccurrenceVisibility, values: unknown[]): string[] {
  const conditions = ['o.deleted_at IS NULL'];
  if (visibility.publicOnly) {
    conditions.push("o.status NOT IN ('PENDING_REVIEW', 'REJECTED')");
  }
  if (visibility.municipalityId !== undefined) {
    values.push(visibility.municipalityId);
    conditions.push(`o.municipality_id = $${values.length}`);
  }
  if (visibility.ownerId !== undefined) {
    values.push(visibility.ownerId);
    conditions.push(`o.created_by = $${values.length}`);
  }
  if (visibility.confirmerId !== undefined) {
    values.push(visibility.confirmerId);
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM occurrence_confirmations oc
        WHERE oc.occurrence_id = o.id AND oc.user_id = $${values.length}
      )`,
    );
  }
  if (visibility.evaluationPendingForUserId !== undefined) {
    values.push(visibility.evaluationPendingForUserId);
    const userParameter = `$${values.length}`;
    conditions.push(
      `o.status IN ('RESOLVED', 'CLOSED')`,
      `(
        o.created_by = ${userParameter}
        OR EXISTS (
          SELECT 1 FROM occurrence_reports occurrence_report
          WHERE occurrence_report.occurrence_id = o.id
            AND occurrence_report.reported_by = ${userParameter}
        )
        OR EXISTS (
          SELECT 1 FROM occurrence_confirmations occurrence_confirmation
          WHERE occurrence_confirmation.occurrence_id = o.id
            AND occurrence_confirmation.user_id = ${userParameter}
        )
      )`,
      `NOT EXISTS (
        SELECT 1 FROM repair_evaluations repair_evaluation
        WHERE repair_evaluation.occurrence_id = o.id
          AND repair_evaluation.user_id = ${userParameter}
      )`,
    );
  }
  return conditions;
}

function addCommonFilters(
  query: OccurrenceListQuery | MapQuery,
  conditions: string[],
  values: unknown[],
): void {
  if (query.municipalityId !== undefined) {
    values.push(query.municipalityId);
    conditions.push(`o.municipality_id = $${values.length}`);
  }
  if ('neighborhood' in query && query.neighborhood !== undefined) {
    values.push(query.neighborhood);
    conditions.push(
      `(n.id::text = $${values.length} OR n.slug = lower($${values.length}) OR n.name ILIKE $${values.length} OR o.neighborhood_text ILIKE $${values.length})`,
    );
  }
  if (query.category !== undefined) {
    values.push(query.category);
    conditions.push(
      `(c.id::text = $${values.length} OR c.code = upper($${values.length}) OR c.slug = lower($${values.length}))`,
    );
  }
  if (query.status !== undefined) {
    values.push(query.status);
    conditions.push(`o.status = $${values.length}`);
  }
  if (query.risk !== undefined) {
    values.push(query.risk);
    conditions.push(`o.risk_level = $${values.length}`);
  }
  if ('priority' in query && query.priority !== undefined) {
    values.push(query.priority);
    conditions.push(`o.priority_score >= $${values.length}`);
  }
  if (query.startDate !== undefined) {
    values.push(query.startDate);
    conditions.push(`o.created_at >= $${values.length}`);
  }
  if (query.endDate !== undefined) {
    values.push(query.endDate);
    conditions.push(`o.created_at <= $${values.length}`);
  }
}

async function insertAudit(
  client: PoolClient,
  actorId: string,
  action: string,
  occurrenceId: string,
  context: CreateOccurrenceData['context'],
  newData: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, new_data, ip_address, user_agent)
     VALUES ($1, $2, 'occurrence', $3, $4::jsonb, $5, $6)`,
    [actorId, action, occurrenceId, JSON.stringify(newData), context.ipAddress, context.userAgent],
  );
}

export class PostgresOccurrenceRepository implements OccurrenceRepository {
  public async validateLocationAndReferences(
    input: CreateOccurrenceInput,
  ): Promise<LocationValidation> {
    const result = await pool.query<
      QueryResultRow & {
        municipality_exists: boolean;
        declared_is_nearest: boolean;
        distance_meters: string | null;
        neighborhood_matches: boolean;
        category_exists: boolean;
      }
    >(
      `WITH point AS (
         SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS geog
       ), ranked AS (
         SELECT m.id,
           ST_Distance(
             ST_SetSRID(ST_MakePoint(m.longitude::double precision, m.latitude::double precision), 4326)::geography,
             point.geog
           ) AS distance
         FROM municipalities m CROSS JOIN point
         WHERE m.active = TRUE
         ORDER BY distance
         LIMIT 1
       )
       SELECT
         EXISTS(SELECT 1 FROM municipalities WHERE id = $3 AND active = TRUE) AS municipality_exists,
         COALESCE((SELECT id = $3 FROM ranked), FALSE) AS declared_is_nearest,
         (SELECT distance::text FROM ranked WHERE id = $3) AS distance_meters,
         ($4::uuid IS NULL OR EXISTS(
           SELECT 1 FROM neighborhoods WHERE id = $4 AND municipality_id = $3 AND active = TRUE
         )) AS neighborhood_matches,
         ($5::uuid IS NULL OR EXISTS(
           SELECT 1 FROM categories WHERE id = $5 AND active = TRUE
         )) AS category_exists`,
      [
        input.latitude,
        input.longitude,
        input.municipalityId,
        input.neighborhoodId,
        input.categoryId,
      ],
    );
    const row = result.rows[0]!;
    return {
      municipalityExists: row.municipality_exists,
      declaredMunicipalityIsNearest: row.declared_is_nearest,
      distanceMeters: row.distance_meters === null ? null : Number(row.distance_meters),
      neighborhoodMatches: row.neighborhood_matches,
      categoryExists: row.category_exists,
    };
  }

  public async create(data: CreateOccurrenceData): Promise<OccurrenceRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const year = data.now.getUTCFullYear();
      const counter = await client.query<{ last_value: string }>(
        `INSERT INTO protocol_counters (year, last_value, updated_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (year) DO UPDATE
         SET last_value = protocol_counters.last_value + 1, updated_at = EXCLUDED.updated_at
         RETURNING last_value::text`,
        [year, data.now],
      );
      const sequence = Number(counter.rows[0]!.last_value);
      if (sequence > 999_999) throw new Error('Limite anual de protocolos excedido.');
      const protocol = `TNR-${year}-${String(sequence).padStart(6, '0')}`;

      const created = await client.query<{ id: string }>(
        `INSERT INTO occurrences (
          protocol, title, description, category_id, municipality_id, neighborhood_id,
          created_by, status, address, neighborhood_text, latitude, longitude, location,
          location_accuracy, anonymous_publication, first_reported_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'PENDING_REVIEW', $8, $9,
          $10::numeric, $11::numeric,
          ST_SetSRID(ST_MakePoint($11::double precision, $10::double precision), 4326)::geography,
          $12, $13, $14, $14, $14
        ) RETURNING id`,
        [
          protocol,
          data.input.title,
          data.input.description ?? null,
          data.input.categoryId ?? null,
          data.input.municipalityId,
          data.input.neighborhoodId ?? null,
          data.userId,
          data.input.address ?? null,
          data.input.neighborhoodText ?? null,
          data.input.latitude,
          data.input.longitude,
          data.input.locationAccuracy ?? null,
          data.input.anonymousPublication,
          data.now,
        ],
      );
      const occurrenceId = created.rows[0]!.id;
      const report = await client.query<{ id: string }>(
        `INSERT INTO occurrence_reports (
          occurrence_id, reported_by, original_description, latitude, longitude,
          location, reported_at, source, created_at
        ) VALUES (
          $1, $2, $3, $4::numeric, $5::numeric,
          ST_SetSRID(ST_MakePoint($5::double precision, $4::double precision), 4326)::geography,
          $6, 'WEB_APP', $6
        ) RETURNING id`,
        [
          occurrenceId,
          data.userId,
          data.input.description ?? data.input.title,
          data.input.latitude,
          data.input.longitude,
          data.now,
        ],
      );
      await client.query(
        `INSERT INTO occurrence_images (
          occurrence_id, report_id, uploaded_by, file_url, storage_key,
          mime_type, file_size, image_type, moderation_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INITIAL', 'PENDING', $8)`,
        [
          occurrenceId,
          report.rows[0]!.id,
          data.userId,
          data.image.url,
          data.image.key,
          data.image.mimeType,
          data.image.size,
          data.now,
        ],
      );
      await client.query(
        `INSERT INTO occurrence_status_history (
          occurrence_id, previous_status, new_status, changed_by, public_message, created_at
        ) VALUES ($1, NULL, 'PENDING_REVIEW', $2, $3, $4)`,
        [occurrenceId, data.userId, 'Ocorrencia recebida e aguardando revisao.', data.now],
      );
      await insertAudit(client, data.userId, 'OCCURRENCE_CREATED', occurrenceId, data.context, {
        protocol,
        status: 'PENDING_REVIEW',
        municipalityId: data.input.municipalityId,
        imageCount: 1,
      });
      await client.query(
        `INSERT INTO notifications
          (user_id, type, title, message, entity_type, entity_id, created_at)
         VALUES ($1, 'OCCURRENCE_CREATED', $2, $3, 'occurrence', $4, $5)`,
        [
          data.userId,
          'Ocorrencia registrada',
          `Recebemos sua ocorrencia ${protocol}.`,
          occurrenceId,
          data.now,
        ],
      );
      await client.query('COMMIT');
      const occurrence = await this.findById(occurrenceId);
      if (occurrence === null) throw new Error('Ocorrencia criada nao foi encontrada.');
      return occurrence;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async findById(occurrenceId: string): Promise<OccurrenceRecord | null> {
    const result = await pool.query<OccurrenceRow>(
      `SELECT ${occurrenceSelect}, ${imageJsonAggregate()}
       FROM occurrences o
       JOIN municipalities m ON m.id = o.municipality_id
       LEFT JOIN categories c ON c.id = o.category_id
       LEFT JOIN neighborhoods n ON n.id = o.neighborhood_id
       ${imageAggregate(false)}
       WHERE o.id = $1 AND o.deleted_at IS NULL
       GROUP BY ${occurrenceGroupBy}`,
      [occurrenceId],
    );
    return result.rows[0] === undefined ? null : mapOccurrence(result.rows[0]);
  }

  public async list(
    query: OccurrenceListQuery,
    visibility: OccurrenceVisibility,
  ): Promise<OccurrenceListResult> {
    const values: unknown[] = [];
    const conditions = baseConditions(visibility, values);
    addCommonFilters(query, conditions, values);
    if (
      query.latitude !== undefined &&
      query.longitude !== undefined &&
      query.radius !== undefined
    ) {
      values.push(query.longitude, query.latitude, query.radius);
      conditions.push(
        `ST_DWithin(o.location, ST_SetSRID(ST_MakePoint($${values.length - 2}, $${values.length - 1}), 4326)::geography, $${values.length})`,
      );
    }
    const where = conditions.join(' AND ');
    const count = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM occurrences o
       JOIN municipalities m ON m.id = o.municipality_id
       LEFT JOIN categories c ON c.id = o.category_id
       LEFT JOIN neighborhoods n ON n.id = o.neighborhood_id
       WHERE ${where}`,
      values,
    );
    const resultValues = [...values, query.limit, (query.page - 1) * query.limit];
    const result = await pool.query<OccurrenceRow>(
      `SELECT ${occurrenceSelect}, ${imageJsonAggregate()}
       FROM occurrences o
       JOIN municipalities m ON m.id = o.municipality_id
       LEFT JOIN categories c ON c.id = o.category_id
       LEFT JOIN neighborhoods n ON n.id = o.neighborhood_id
       ${imageAggregate(visibility.publicOnly)}
       WHERE ${where}
       GROUP BY ${occurrenceGroupBy}
       ORDER BY o.created_at DESC
       LIMIT $${resultValues.length - 1} OFFSET $${resultValues.length}`,
      resultValues,
    );
    return { items: result.rows.map(mapOccurrence), total: Number(count.rows[0]?.total ?? 0) };
  }

  public async nearby(
    query: NearbyQuery,
    visibility: OccurrenceVisibility,
  ): Promise<OccurrenceListResult> {
    const values: unknown[] = [];
    const conditions = baseConditions(visibility, values);
    if (query.municipalityId !== undefined) {
      values.push(query.municipalityId);
      conditions.push(`o.municipality_id = $${values.length}`);
    }
    values.push(query.longitude, query.latitude, query.radius);
    const longitudeIndex = values.length - 2;
    const latitudeIndex = values.length - 1;
    const radiusIndex = values.length;
    const point = `ST_SetSRID(ST_MakePoint($${longitudeIndex}, $${latitudeIndex}), 4326)::geography`;
    conditions.push(`ST_DWithin(o.location, ${point}, $${radiusIndex})`);
    const where = conditions.join(' AND ');
    const count = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM occurrences o WHERE ${where}`,
      values,
    );
    const resultValues = [...values, query.limit, (query.page - 1) * query.limit];
    const result = await pool.query<OccurrenceRow>(
      `SELECT ${occurrenceSelect}, ${imageJsonAggregate()},
         ST_Distance(o.location, ${point})::text AS distance_meters
       FROM occurrences o
       JOIN municipalities m ON m.id = o.municipality_id
       LEFT JOIN categories c ON c.id = o.category_id
       LEFT JOIN neighborhoods n ON n.id = o.neighborhood_id
       ${imageAggregate(visibility.publicOnly)}
       WHERE ${where}
       GROUP BY ${occurrenceGroupBy}
       ORDER BY ST_Distance(o.location, ${point}), o.created_at DESC
       LIMIT $${resultValues.length - 1} OFFSET $${resultValues.length}`,
      resultValues,
    );
    return { items: result.rows.map(mapOccurrence), total: Number(count.rows[0]?.total ?? 0) };
  }

  public async map(query: MapQuery, visibility: OccurrenceVisibility): Promise<OccurrenceRecord[]> {
    const values: unknown[] = [];
    const conditions = baseConditions(visibility, values);
    addCommonFilters(query, conditions, values);
    values.push(query.limit);
    const result = await pool.query<OccurrenceRow>(
      `SELECT ${occurrenceSelect}, '[]'::jsonb AS images
       FROM occurrences o
       JOIN municipalities m ON m.id = o.municipality_id
       LEFT JOIN categories c ON c.id = o.category_id
       LEFT JOIN neighborhoods n ON n.id = o.neighborhood_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY o.created_at DESC
       LIMIT $${values.length}`,
      values,
    );
    return result.rows.map(mapOccurrence);
  }

  public async update(
    occurrenceId: string,
    actorId: string,
    input: UpdateOccurrenceInput,
    context: CreateOccurrenceData['context'],
    now: Date,
  ): Promise<OccurrenceRecord | null> {
    const entries = Object.entries(input);
    const columns: Record<string, string> = {
      title: 'title',
      description: 'description',
      neighborhoodText: 'neighborhood_text',
      address: 'address',
      anonymousPublication: 'anonymous_publication',
    };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const values: unknown[] = [occurrenceId];
      const assignments = entries.map(([key, value]) => {
        values.push(value);
        return `${columns[key]} = $${values.length}`;
      });
      values.push(now);
      const result = await client.query(
        `UPDATE occurrences SET ${assignments.join(', ')}, updated_at = $${values.length}
         WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        values,
      );
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      await insertAudit(client, actorId, 'OCCURRENCE_UPDATED', occurrenceId, context, {
        changedFields: entries.map(([key]) => key),
      });
      await client.query('COMMIT');
      return await this.findById(occurrenceId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async softDelete(
    occurrenceId: string,
    actorId: string,
    context: CreateOccurrenceData['context'],
    now: Date,
  ): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE occurrences SET deleted_at = $2, updated_at = $2
         WHERE id = $1 AND deleted_at IS NULL RETURNING protocol`,
        [occurrenceId, now],
      );
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      await insertAudit(client, actorId, 'OCCURRENCE_DELETED', occurrenceId, context, {
        logicalDeletion: true,
      });
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async countImages(occurrenceId: string): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM occurrence_images oi
       JOIN occurrences o ON o.id = oi.occurrence_id
       WHERE oi.occurrence_id = $1 AND o.deleted_at IS NULL`,
      [occurrenceId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  public async addImage(
    occurrenceId: string,
    actorId: string,
    image: CreateOccurrenceData['image'],
    maxImages: number,
    context: CreateOccurrenceData['context'],
    now: Date,
  ): Promise<OccurrenceImageRecord | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        'SELECT id FROM occurrences WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [occurrenceId],
      );
      if (locked.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const count = await client.query<{ total: string }>(
        'SELECT COUNT(*)::text AS total FROM occurrence_images WHERE occurrence_id = $1',
        [occurrenceId],
      );
      if (Number(count.rows[0]?.total ?? 0) >= maxImages) {
        throw new OccurrenceImageLimitError();
      }
      const inserted = await client.query<ImageRow>(
        `INSERT INTO occurrence_images (
          occurrence_id, uploaded_by, file_url, storage_key, mime_type, file_size,
          image_type, moderation_status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'UPDATE', 'PENDING', $7)
        RETURNING id, file_url, mime_type, file_size, image_type, moderation_status, created_at`,
        [occurrenceId, actorId, image.url, image.key, image.mimeType, image.size, now],
      );
      const row = inserted.rows[0];
      if (row === undefined) {
        await client.query('ROLLBACK');
        return null;
      }
      await insertAudit(client, actorId, 'OCCURRENCE_IMAGE_ADDED', occurrenceId, context, {
        imageId: row.id,
        mimeType: image.mimeType,
        fileSize: image.size,
      });
      await client.query('COMMIT');
      return mapImageRow(row);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async timeline(occurrenceId: string): Promise<HistoryRecord[]> {
    const result = await pool.query<
      QueryResultRow & {
        id: string;
        previous_status: HistoryRecord['previousStatus'];
        new_status: HistoryRecord['newStatus'];
        reason: string | null;
        public_message: string | null;
        created_at: Date;
      }
    >(
      `SELECT h.id, h.previous_status, h.new_status, h.reason, h.public_message, h.created_at
       FROM occurrence_status_history h
       JOIN occurrences o ON o.id = h.occurrence_id
       WHERE h.occurrence_id = $1 AND o.deleted_at IS NULL
       ORDER BY h.created_at ASC`,
      [occurrenceId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      reason: row.reason,
      publicMessage: row.public_message,
      createdAt: row.created_at,
    }));
  }
}
