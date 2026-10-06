import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import pg from 'pg';
import { env } from '../config/env.js';
import { assertDevelopmentSeedAllowed } from './seed-policy.js';

interface Envelope<T> {
  data: T;
  error?: { code: string; message: string };
}
interface Session {
  token: string;
  cookie: string;
}
interface Occurrence {
  id: string;
  images: { id: string; url: string }[];
}
const execute = promisify(execFile);
const name = `tanarua_phase11_${randomUUID().replaceAll('-', '')}`;
const directory = path.resolve('tmp', name);
const maintenanceUrl = new URL(env.DATABASE_URL);
maintenanceUrl.pathname = '/postgres';
const temporaryUrl = new URL(env.DATABASE_URL);
temporaryUrl.pathname = `/${name}`;
const maintenance = new pg.Client({ connectionString: maintenanceUrl.toString() });
const database = new pg.Client({ connectionString: temporaryUrl.toString() });
let server: ChildProcess | undefined;
let databaseCreated = false;
let databaseConnected = false;
let checks = 0;

async function freePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  assert.ok(address !== null && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error === undefined ? resolve() : reject(error))),
  );
  return port;
}
async function validate(): Promise<void> {
  assertDevelopmentSeedAllowed(env.NODE_ENV);
  await maintenance.connect();
  try {
    await maintenance.query(`CREATE DATABASE "${name}"`);
    databaseCreated = true;
    const port = await freePort();
    const childEnv = {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: temporaryUrl.toString(),
      STORAGE_PROVIDER: 'local',
      STORAGE_LOCAL_DIRECTORY: directory,
      PORT: String(port),
      LOG_LEVEL: 'silent',
      AI_SERVICE_URL: '',
      AI_SERVICE_SECRET: '',
      N8N_WEBHOOK_URL: '',
      API_RATE_LIMIT_MAX: '10000',
    };
    for (const script of ['migrate.ts', 'seed.ts']) {
      await execute(process.execPath, ['--import', 'tsx', `src/database/${script}`], {
        env: childEnv,
      });
    }
    await database.connect();
    databaseConnected = true;
    server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      env: childEnv,
      stdio: 'ignore',
    });
    let spawnError: Error | undefined;
    server.on('error', (error) => {
      spawnError = error;
    });
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnError !== undefined) throw spawnError;
      try {
        ready = (await fetch(base + '/health')).ok;
        if (ready) break;
      } catch {
        /* Wait for listener. */
      }
      await delay(100);
    }
    assert.ok(ready, 'Servidor de validacao nao iniciou.');
    async function request<T>(
      endpoint: string,
      status = 200,
      options: RequestInit = {},
    ): Promise<T> {
      const response = await fetch(base + endpoint, options);
      assert.equal(
        response.status,
        status,
        `${options.method ?? 'GET'} ${endpoint}: expected ${status}, received ${response.status}`,
      );
      checks++;
      if (status === 204) return undefined as T;
      if (response.headers.get('content-type')?.startsWith('image/')) {
        assert.ok(response.headers.get('cache-control')?.includes('no-store'));
        return Buffer.from(await response.arrayBuffer()) as T;
      }
      return (await response.json()) as T;
    }
    async function login(email: string, password: string): Promise<Session> {
      const response = await fetch(base + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as Envelope<{ accessToken: string }>;
      return {
        token: body.data.accessToken,
        cookie: response.headers.get('set-cookie')!.split(';')[0]!,
      };
    }
    const citizen = await login('ana.cidada@example.test', 'Cidada123!Fase2');
    const operator = await login('bruno.operador@example.test', 'Operador123!Fase2');
    const otherOperator = await login('davi.operador@example.test', 'Operador123!Fase2');
    const otherCitizen = await login('carla.cidada@example.test', 'Cidada123!Fase2');
    const moderator = await login('marina.moderadora@example.test', 'Moderador123!Fase2');
    const admin = await login('adriano.admin@example.test', 'Admin123!Fase2');
    const auth = (session: Session): Record<string, string> => ({
      authorization: `Bearer ${session.token}`,
    });
    const mutation = (session: Session, method: string, body: unknown): RequestInit => ({
      method,
      headers: { ...auth(session), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const cities = await request<Envelope<{ municipalities: { id: string }[] }>>(
      '/api/v1/catalog/municipalities',
    );
    assert.equal(cities.data.municipalities.length, 2);
    await request('/api/v1/catalog/categories');
    await request(
      '/api/v1/catalog/neighborhoods?municipalityId=10000000-0000-4000-8000-000000000001',
    );
    await request('/api/v1/catalog/neighborhoods?municipalityId=invalid', 422);
    await database.query(
      `INSERT INTO municipalities (name, state, ibge_code, latitude, longitude, active) VALUES ('Catalogo inativo', 'BA', '9999999', -12, -38, false)`,
    );
    const activeCities = await request<Envelope<{ municipalities: { id: string }[] }>>(
      '/api/v1/catalog/municipalities',
    );
    assert.equal(activeCities.data.municipalities.length, 2);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2hioAAAAASUVORK5CYII=',
      'base64',
    );
    const form = new FormData();
    form.set('title', 'Validacao isolada fase onze');
    form.set('description', 'Descricao exclusiva para busca no servidor.');
    form.set('municipalityId', '10000000-0000-4000-8000-000000000001');
    form.set('latitude', '-12.9941');
    form.set('longitude', '-38.4590');
    form.set('categoryId', '30000000-0000-4000-8000-000000000001');
    form.set('neighborhoodId', '20000000-0000-4000-8000-000000000001');
    form.set('image', new Blob([png], { type: 'image/png' }), 'validation.png');
    const created = await request<Envelope<{ occurrence: Occurrence }>>(
      '/api/v1/occurrences',
      201,
      { method: 'POST', headers: auth(citizen), body: form },
    );
    const occurrenceId = created.data.occurrence.id;
    const image = created.data.occurrence.images[0]!;
    const key = (
      await database.query<{ storage_key: string }>(
        'SELECT storage_key FROM occurrence_images WHERE id = $1',
        [image.id],
      )
    ).rows[0]!.storage_key;
    const legacy = '/uploads/' + key;
    await request(image.url, 404);
    await request(legacy, 404);
    await request(image.url, 200, { headers: auth(citizen) });
    await request(image.url, 200, { headers: auth(operator) });
    await request(image.url, 404, { headers: auth(otherOperator) });
    await request(image.url, 404, { headers: auth(otherCitizen) });
    await request('/api/v1/moderation/images', 403, { headers: auth(citizen) });
    await request('/api/v1/moderation/images', 403, { headers: auth(operator) });
    const queue = await request<Envelope<{ images: { id: string }[] }>>(
      '/api/v1/moderation/images',
      200,
      { headers: auth(moderator) },
    );
    assert.ok(queue.data.images.some((item) => item.id === image.id));
    await request(
      '/api/v1/moderation/images/' + image.id,
      200,
      mutation(moderator, 'PATCH', {
        status: 'APPROVED',
        expectedStatus: 'PENDING',
        reason: 'Foto conferida no teste isolado.',
      }),
    );
    await request(
      '/api/v1/moderation/images/' + image.id,
      409,
      mutation(admin, 'PATCH', {
        status: 'REJECTED',
        expectedStatus: 'PENDING',
        reason: 'Decisao concorrente obsoleta.',
      }),
    );
    await request(image.url, 404); // Image approval alone does not publish the occurrence.
    await request(
      '/api/v1/occurrences/' + occurrenceId + '/status',
      200,
      mutation(moderator, 'PATCH', { status: 'PUBLISHED', reason: 'Revisao concluida.' }),
    );
    const publicImage = await request<Buffer>(image.url);
    assert.deepEqual(publicImage, png);
    await request(legacy);
    const found = await request<Envelope<{ occurrences: { id: string }[] }>>(
      '/api/v1/occurrences?q=exclusiva&limit=1',
    );
    assert.equal(found.data.occurrences[0]?.id, occurrenceId);
    const map = await request<Envelope<{ points: { id: string }[] }>>(
      '/api/v1/occurrences/map?q=exclusiva&category=30000000-0000-4000-8000-000000000001&neighborhood=20000000-0000-4000-8000-000000000001',
    );
    assert.equal(map.data.points[0]?.id, occurrenceId);
    const literal = await request<Envelope<{ occurrences: unknown[] }>>(
      '/api/v1/occurrences?q=%25',
    );
    assert.equal(literal.data.occurrences.length, 0);
    // Revocation must affect the same formerly public URL, including conditional requests.
    await request(
      '/api/v1/moderation/images/' + image.id,
      200,
      mutation(moderator, 'PATCH', {
        status: 'REJECTED',
        expectedStatus: 'APPROVED',
        reason: 'Revogacao de imagem para verificar bloqueio.',
      }),
    );
    await request(image.url, 404, { headers: { 'if-none-match': '*' } });
    await request(legacy, 404);
    const detail = await request<Envelope<{ occurrence: Occurrence }>>(
      '/api/v1/occurrences/' + occurrenceId,
    );
    assert.equal(detail.data.occurrence.images.length, 0);
    const audit = await database.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM audit_logs WHERE entity_id = $1 AND action = 'OCCURRENCE_IMAGE_REVIEWED'`,
      [image.id],
    );
    assert.equal(audit.rows[0]?.total, '2');
    await request(
      '/api/v1/moderation/images/' + image.id,
      200,
      mutation(moderator, 'PATCH', {
        status: 'APPROVED',
        expectedStatus: 'REJECTED',
        reason: 'Nova revisao concluida.',
      }),
    );
    const endpoint = '/api/v1/occurrences/' + occurrenceId + '/status';
    await request(
      endpoint,
      403,
      mutation(otherOperator, 'PATCH', {
        status: 'FORWARDED',
        departmentId: '40000000-0000-4000-8000-000000000001',
        expectedResolutionAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    await request(
      endpoint,
      200,
      mutation(operator, 'PATCH', {
        status: 'FORWARDED',
        departmentId: '40000000-0000-4000-8000-000000000001',
        expectedResolutionAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    for (const status of ['UNDER_ANALYSIS', 'IN_PROGRESS'])
      await request(endpoint, 200, mutation(operator, 'PATCH', { status }));
    await request(
      endpoint,
      200,
      mutation(operator, 'PATCH', {
        status: 'RESOLVED',
        resolutionDescription: 'Reparo confirmado no fluxo isolado.',
      }),
    );
    await request(
      '/api/v1/occurrences/' + occurrenceId + '/evaluations',
      201,
      mutation(citizen, 'POST', { rating: 5, problemResolved: true, comment: 'Reparo avaliado.' }),
    );
    await request('/api/v1/occurrences/' + occurrenceId, 204, {
      method: 'DELETE',
      headers: auth(admin),
    });
    await request(image.url, 404, { headers: auth(admin) });
    for (const session of [citizen, operator, otherOperator, otherCitizen, moderator, admin]) {
      await request('/api/v1/auth/logout', 204, {
        method: 'POST',
        headers: { cookie: session.cookie },
      });
    }
    console.log(
      `Fase 11: ${checks} verificacoes HTTP aprovadas em PostgreSQL isolado; auditoria e ciclo de reparo conferidos.`,
    );
  } finally {
    if (server !== undefined && server.exitCode === null) {
      const stopped = once(server, 'exit');
      server.kill('SIGTERM');
      await stopped;
    }
    if (databaseConnected) await database.end();
    if (databaseCreated) {
      await maintenance.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [name],
      );
      await maintenance.query(`DROP DATABASE IF EXISTS "${name}"`);
    }
    await maintenance.end();
    await rm(directory, { recursive: true, force: true });
  }
}
try {
  await validate();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha na validacao isolada.');
  process.exitCode = 1;
}
