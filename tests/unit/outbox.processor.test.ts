import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { OutboxProcessor } from '../../src/modules/outbox/outbox.processor.js';
import type {
  OutboxDeliveryClient,
  OutboxEventRecord,
  OutboxRepository,
} from '../../src/modules/outbox/outbox.types.js';
import { OutboxDeliveryError } from '../../src/modules/outbox/outbox.types.js';

const now = new Date('2026-07-20T12:00:00.000Z');

function outboxEvent(overrides: Partial<OutboxEventRecord> = {}): OutboxEventRecord {
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
    ...overrides,
  };
}

class FakeOutboxRepository implements OutboxRepository {
  public events: OutboxEventRecord[] = [];
  public processed: string[] = [];
  public failures: Array<{ id: string; code: string; terminal: boolean; availableAt: Date }> = [];

  public claimBatch(): Promise<OutboxEventRecord[]> {
    return Promise.resolve(this.events);
  }

  public markProcessed(eventId: string): Promise<void> {
    this.processed.push(eventId);
    return Promise.resolve();
  }

  public markDeliveryFailure(
    id: string,
    code: string,
    terminal: boolean,
    availableAt: Date,
  ): Promise<void> {
    this.failures.push({ id, code, terminal, availableAt });
    return Promise.resolve();
  }
}

class FakeDeliveryClient implements OutboxDeliveryClient {
  public error: Error | null = null;
  public delivered: string[] = [];

  public deliver(event: OutboxEventRecord): Promise<void> {
    this.delivered.push(event.id);
    return this.error === null ? Promise.resolve() : Promise.reject(this.error);
  }
}

function processor(repository: OutboxRepository, client: OutboxDeliveryClient) {
  return new OutboxProcessor(repository, client, 3, 30, 20, () => now, 60);
}

describe('OutboxProcessor', () => {
  it('marca entrega confirmada como processada', async () => {
    const repository = new FakeOutboxRepository();
    const client = new FakeDeliveryClient();
    const event = outboxEvent();
    repository.events = [event];
    await expect(processor(repository, client).processBatch()).resolves.toEqual({
      claimed: 1,
      processed: 1,
      scheduledForRetry: 0,
      failed: 0,
    });
    expect(repository.processed).toEqual([event.id]);
  });

  it('reagenda com backoff quando ainda ha tentativas', async () => {
    const repository = new FakeOutboxRepository();
    const client = new FakeDeliveryClient();
    client.error = new OutboxDeliveryError('N8N_HTTP_503');
    repository.events = [outboxEvent({ attempts: 2 })];
    await expect(processor(repository, client).processBatch()).resolves.toMatchObject({
      scheduledForRetry: 1,
      failed: 0,
    });
    expect(repository.failures[0]).toMatchObject({
      code: 'N8N_HTTP_503',
      terminal: false,
      availableAt: new Date(now.getTime() + 60_000),
    });
  });

  it('encerra em FAILED ao esgotar tentativas e sanitiza erros inesperados', async () => {
    const repository = new FakeOutboxRepository();
    const client = new FakeDeliveryClient();
    client.error = new Error('resposta externa sensivel');
    repository.events = [outboxEvent({ attempts: 3 })];
    await expect(processor(repository, client).processBatch()).resolves.toMatchObject({
      scheduledForRetry: 0,
      failed: 1,
    });
    expect(repository.failures[0]).toMatchObject({
      code: 'OUTBOX_DELIVERY_FAILED',
      terminal: true,
    });
  });

  it('retorna lote vazio sem chamar a integracao', async () => {
    const repository = new FakeOutboxRepository();
    const client = new FakeDeliveryClient();
    await expect(processor(repository, client).processBatch()).resolves.toEqual({
      claimed: 0,
      processed: 0,
      scheduledForRetry: 0,
      failed: 0,
    });
    expect(client.delivered).toEqual([]);
  });
});
