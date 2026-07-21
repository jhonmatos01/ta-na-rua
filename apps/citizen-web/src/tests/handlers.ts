import { http, HttpResponse } from 'msw';

import { env } from '../config/env';

export const handlers = [
  http.get(`${env.apiBaseUrl}/health`, () =>
    HttpResponse.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: '2026-07-20T21:00:00.000Z',
      },
      meta: {
        requestId: 'test-api-request',
      },
    }),
  ),
  http.get(`${env.apiBaseUrl}/health/database`, () =>
    HttpResponse.json({
      success: true,
      data: {
        status: 'connected',
        postgisVersion: '3.6.1',
        responseTimeMs: 8,
      },
      meta: {
        requestId: 'test-database-request',
      },
    }),
  ),
];
