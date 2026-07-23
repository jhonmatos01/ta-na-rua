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
  http.get(`${env.apiBaseUrl}/api/v1/occurrences/mine`, () =>
    HttpResponse.json({
      success: true,
      data: { occurrences: [publicOccurrenceFixture] },
      meta: {
        requestId: 'test-my-occurrences-request',
        page: 1,
        limit: 6,
        total: 1,
        totalPages: 1,
      },
    }),
  ),
  http.get(`${env.apiBaseUrl}/api/v1/occurrences/confirmed-by-me`, () =>
    HttpResponse.json({
      success: true,
      data: { occurrences: [secondPublicOccurrenceFixture] },
      meta: {
        requestId: 'test-confirmed-occurrences-request',
        page: 1,
        limit: 6,
        total: 1,
        totalPages: 1,
      },
    }),
  ),
  http.get(`${env.apiBaseUrl}/api/v1/occurrences/pending-evaluations`, () =>
    HttpResponse.json({
      success: true,
      data: { occurrences: [{ ...publicOccurrenceFixture, status: 'RESOLVED' }] },
      meta: {
        requestId: 'test-pending-evaluations-request',
        page: 1,
        limit: 6,
        total: 1,
        totalPages: 1,
      },
    }),
  ),
  http.get(`${env.apiBaseUrl}/api/v1/notifications/unread-count`, () =>
    HttpResponse.json({
      success: true,
      data: { unreadCount: 2 },
      meta: { requestId: 'test-unread-count-request' },
    }),
  ),
  http.get(`${env.apiBaseUrl}/api/v1/notifications`, () =>
    HttpResponse.json({
      success: true,
      data: {
        notifications: [
          {
            id: '71000000-0000-4000-8000-000000000001',
            userId: '11000000-0000-4000-8000-000000000001',
            type: 'STATUS_CHANGED',
            title: 'Ocorrência em análise',
            message: 'A equipe responsável iniciou a análise do seu registro.',
            entityType: 'occurrence',
            entityId: publicOccurrenceFixture.id,
            readAt: null,
            createdAt: '2026-07-22T12:00:00.000Z',
          },
        ],
        pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
      },
      meta: { requestId: 'test-notifications-request' },
    }),
  ),
  http.patch(`${env.apiBaseUrl}/api/v1/notifications/read-all`, () =>
    HttpResponse.json({
      success: true,
      data: { markedAsRead: 1 },
      meta: { requestId: 'test-read-all-request' },
    }),
  ),
  http.patch(`${env.apiBaseUrl}/api/v1/notifications/:notificationId/read`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        notification: {
          id: params.notificationId,
          userId: '11000000-0000-4000-8000-000000000001',
          type: 'STATUS_CHANGED',
          title: 'Ocorrência em análise',
          message: 'A equipe responsável iniciou a análise do seu registro.',
          entityType: 'occurrence',
          entityId: publicOccurrenceFixture.id,
          readAt: '2026-07-22T12:10:00.000Z',
          createdAt: '2026-07-22T12:00:00.000Z',
        },
      },
      meta: { requestId: 'test-read-notification-request' },
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
  http.get(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/evaluations`, () =>
    HttpResponse.json({
      success: true,
      data: { evaluations: [] },
      meta: { requestId: 'test-evaluations-request', page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
  ),
  http.get(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/evaluations/summary`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        summary: {
          occurrenceId: params.occurrenceId,
          occurrenceStatus: 'RESOLVED',
          total: 0,
          negativeCount: 0,
          negativePercentage: 0,
          averageRating: null,
          averageServiceQuality: null,
          minimumEvaluationsForContestation: 3,
          negativeThresholdPercentage: 60,
          eligibleForContestation: false,
        },
      },
      meta: { requestId: 'test-evaluation-summary-request' },
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
