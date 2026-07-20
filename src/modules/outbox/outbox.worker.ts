import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { N8nWebhookClient } from './n8n-webhook.client.js';
import { OutboxProcessor } from './outbox.processor.js';
import { PostgresOutboxRepository } from './outbox.repository.js';

export interface OutboxWorker {
  start(): void;
  stop(): Promise<void>;
}

export function createOutboxWorker(
  processor: Pick<OutboxProcessor, 'processBatch'> = new OutboxProcessor(
    new PostgresOutboxRepository(),
    new N8nWebhookClient(),
  ),
  intervalMs = env.OUTBOX_POLL_INTERVAL_MS,
): OutboxWorker {
  let timer: NodeJS.Timeout | undefined;
  let active: Promise<void> = Promise.resolve();
  let running = false;

  const run = () => {
    if (running) return;
    running = true;
    active = processor
      .processBatch()
      .then((result) => {
        if (result.claimed > 0) logger.info(result, 'Lote da outbox processado.');
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Falha ao consultar a outbox.');
      })
      .finally(() => {
        running = false;
      });
  };

  return {
    start() {
      if (timer !== undefined || env.N8N_WEBHOOK_URL === undefined) return;
      run();
      timer = setInterval(run, intervalMs);
      timer.unref();
    },
    async stop() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      await active;
    },
  };
}
