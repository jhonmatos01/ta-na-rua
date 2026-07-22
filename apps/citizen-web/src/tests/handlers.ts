import { http, HttpResponse } from 'msw';

import { env } from '../config/env';
import {
  mapPointFixtures,
  publicOccurrenceFixture,
  secondPublicOccurrenceFixture,
  timelineFixtures,
} from './occurrence-fixtures';

export const handlers = [
  http.post(`${env.apiBaseUrl}/api/v1/auth/refresh`, () =>
    HttpResponse.json(
      {
        success: false,
        error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'Sessão não encontrada.' },
        meta: { requestId: 'test-refresh-request' },
      },
      { status: 401 },
    ),
  ),
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
  http.get(`${env.apiBaseUrl}/api/v1/occurrences/map`, () =>
    HttpResponse.json({
      success: true,
      data: { points: mapPointFixtures },
      meta: { requestId: 'test-map-request' },
    }),
  ),
  http.get(`${env.apiBaseUrl}/api/v1/occurrences`, () =>
    HttpResponse.json({
      success: true,
      data: {
        occurrences: [publicOccurrenceFixture, secondPublicOccurrenceFixture],
      },
      meta: {
        requestId: 'test-occurrences-request',
        page: 1,
        limit: 100,
        total: 2,
        totalPages: 1,
      },
    }),
  ),
  http.get(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/timeline`, () =>
    HttpResponse.json({
      success: true,
      data: { timeline: timelineFixtures },
      meta: { requestId: 'test-timeline-request' },
    }),
  ),
  http.get(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId`, () =>
    HttpResponse.json({
      success: true,
      data: { occurrence: publicOccurrenceFixture },
      meta: { requestId: 'test-occurrence-request' },
    }),
  ),
];
