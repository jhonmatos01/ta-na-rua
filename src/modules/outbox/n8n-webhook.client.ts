import { env } from '../../config/env.js';
import { signWebhookPayload } from '../webhooks/webhook-security.js';
import type { OutboxDeliveryClient, OutboxEventRecord } from './outbox.types.js';
import { OutboxDeliveryError } from './outbox.types.js';

export type Fetcher = typeof fetch;

export class N8nWebhookClient implements OutboxDeliveryClient {
  public constructor(
    private readonly url = env.N8N_WEBHOOK_URL,
    private readonly secret = env.N8N_WEBHOOK_SECRET,
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly timeoutMs = 8_000,
  ) {}

  public async deliver(event: OutboxEventRecord): Promise<void> {
    if (!this.url || !this.secret) {
      throw new OutboxDeliveryError('N8N_NOT_CONFIGURED');
    }
    const body = Buffer.from(
      JSON.stringify({
        id: event.id,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        occurredAt: event.createdAt.toISOString(),
        payload: event.payload,
      }),
    );
    const timestamp = Math.floor(this.now().getTime() / 1_000);
    let response: Response;
    try {
      response = await this.fetcher(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': event.id,
          'x-webhook-id': event.id,
          'x-webhook-timestamp': String(timestamp),
          'x-webhook-signature': signWebhookPayload(this.secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new OutboxDeliveryError('N8N_TIMEOUT');
      }
      throw new OutboxDeliveryError('N8N_UNAVAILABLE');
    }
    if (!response.ok) throw new OutboxDeliveryError(`N8N_HTTP_${response.status}`);
  }
}
