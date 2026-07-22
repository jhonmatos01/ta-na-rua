import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import type { DatabaseHealth } from '../../src/database/health.js';
import type { DatabaseHealthCheck } from '../../src/modules/health/health.routes.js';
import { InMemoryApiRateLimiter } from '../../src/shared/middleware/api-rate-limit.js';

interface ResponseMeta {
  requestId: string;
}

interface ApiHealthBody {
  success: true;
  data: {
    status: 'ok';
    timestamp: string;
  };
  meta: ResponseMeta;
}

interface DatabaseHealthBody {
  success: true;
  data: DatabaseHealth;
  meta: ResponseMeta;
}

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  meta: ResponseMeta;
}

describe('aplicacao HTTP', () => {
  const databaseHealthCheck = vi.fn<DatabaseHealthCheck>();

  beforeEach(() => {
    databaseHealthCheck.mockReset();
    databaseHealthCheck.mockResolvedValue({
      status: 'connected',
      postgisVersion: '3.5.2',
      responseTimeMs: 2.5,
    });
  });

  it('responde ao health da API com request ID', async () => {
    const response = await request(createApp({ databaseHealthCheck })).get('/health').expect(200);
    const body = response.body as ApiHealthBody;
    const responseRequestId = response.headers['x-request-id'];

    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(Date.parse(body.data.timestamp)).not.toBeNaN();
    expect(responseRequestId).toBeTypeOf('string');
    expect(body.meta.requestId).toBe(responseRequestId);
  });

  it('preserva um request ID valido fornecido pelo cliente', async () => {
    const requestId = 'integration-test-request';
    const response = await request(createApp({ databaseHealthCheck }))
      .get('/health')
      .set('x-request-id', requestId)
      .expect(200);
    const body = response.body as ApiHealthBody;

    expect(response.headers['x-request-id']).toBe(requestId);
    expect(body.meta.requestId).toBe(requestId);
  });

  it('confirma PostgreSQL e PostGIS', async () => {
    const response = await request(createApp({ databaseHealthCheck }))
      .get('/health/database')
      .expect(200);
    const body = response.body as DatabaseHealthBody;

    expect(databaseHealthCheck).toHaveBeenCalledOnce();
    expect(body).toMatchObject({
      success: true,
      data: {
        status: 'connected',
        postgisVersion: '3.5.2',
      },
    });
  });

  it('retorna 503 padronizado quando o banco esta indisponivel', async () => {
    databaseHealthCheck.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp({ databaseHealthCheck }))
      .get('/health/database')
      .expect(503);
    const body = response.body as ErrorBody;

    expect(body.success).toBe(false);
    expect(body.error).toEqual({
      code: 'DATABASE_UNAVAILABLE',
      message: 'O banco de dados esta temporariamente indisponivel.',
      details: {},
    });
    expect(body.meta.requestId).toBe(response.headers['x-request-id']);
  });

  it('retorna 404 padronizado para uma rota inexistente', async () => {
    const response = await request(createApp({ databaseHealthCheck }))
      .get('/rota-inexistente')
      .expect(404);
    const body = response.body as ErrorBody;

    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(body.meta.requestId).toBe(response.headers['x-request-id']);
  });

  it('retorna 400 padronizado para JSON malformado', async () => {
    const response = await request(createApp({ databaseHealthCheck }))
      .post('/health')
      .set('content-type', 'application/json')
      .send('{"incompleto":')
      .expect(400);
    const body = response.body as ErrorBody;

    expect(body.error.code).toBe('INVALID_JSON');
  });

  it('aplica limite global somente nas rotas da API e retorna headers padronizados', async () => {
    const app = createApp({
      databaseHealthCheck,
      apiRateLimiter: new InMemoryApiRateLimiter(2, 60),
    });

    await request(app).get('/api/v1/auth/me').expect(401).expect('RateLimit-Remaining', '1');
    await request(app).get('/api/v1/auth/me').expect(401).expect('RateLimit-Remaining', '0');
    const limited = await request(app)
      .get('/api/v1/auth/me')
      .expect(429)
      .expect('Retry-After', '60');

    expect((limited.body as ErrorBody).error.code).toBe('API_RATE_LIMITED');
    await request(app).get('/health').expect(200);
    await request(app).get('/docs/openapi.json').expect(200);
  });

  it('publica a especificacao OpenAPI e a interface Swagger', async () => {
    const app = createApp({ databaseHealthCheck });
    const specificationResponse = await request(app).get('/docs/openapi.json').expect(200);
    const specification = specificationResponse.body as {
      openapi: string;
      info: { version: string };
      paths: Record<string, unknown>;
    };

    expect(specification.openapi).toBe('3.0.3');
    expect(specification.info.version).toBe('1.0.0');
    expect(Object.keys(specification.paths)).toHaveLength(52);
    expect(specification.paths).toHaveProperty('/health');
    expect(specification.paths).toHaveProperty('/health/database');
    expect(specification.paths).toHaveProperty('/api/v1/occurrences/{occurrenceId}/status');
    expect(specification.paths).toHaveProperty('/api/v1/occurrences/{occurrenceId}/status-history');
    expect(specification.paths).toHaveProperty('/api/v1/departments');
    expect(specification.paths).toHaveProperty('/api/v1/occurrences/{occurrenceId}/evaluations');
    expect(specification.paths).toHaveProperty(
      '/api/v1/occurrences/{occurrenceId}/evaluations/summary',
    );
    expect(specification.paths).toHaveProperty('/api/v1/internal/ai/classify');
    expect(specification.paths).toHaveProperty('/api/v1/internal/ai/find-duplicates');
    expect(specification.paths).toHaveProperty('/api/v1/internal/ai/recalculate-priority');
    expect(specification.paths).toHaveProperty('/api/v1/dashboard/summary');
    expect(specification.paths).toHaveProperty('/api/v1/dashboard/by-category');
    expect(specification.paths).toHaveProperty('/api/v1/dashboard/by-neighborhood');
    expect(specification.paths).toHaveProperty('/api/v1/dashboard/by-status');
    expect(specification.paths).toHaveProperty('/api/v1/dashboard/priority-ranking');
    expect(specification.paths).toHaveProperty('/api/v1/dashboard/resolution-time');
    expect(specification.paths).toHaveProperty('/api/v1/dashboard/heatmap');
    expect(specification.paths).toHaveProperty('/api/v1/dashboard/export');
    expect(specification.paths).toHaveProperty('/api/v1/notifications');
    expect(specification.paths).toHaveProperty('/api/v1/notifications/unread-count');
    expect(specification.paths).toHaveProperty('/api/v1/notifications/{notificationId}/read');
    expect(specification.paths).toHaveProperty('/api/v1/notifications/read-all');
    expect(specification.paths).toHaveProperty('/api/v1/webhooks/telegram/report');
    expect(specification.paths).toHaveProperty('/api/v1/webhooks/whatsapp/report');
    expect(specification.paths).toHaveProperty('/api/v1/webhooks/status-update');
    expect(specification.paths).toHaveProperty('/api/v1/webhooks/n8n/events');
    await request(app).get('/docs/').expect(200);
  });
});
