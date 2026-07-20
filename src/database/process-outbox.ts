import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { N8nWebhookClient } from '../modules/outbox/n8n-webhook.client.js';
import { OutboxProcessor } from '../modules/outbox/outbox.processor.js';
import { PostgresOutboxRepository } from '../modules/outbox/outbox.repository.js';
import { closeDatabase } from './pool.js';

async function main(): Promise<void> {
  if (env.N8N_WEBHOOK_URL === undefined || env.N8N_WEBHOOK_SECRET === undefined) {
    throw new Error(
      'N8N_WEBHOOK_URL e N8N_WEBHOOK_SECRET sao obrigatorios para processar a outbox.',
    );
  }
  const processor = new OutboxProcessor(new PostgresOutboxRepository(), new N8nWebhookClient());
  logger.info(await processor.processBatch(), 'Processamento manual da outbox concluido.');
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Falha no processamento manual da outbox.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
