import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { N8nWebhookClient } from '../../src/modules/outbox/n8n-webhook.client.js';
import type { OutboxEventRecord } from '../../src/modules/outbox/outbox.types.js';
import { signWebhookPayload } from '../../src/modules/webhooks/webhook-security.js';

const now = new Date('2026-07-20T12:00:00.000Z');
const secret = 'unit-test-n8n-webhook-secret-with-32-characters';

function event(): OutboxEventRecord {
  return {
    id: randomUUID(),
    eventType: 'OCCURRENCE_STATUS_CHANGED',
    entityType: 'occurrence',
    entityId: randomUUID(),
    payload: { status: 'IN_PROGRESS' },
    status: 'PROCESSING',
    attempts: 1,
    availableAt: now,
    processedAt: null,
    lastError: null,
    createdAt: now,
  };
}

describe('N8nWebhookClient', () => {
  it('envia contrato assinado com chave idempotente', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = new N8nWebhookClient(
      'https://n8n.example.test/webhook',
      secret,
      fetcher,
      () => now,
    );
    const item = event();
    await client.deliver(item);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://n8n.example.test/webhook');
    const body = options.body as Buffer;
    const timestamp = Math.floor(now.getTime() / 1_000);
    expect(options.headers).toMatchObject({
      'idempotency-key': item.id,
      'x-webhook-id': item.id,
      'x-webhook-timestamp': String(timestamp),
      'x-webhook-signature': signWebhookPayload(secret, timestamp, body),
    });
    expect(JSON.parse(body.toString('utf8'))).toMatchObject({
      id: item.id,
      eventType: item.eventType,
      payload: item.payload,
    });
  });

  it('mapeia indisponibilidade, configuracao ausente e HTTP externo sem vazar corpo', async () => {
    const unavailable = new N8nWebhookClient(
      'https://n8n.example.test/webhook',
      secret,
      () => Promise.reject(new Error('segredo externo')),
      () => now,
    );
    await expect(unavailable.deliver(event())).rejects.toMatchObject({ code: 'N8N_UNAVAILABLE' });

    const invalidHttp = new N8nWebhookClient(
      'https://n8n.example.test/webhook',
      secret,
      () => Promise.resolve(new Response('detalhe sensivel', { status: 500 })),
      () => now,
    );
    await expect(invalidHttp.deliver(event())).rejects.toMatchObject({ code: 'N8N_HTTP_500' });

    await expect(new N8nWebhookClient('', '').deliver(event())).rejects.toMatchObject({
      code: 'N8N_NOT_CONFIGURED',
    });
  });
});
