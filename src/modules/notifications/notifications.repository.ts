import type { QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import type { NotificationListQuery } from './notifications.schemas.js';
import type {
  NotificationListResult,
  NotificationRecord,
  NotificationsRepository,
  NotificationType,
} from './notifications.types.js';

interface NotificationRow extends QueryResultRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: Date | null;
  created_at: Date;
}

const columns = `
  id, user_id, type, title, message, entity_type, entity_id, read_at, created_at
`;

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export class PostgresNotificationsRepository implements NotificationsRepository {
  public async list(userId: string, query: NotificationListQuery): Promise<NotificationListResult> {
    const values: unknown[] = [userId];
    const conditions = ['user_id = $1'];
    if (query.unreadOnly) conditions.push('read_at IS NULL');
    if (query.type !== undefined) {
      values.push(query.type);
      conditions.push(`type = $${values.length}`);
    }
    const where = conditions.join(' AND ');
    const countResult = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::integer AS total FROM notifications WHERE ${where}`,
      values,
    );
    values.push(query.limit, (query.page - 1) * query.limit);
    const rows = await pool.query<NotificationRow>(
      `SELECT ${columns}
         FROM notifications
        WHERE ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      items: rows.rows.map(mapNotification),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  public async unreadCount(userId: string): Promise<number> {
    const result = await pool.query<{ total: number }>(
      'SELECT COUNT(*)::integer AS total FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId],
    );
    return result.rows[0]?.total ?? 0;
  }

  public async markRead(
    userId: string,
    notificationId: string,
    readAt: Date,
  ): Promise<NotificationRecord | null> {
    const result = await pool.query<NotificationRow>(
      `UPDATE notifications
          SET read_at = COALESCE(read_at, $3)
        WHERE id = $1 AND user_id = $2
      RETURNING ${columns}`,
      [notificationId, userId, readAt],
    );
    const row = result.rows[0];
    return row === undefined ? null : mapNotification(row);
  }

  public async markAllRead(userId: string, readAt: Date): Promise<number> {
    const result = await pool.query(
      `UPDATE notifications SET read_at = $2 WHERE user_id = $1 AND read_at IS NULL`,
      [userId, readAt],
    );
    return result.rowCount ?? 0;
  }
}
