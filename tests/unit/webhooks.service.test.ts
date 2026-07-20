import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { InMemoryWebhookRateLimiter } from '../../src/modules/webhooks/webhook-rate-limit.js';
import { signWebhookPayload } from '../../src/modules/webhooks/webhook-security.js';
import type { ReportWebhookInput } from '../../src/modules/webhooks/webhooks.schemas.js';
import { DefaultWebhooksService } from '../../src/modules/webhooks/webhooks.service.js';
import type {
  WebhookClaimResult,
  WebhookEventRecord,
  WebhookProcessingEffect,
  WebhookProvider,
  WebhookRequestData,
  WebhooksRepository,
} from '../../src/modules/webhooks/webhooks.types.js';

const secret = 'unit-test-webhook-secret-with-32-characters';
const now = new Date('2026-07-20T12:00:00.000Z');

function event(overrides: Partial<WebhookEventRecord> = {}): WebhookEventRecord {
  return {
    id: randomUUID(),
    provider: 'TELEGRAM',
    externalEventId: 'evt-1',
    eventType: 'REPORT_RECEIVED',
    payloadHash: 'hash',
    status: 'PROCESSING',
    responseCode: null,
    errorMessage: null,
    receivedAt: now,
    processedAt: null,
    ...overrides,
  };
}

class FakeWebhooksRepository implements WebhooksRepository {
  public claimResult: WebhookClaimResult = { kind: 'claimed', event: event() };
  public lastEffect: WebhookProcessingEffect | null = null;
  public completeError: Error | null = null;
  public failed: { eventId: string; responseCode: number; errorCode: string } | null = null;

  public claim(
    _provider: WebhookProvider,
    _externalEventId: string,
    _eventType: string,
    _payloadHash: string,
    _now: Date,
  ): Promise<WebhookClaimResult> {
    return Promise.resolve(this.claimResult);
  }

  public complete(
    _event: WebhookEventRecord,
    effect: WebhookProcessingEffect,
    _context: { ipAddress: string | null; userAgent: string | null },
    _now: Date,
  ): Promise<string | null> {
    this.lastEffect = effect;
    if (this.completeError !== null) return Promise.reject(this.completeError);
    return Promise.resolve(randomUUID());
  }

  public fail(eventId: string, responseCode: number, errorCode: string, _now: Date): Promise<void> {
    this.failed = { eventId, responseCode, errorCode };
    return Promise.resolve();
  }
}

function reportInput(): ReportWebhookInput {
  return {
    externalEventId: 'evt-1',
    eventType: 'REPORT_RECEIVED',
    occurredAt: now,
    data: {
      municipalityId: randomUUID(),
      title: 'Buraco na pista',
      description: 'Buraco proximo ao ponto de onibus',
      latitude: -12.98,
      longitude: -38.5,
    },
  };
}

function signedRequest(input: ReportWebhookInput): WebhookRequestData {
  const rawBody = Buffer.from(
    JSON.stringify({ ...input, occurredAt: input.occurredAt.toISOString() }),
  );
  const timestamp = Math.floor(now.getTime() / 1_000);
  return {
    rawBody,
    signature: signWebhookPayload(secret, timestamp, rawBody),
    timestamp: String(timestamp),
    webhookId: input.externalEventId,
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
  };
}

function service(repository: WebhooksRepository, maximum = 30) {
  return new DefaultWebhooksService(
    repository,
    { TELEGRAM: secret, WHATSAPP: secret, STATUS: secret, N8N: secret },
    new InMemoryWebhookRateLimiter(maximum, 60, () => now),
    () => now,
    300,
  );
}

describe('DefaultWebhooksService', () => {
  it('autentica, normaliza e enfileira um relato externo', async () => {
    const repository = new FakeWebhooksRepository();
    const input = reportInput();
    await expect(
      service(repository).handle('TELEGRAM', input, signedRequest(input)),
    ).resolves.toMatchObject({
      accepted: true,
      duplicate: false,
      status: 'PROCESSED',
    });
    expect(repository.lastEffect).toMatchObject({
      kind: 'enqueue',
      eventType: 'TELEGRAM_REPORT_RECEIVED',
      payload: { source: 'TELEGRAM', report: input.data },
    });
  });

  it('retorna duplicata sem gerar outro item de outbox', async () => {
    const repository = new FakeWebhooksRepository();
    repository.claimResult = {
      kind: 'duplicate',
      event: event({ status: 'PROCESSED' }),
    };
    const input = reportInput();
    await expect(
      service(repository).handle('TELEGRAM', input, signedRequest(input)),
    ).resolves.toMatchObject({
      duplicate: true,
      status: 'PROCESSED',
      outboxEventId: null,
    });
    expect(repository.lastEffect).toBeNull();
  });

  it('rejeita reutilizacao do identificador com outro payload', async () => {
    const repository = new FakeWebhooksRepository();
    repository.claimResult = { kind: 'payload_mismatch', event: event() };
    const input = reportInput();
    await expect(
      service(repository).handle('TELEGRAM', input, signedRequest(input)),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'WEBHOOK_EVENT_CONFLICT',
    });
  });

  it('registra falha processavel sem expor o erro interno', async () => {
    const repository = new FakeWebhooksRepository();
    repository.completeError = new Error('segredo-que-nao-pode-vazar');
    const input = reportInput();
    await expect(
      service(repository).handle('TELEGRAM', input, signedRequest(input)),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'WEBHOOK_PROCESSING_FAILED',
      message: 'Nao foi possivel processar o webhook neste momento.',
    });
    expect(repository.failed).toMatchObject({
      responseCode: 503,
      errorCode: 'WEBHOOK_PROCESSING_FAILED',
    });
  });

  it('aplica rate limit antes do processamento', async () => {
    const repository = new FakeWebhooksRepository();
    const input = reportInput();
    const limitedService = service(repository, 1);
    await limitedService.handle('TELEGRAM', input, signedRequest(input));
    await expect(
      limitedService.handle('TELEGRAM', input, signedRequest(input)),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'WEBHOOK_RATE_LIMITED',
    });
  });
});
