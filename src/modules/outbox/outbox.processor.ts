import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { OutboxBatchResult, OutboxDeliveryClient, OutboxRepository } from './outbox.types.js';
import { OutboxDeliveryError } from './outbox.types.js';

export class OutboxProcessor {
  public constructor(
    private readonly repository: OutboxRepository,
    private readonly client: OutboxDeliveryClient,
    private readonly maximumAttempts = env.OUTBOX_MAX_ATTEMPTS,
    private readonly retryBaseSeconds = env.OUTBOX_RETRY_BASE_SECONDS,
    private readonly batchSize = env.OUTBOX_BATCH_SIZE,
    private readonly now: () => Date = () => new Date(),
    private readonly leaseSeconds = 60,
  ) {}

  public async processBatch(): Promise<OutboxBatchResult> {
    const claimTime = this.now();
    const events = await this.repository.claimBatch(
      this.batchSize,
      this.maximumAttempts,
      claimTime,
      new Date(claimTime.getTime() + this.leaseSeconds * 1_000),
    );
    const result: OutboxBatchResult = {
      claimed: events.length,
      processed: 0,
      scheduledForRetry: 0,
      failed: 0,
    };
    for (const event of events) {
      try {
        await this.client.deliver(event);
        await this.repository.markProcessed(event.id, this.now());
        result.processed += 1;
      } catch (error) {
        const terminal = event.attempts >= this.maximumAttempts;
        const retrySeconds = this.retryBaseSeconds * 2 ** Math.max(0, event.attempts - 1);
        const availableAt = new Date(this.now().getTime() + retrySeconds * 1_000);
        const errorCode =
          error instanceof OutboxDeliveryError ? error.code : 'OUTBOX_DELIVERY_FAILED';
        await this.repository.markDeliveryFailure(event.id, errorCode, terminal, availableAt);
        if (terminal) result.failed += 1;
        else result.scheduledForRetry += 1;
        logger.warn(
          { outboxEventId: event.id, attempt: event.attempts, terminal, errorCode },
          'Entrega de evento da outbox falhou.',
        );
      }
    }
    return result;
  }
}
