import { performance } from 'node:perf_hooks';

import { pool } from './pool.js';

interface PostgisVersionRow {
  postgisVersion: string;
}

interface QueryResult {
  rows: readonly PostgisVersionRow[];
}

export type DatabaseQuery = (statement: string) => Promise<QueryResult>;

export interface DatabaseHealth {
  status: 'connected';
  postgisVersion: string;
  responseTimeMs: number;
}

const executeWithPool: DatabaseQuery = async (statement) => {
  const result = await pool.query<PostgisVersionRow>(statement);
  return { rows: result.rows };
};

export async function checkDatabaseHealth(
  execute: DatabaseQuery = executeWithPool,
): Promise<DatabaseHealth> {
  const startedAt = performance.now();
  const result = await execute('SELECT PostGIS_Version()::text AS "postgisVersion"');
  const postgisVersion = result.rows[0]?.postgisVersion;

  if (postgisVersion === undefined || postgisVersion === '') {
    throw new Error('A extensao PostGIS nao respondeu com uma versao valida.');
  }

  return {
    status: 'connected',
    postgisVersion,
    responseTimeMs: Number((performance.now() - startedAt).toFixed(2)),
  };
}
