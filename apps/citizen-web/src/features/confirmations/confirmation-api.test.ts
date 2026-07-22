import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { setAccessToken } from '../../lib/auth-session';
import { server } from '../../tests/server';
import { createConfirmation, getConfirmationState, removeMyConfirmation } from './confirmation-api';

afterEach(() => setAccessToken(null));

describe('API de confirmações comunitárias', () => {
  it('consulta a contagem publicamente e inclui JWT apenas para a visão pessoal', async () => {
    const authorizations: Array<string | null> = [];
    server.use(
      http.get(
        `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations/count`,
        ({ params, request }) => {
          authorizations.push(request.headers.get('authorization'));
          return HttpResponse.json({
            success: true,
            data: {
              occurrenceId: params.occurrenceId,
              confirmationCount: 18,
              priorityScore: 82.4,
              ...(request.headers.has('authorization') ? { confirmedByMe: true } : {}),
            },
            meta: { requestId: 'confirmation-count' },
          });
        },
      ),
    );

    const occurrenceId = '30000000-0000-4000-8000-000000000001';
    await expect(getConfirmationState(occurrenceId, false)).resolves.not.toHaveProperty(
      'confirmedByMe',
    );
    setAccessToken('access-token');
    await expect(getConfirmationState(occurrenceId, true)).resolves.toMatchObject({
      confirmedByMe: true,
    });
    expect(authorizations).toEqual([null, 'Bearer access-token']);
  });

  it('confirma e remove somente com autenticação', async () => {
    setAccessToken('access-token');
    const methods: string[] = [];
    server.use(
      http.post(
        `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations`,
        async ({ params, request }) => {
          methods.push(`${request.method}:${request.headers.get('authorization')}`);
          expect(await request.json()).toEqual({
            directlyAffected: false,
            problemWorsened: false,
            comment: null,
          });
          return HttpResponse.json(
            {
              success: true,
              data: {
                confirmation: {
                  id: '41000000-0000-4000-8000-000000000001',
                  occurrenceId: params.occurrenceId,
                  directlyAffected: false,
                  problemWorsened: false,
                  comment: null,
                  createdAt: '2026-07-22T12:00:00.000Z',
                  updatedAt: '2026-07-22T12:00:00.000Z',
                },
                occurrence: { confirmationCount: 19, priorityScore: 83.1 },
              },
              meta: { requestId: 'confirmation-created' },
            },
            { status: 201 },
          );
        },
      ),
      http.delete(
        `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations/me`,
        ({ request }) => {
          methods.push(`${request.method}:${request.headers.get('authorization')}`);
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    const occurrenceId = '30000000-0000-4000-8000-000000000001';
    await expect(createConfirmation(occurrenceId)).resolves.toMatchObject({
      occurrence: { confirmationCount: 19 },
    });
    await expect(removeMyConfirmation(occurrenceId)).resolves.toBeUndefined();
    expect(methods).toEqual(['POST:Bearer access-token', 'DELETE:Bearer access-token']);
  });
});
