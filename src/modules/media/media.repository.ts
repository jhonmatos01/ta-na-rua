import type { QueryResultRow } from 'pg';
import { pool } from '../../database/pool.js';
import { MediaSanitizer } from './media.sanitizer.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { RequestContext } from '../auth/auth.types.js';
import type {
  MediaRecord,
  MediaRepository,
  ModerationDecision,
  ModerationQuery,
} from './media.types.js';

const selection = `oi.id, oi.occurrence_id AS "occurrenceId", oi.storage_key AS "storageKey",
 oi.public_storage_key AS "publicStorageKey", oi.sanitization_mode AS "sanitizationMode", oi.mime_type AS "mimeType", oi.moderation_status AS "moderationStatus", oi.created_at AS "createdAt",
 o.status AS "occurrenceStatus", o.municipality_id AS "municipalityId", o.created_by AS "ownerId", o.title, o.protocol`;
type Row = MediaRecord & QueryResultRow;
export class PostgresMediaRepository implements MediaRepository {
  public constructor(private readonly sanitizer = new MediaSanitizer()) {}
  public async find(
    selector: { id: string } | { storageKey: string },
  ): Promise<MediaRecord | null> {
    const byId = 'id' in selector;
    const result = await pool.query<Row>(
      `SELECT ${selection} FROM occurrence_images oi
      JOIN occurrences o ON o.id = oi.occurrence_id
      WHERE ${byId ? 'oi.id' : 'oi.storage_key'} = $1 AND o.deleted_at IS NULL`,
      [byId ? selector.id : selector.storageKey],
    );
    return result.rows[0] ?? null;
  }
  public async list(query: ModerationQuery): Promise<{ images: MediaRecord[]; total: number }> {
    const values: unknown[] = [query.status];
    let condition = 'oi.moderation_status = $1 AND o.deleted_at IS NULL';
    if (query.municipalityId !== undefined) {
      values.push(query.municipalityId);
      condition += ' AND o.municipality_id = $2';
    }
    const from = `FROM occurrence_images oi JOIN occurrences o ON o.id = oi.occurrence_id WHERE ${condition}`;
    const count = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total ${from}`,
      values,
    );
    const rows = await pool.query<Row>(
      `SELECT ${selection} ${from}
      ORDER BY oi.created_at ASC, oi.id ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, query.limit, (query.page - 1) * query.limit],
    );
    return { images: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
  }
  public async review(
    id: string,
    decision: ModerationDecision,
    actorId: string,
    context: RequestContext,
  ): Promise<MediaRecord | null> {
    const client = await pool.connect();
    let preparedKey: string | null = null;
    let committed = false;
    try {
      await client.query('BEGIN');
      // Lock occurrence first, matching existing operational transactions.
      const parent = await client.query<{ id: string }>(
        `SELECT o.id FROM occurrences o
        JOIN occurrence_images oi ON oi.occurrence_id = o.id
        WHERE oi.id = $1 AND o.deleted_at IS NULL FOR UPDATE OF o`,
        [id],
      );
      if (parent.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const result = await client.query<Row>(
        `SELECT ${selection} FROM occurrence_images oi
        JOIN occurrences o ON o.id = oi.occurrence_id WHERE oi.id = $1 FOR UPDATE OF oi`,
        [id],
      );
      const image = result.rows[0];
      if (image === undefined) {
        await client.query('ROLLBACK');
        return null;
      }
      if (
        image.moderationStatus !== decision.expectedStatus ||
        image.moderationStatus === decision.status
      ) {
        throw new AppError(
          409,
          'IMAGE_REVIEW_CONFLICT',
          'A imagem ja foi revisada. Atualize a fila antes de decidir.',
        );
      }
      const mode = decision.sanitizationMode ?? 'BLUR';
      if (decision.status === 'APPROVED')
        preparedKey = await this.sanitizer.prepare(image.storageKey, mode);
      await client.query(
        'UPDATE occurrence_images SET moderation_status = $2, public_storage_key = $3, sanitization_mode = $4 WHERE id = $1',
        [id, decision.status, preparedKey, preparedKey ? mode : null],
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id,
        previous_data, new_data, ip_address, user_agent)
        VALUES ($1, 'OCCURRENCE_IMAGE_REVIEWED', 'occurrence_image', $2, $3::jsonb, $4::jsonb, $5, $6)`,
        [
          actorId,
          id,
          JSON.stringify({ status: image.moderationStatus }),
          JSON.stringify({
            status: decision.status,
            reason: decision.reason,
            sanitizationMode: preparedKey ? mode : null,
            occurrenceId: image.occurrenceId,
          }),
          context.ipAddress,
          context.userAgent,
        ],
      );
      await client.query('COMMIT');
      committed = true;
      return {
        ...image,
        moderationStatus: decision.status,
        publicStorageKey: preparedKey,
        sanitizationMode: preparedKey ? mode : null,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      if (preparedKey && !committed) await this.sanitizer.discard(preparedKey);
    }
  }
}
