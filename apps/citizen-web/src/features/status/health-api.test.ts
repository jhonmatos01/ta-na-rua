import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { getApiHealth, getDatabaseHealth } from './health-api';
import { server } from '../../tests/server';

describe('health API', () => {
  it('aceita o contrato real do endpoint de saúde', async () => {
    await expect(getApiHealth()).resolves.toMatchObject({
      success: true,
      data: { status: 'ok' },
      meta: { requestId: 'test-api-request' },
    });
  });

  it('aceita o contrato real da saúde do banco', async () => {
    await expect(getDatabaseHealth()).resolves.toMatchObject({
      success: true,
      data: { status: 'connected', responseTimeMs: 8 },
    });
  });

  it('rejeita uma resposta de sucesso fora do contrato', async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/health`, () =>
        HttpResponse.json({
          success: true,
          data: { status: 'unknown' },
          meta: { requestId: 'invalid' },
        }),
      ),
    );

    await expect(getApiHealth()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 200,
    });
  });

  it('preserva status e requestId de uma falha padronizada', async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/health/database`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable' },
            meta: { requestId: 'failed-request' },
          },
          { status: 503 },
        ),
      ),
    );

    await expect(getDatabaseHealth()).rejects.toMatchObject({
      code: 'SERVER_ERROR',
      status: 503,
      requestId: 'failed-request',
    });
  });

  it('classifica uma resposta não JSON como inválida', async () => {
    server.use(
      http.get(
        `${env.apiBaseUrl}/health`,
        () => new HttpResponse('<html>erro</html>', { status: 502 }),
      ),
    );

    await expect(getApiHealth()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
    });
  });
});
