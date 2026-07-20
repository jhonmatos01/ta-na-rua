import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  application_name: 'ta-na-rua-api',
  connectionTimeoutMillis: 2_000,
  idleTimeoutMillis: 30_000,
  max: 10,
});

pool.on('error', (error) => {
  logger.error({ err: error }, 'Erro inesperado em uma conexao ociosa do PostgreSQL.');
});

export const database = drizzle(pool);

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
