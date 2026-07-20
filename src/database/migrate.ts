import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { logger } from '../config/logger.js';
import { closeDatabase, database } from './pool.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

async function runMigrations(): Promise<void> {
  logger.info({ migrationsFolder }, 'Executando migrations.');
  await migrate(database, { migrationsFolder });
  logger.info('Migrations executadas com sucesso.');
}

try {
  await runMigrations();
} catch (error) {
  logger.error({ err: error }, 'Falha ao executar migrations.');
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
