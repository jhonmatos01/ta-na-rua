import { createServer } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closeDatabase } from './database/pool.js';
import { createOutboxWorker } from './modules/outbox/outbox.worker.js';
import { createGracefulShutdown } from './shared/server/graceful-shutdown.js';

const app = createApp();
const server = createServer(app);
const outboxWorker = createOutboxWorker();

server.listen(env.PORT, () => {
  outboxWorker.start();
  logger.info(
    {
      port: env.PORT,
      swaggerUrl: `http://localhost:${env.PORT}/docs`,
    },
    'API iniciada.',
  );
});

const shutdown = createGracefulShutdown({ server, closeDatabase, logger });

async function stop(signal: NodeJS.Signals): Promise<void> {
  await outboxWorker.stop();
  await shutdown(signal);
}

process.once('SIGINT', () => {
  void stop('SIGINT');
});

process.once('SIGTERM', () => {
  void stop('SIGTERM');
});
