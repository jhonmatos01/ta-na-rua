import { http, HttpResponse } from 'msw';

import { env } from '../config/env';
import {
  createdOccurrenceFixture,
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
  http.get(`${env.apiBaseUrl}/api/v1/occurrences/nearby`, () =>
    HttpResponse.json({
      success: true,
      data: { occurrences: [] },
      meta: {
        requestId: 'test-nearby-request',
        page: 1,
        limit: 5,
        total: 0,
        totalPages: 0,
      },
    }),
  ),
  http.post(`${env.apiBaseUrl}/api/v1/geocoding/reverse`, () =>
    HttpResponse.json({
      success: true,
      data: {
        address: {
          street: 'Rua das Flores',
          houseNumber: '123',
          streetAddress: 'Rua das Flores, 123',
          neighborhood: 'Pituba',
          city: 'Salvador',
          state: 'Bahia',
          postcode: '41830-000',
          countryCode: 'BR',
          formattedAddress: 'Rua das Flores, 123 · Pituba · Salvador · Bahia',
          provider: {
            name: 'OpenStreetMap',
            text: '© OpenStreetMap contributors',
            url: 'https://www.openstreetmap.org/copyright',
          },
        },
      },
      meta: { requestId: 'test-geocoding-request' },
    }),
  ),
  http.post(`${env.apiBaseUrl}/api/v1/occurrences`, () =>
    HttpResponse.json(
      {
        success: true,
        data: { occurrence: createdOccurrenceFixture },
        meta: { requestId: 'test-create-occurrence-request' },
      },
      { status: 201 },
    ),
  ),
  http.post(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations`, ({ params }) =>
    HttpResponse.json(
      {
        success: true,
        data: {
          confirmation: {
            id: '41000000-0000-4000-8000-000000000001',
            occurrenceId: params.occurrenceId,
            directlyAffected: false,
            problemWorsened: false,
            comment: null,
            createdAt: '2026-07-21T12:00:00.000Z',
            updatedAt: '2026-07-21T12:00:00.000Z',
          },
          occurrence: { confirmationCount: 19, priorityScore: 83.1 },
        },
        meta: { requestId: 'test-confirmation-request' },
      },
      { status: 201 },
    ),
  ),
  http.delete(
    `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations/me`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.get(
    `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations/count`,
    ({ params, request }) =>
      HttpResponse.json({
        success: true,
        data: {
          occurrenceId: params.occurrenceId,
          confirmationCount: 18,
          priorityScore: 82.4,
          ...(request.headers.has('authorization') ? { confirmedByMe: false } : {}),
        },
        meta: { requestId: 'test-confirmation-state-request' },
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
