import type { PoolClient, QueryResultRow } from 'pg';

import { pool } from '../../database/pool.js';
import type { RequestContext } from '../auth/auth.types.js';
import type {
  WebhookClaimResult,
  WebhookEventRecord,
  WebhookEventStatus,
  WebhookProcessingEffect,
  WebhookProvider,
  WebhooksRepository,
} from './webhooks.types.js';
import { WebhookTargetNotFoundError } from './webhooks.types.js';

interface WebhookEventRow extends QueryResultRow {
  id: string;
  provider: WebhookProvider;
  external_event_id: string;
  event_type: string;
  payload_hash: string;
  status: WebhookEventStatus;
  response_code: number | null;
  error_message: string | null;
  received_at: Date;
  processed_at: Date | null;
}

const columns = `
  id, provider, external_event_id, event_type, payload_hash, status,
  response_code, error_message, received_at, processed_at
`;

function mapEvent(row: WebhookEventRow): WebhookEventRecord {
  return {
    id: row.id,
    provider: row.provider,
    externalEventId: row.external_event_id,
    eventType: row.event_type,
    payloadHash: row.payload_hash,
    status: row.status,
    responseCode: row.response_code,
    errorMessage: row.error_message,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
  };
}

async function insertAudit(
  client: PoolClient,
  event: WebhookEventRecord,
  effect: WebhookProcessingEffect,
  context: RequestContext,
  now: Date,
): Promise<void> {
  const newData =
    effect.kind === 'enqueue'
      ? { provider: event.provider, eventType: event.eventType, outcome: 'ENQUEUED' }
      : effect.kind === 'record_only'
        ? { provider: event.provider, eventType: event.eventType, outcome: effect.outcome }
        : {
            provider: event.provider,
            eventType: event.eventType,
            outcome: effect.deliveryStatus,
            outboxEventId: effect.outboxEventId,
          };
  await client.query(
    `INSERT INTO audit_logs (
       user_id, action, entity_type, entity_id, new_data,
       ip_address, user_agent, created_at
     ) VALUES (NULL, 'WEBHOOK_PROCESSED', 'webhook_event', $1, $2::jsonb, $3, $4, $5)`,
    [event.id, JSON.stringify(newData), context.ipAddress, context.userAgent, now],
  );
}

export class PostgresWebhooksRepository implements WebhooksRepository {
  public async claim(
    provider: WebhookProvider,
    externalEventId: string,
    eventType: string,
    payloadHash: string,
    now: Date,
  ): Promise<WebhookClaimResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO webhook_events (
           provider, external_event_id, event_type, payload_hash, status, received_at
         ) VALUES ($1, $2, $3, $4, 'RECEIVED', $5)
         ON CONFLICT (provider, external_event_id) DO NOTHING`,
        [provider, externalEventId, eventType, payloadHash, now],
      );
      const selected = await client.query<WebhookEventRow>(
        `SELECT ${columns}
           FROM webhook_events
          WHERE provider = $1 AND external_event_id = $2
          FOR UPDATE`,
        [provider, externalEventId],
      );
      const row = selected.rows[0];
      if (row === undefined) throw new Error('Falha ao registrar evento de webhook.');
      const current = mapEvent(row);
      if (current.payloadHash !== payloadHash) {
        await client.query('COMMIT');
        return { kind: 'payload_mismatch', event: current };
      }
      if (['PROCESSING', 'PROCESSED', 'IGNORED'].includes(current.status)) {
        await client.query('COMMIT');
        return { kind: 'duplicate', event: current };
      }
      const claimed = await client.query<WebhookEventRow>(
        `UPDATE webhook_events
            SET status = 'PROCESSING', response_code = NULL, error_message = NULL,
                processed_at = NULL
          WHERE id = $1
        RETURNING ${columns}`,
        [current.id],
      );
      await client.query('COMMIT');
      return { kind: 'claimed', event: mapEvent(claimed.rows[0] as WebhookEventRow) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async complete(
    event: WebhookEventRecord,
    effect: WebhookProcessingEffect,
    context: RequestContext,
    now: Date,
  ): Promise<string | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let outboxEventId: string | null = null;
      if (effect.kind === 'enqueue') {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO outbox_events (
             event_type, entity_type, entity_id, payload, status, available_at, created_at
           ) VALUES ($1, 'webhook_event', $2, $3::jsonb, 'PENDING', $4, $4)
           RETURNING id`,
          [effect.eventType, event.id, JSON.stringify(effect.payload), now],
        );
        outboxEventId = inserted.rows[0]?.id ?? null;
      } else if (effect.kind === 'outbox_callback') {
        const updated = await client.query(
          `UPDATE outbox_events
              SET status = $2::outbox_event_status,
                  processed_at = CASE WHEN $2::text = 'PROCESSED' THEN $4::timestamptz ELSE NULL END,
                  last_error = CASE WHEN $2::text = 'FAILED' THEN $3::text ELSE NULL END
            WHERE id = $1`,
          [effect.outboxEventId, effect.deliveryStatus, effect.errorMessage, now],
        );
        if (updated.rowCount !== 1) throw new WebhookTargetNotFoundError();
      }
      await insertAudit(client, event, effect, context, now);
      await client.query(
        `UPDATE webhook_events
            SET status = 'PROCESSED', response_code = 202,
                error_message = NULL, processed_at = $2
          WHERE id = $1`,
        [event.id, now],
      );
      await client.query('COMMIT');
      return outboxEventId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async fail(
    eventId: string,
    responseCode: number,
    errorCode: string,
    now: Date,
  ): Promise<void> {
    await pool.query(
      `UPDATE webhook_events
          SET status = 'FAILED', response_code = $2, error_message = $3, processed_at = $4
        WHERE id = $1`,
      [eventId, responseCode, errorCode, now],
    );
  }
}
