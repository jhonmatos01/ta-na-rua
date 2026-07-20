import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOutboxWorker } from '../../src/modules/outbox/outbox.worker.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('outbox worker', () => {
  it('inicia uma vez, processa por intervalo e encerra aguardando o lote ativo', async () => {
    vi.useFakeTimers();
    const processBatch = vi.fn(() =>
      Promise.resolve({ claimed: 0, processed: 0, scheduledForRetry: 0, failed: 0 }),
    );
    const worker = createOutboxWorker({ processBatch }, 1_000);
    worker.start();
    worker.start();
    await vi.waitFor(() => expect(processBatch).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(processBatch).toHaveBeenCalledTimes(2);
    await worker.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(processBatch).toHaveBeenCalledTimes(2);
  });

  it('absorve falha do lote para continuar disponivel', async () => {
    const processBatch = vi.fn(() => Promise.reject(new Error('banco indisponivel')));
    const worker = createOutboxWorker({ processBatch }, 60_000);
    worker.start();
    await worker.stop();
    expect(processBatch).toHaveBeenCalledTimes(1);
  });
});
