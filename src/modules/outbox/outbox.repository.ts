import type { QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import type { OutboxEventRecord, OutboxEventStatus, OutboxRepository } from './outbox.types.js';

interface OutboxRow extends QueryResultRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  available_at: Date;
  processed_at: Date | null;
  last_error: string | null;
  created_at: Date;
}

const returningColumns = `
  event.id, event.event_type, event.entity_type, event.entity_id, event.payload,
  event.status, event.attempts, event.available_at, event.processed_at,
  event.last_error, event.created_at
`;

function mapEvent(row: OutboxRow): OutboxEventRecord {
  return {
    id: row.id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    availableAt: row.available_at,
    processedAt: row.processed_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

export class PostgresOutboxRepository implements OutboxRepository {
  public async claimBatch(
    batchSize: number,
    maximumAttempts: number,
    now: Date,
    leaseUntil: Date,
  ): Promise<OutboxEventRecord[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE outbox_events
            SET status = 'FAILED', last_error = 'OUTBOX_LEASE_EXHAUSTED'
          WHERE status = 'PROCESSING' AND available_at <= $1 AND attempts >= $2`,
        [now, maximumAttempts],
      );
      const result = await client.query<OutboxRow>(
        `WITH candidates AS (
           SELECT id
             FROM outbox_events
            WHERE (
                    (status = 'PENDING' AND available_at <= $1)
                    OR (status = 'PROCESSING' AND available_at <= $1)
                  )
              AND attempts < $2
            ORDER BY available_at, created_at, id
            FOR UPDATE SKIP LOCKED
            LIMIT $3
         )
         UPDATE outbox_events event
            SET status = 'PROCESSING', attempts = event.attempts + 1,
                available_at = $4, last_error = NULL
           FROM candidates
          WHERE event.id = candidates.id
         RETURNING ${returningColumns}`,
        [now, maximumAttempts, batchSize, leaseUntil],
      );
      await client.query('COMMIT');
      return result.rows.map(mapEvent);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async markProcessed(eventId: string, processedAt: Date): Promise<void> {
    await pool.query(
      `UPDATE outbox_events
          SET status = 'PROCESSED', processed_at = $2, last_error = NULL
        WHERE id = $1 AND status = 'PROCESSING'`,
      [eventId, processedAt],
    );
  }

  public async markDeliveryFailure(
    eventId: string,
    errorCode: string,
    terminal: boolean,
    availableAt: Date,
  ): Promise<void> {
    await pool.query(
      `UPDATE outbox_events
          SET status = CASE WHEN $3 THEN 'FAILED'::outbox_event_status ELSE 'PENDING'::outbox_event_status END,
              available_at = $4, processed_at = NULL, last_error = $2
        WHERE id = $1 AND status = 'PROCESSING'`,
      [eventId, errorCode, terminal, availableAt],
    );
  }
}
