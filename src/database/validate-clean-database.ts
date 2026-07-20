import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import pg from 'pg';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { assertDevelopmentSeedAllowed } from './seed-policy.js';

const { Client } = pg;
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

function temporaryDatabaseName(): string {
  return `tanarua_validation_${randomUUID().replaceAll('-', '')}`;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function runScript(scriptName: string, databaseUrl: string): Promise<void> {
  const scriptPath = path.join(projectRoot, 'src', 'database', scriptName);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, scriptPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'development',
        LOG_LEVEL: 'warn',
      },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${scriptName} falhou no banco limpo (codigo ${String(code)}, sinal ${String(signal)}).`,
        ),
      );
    });
  });
}

async function validateCleanDatabase(): Promise<void> {
  assertDevelopmentSeedAllowed(env.NODE_ENV);
  const databaseName = temporaryDatabaseName();
  const maintenanceUrl = new URL(env.DATABASE_URL);
  maintenanceUrl.pathname = '/postgres';
  const temporaryUrl = new URL(env.DATABASE_URL);
  temporaryUrl.pathname = `/${databaseName}`;
  const client = new Client({
    connectionString: maintenanceUrl.toString(),
    application_name: 'ta-na-rua-clean-database-validator',
  });

  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    logger.info({ databaseName }, 'Banco temporario criado para validacao limpa.');
    await runScript('migrate.ts', temporaryUrl.toString());
    await runScript('seed.ts', temporaryUrl.toString());
    await runScript('validate-schema.ts', temporaryUrl.toString());
    logger.info({ databaseName }, 'Migrations e seed validados em banco temporario limpo.');
  } finally {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
    await client.end();
    logger.info({ databaseName }, 'Banco temporario de validacao removido.');
  }
}

try {
  await validateCleanDatabase();
} catch (error) {
  logger.error({ err: error }, 'Falha na validacao em banco temporario limpo.');
  process.exitCode = 1;
}
