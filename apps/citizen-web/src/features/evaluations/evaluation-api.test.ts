import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { setAccessToken } from '../../lib/auth-session';
import { server } from '../../tests/server';
import {
  createEvaluation,
  getEvaluationSummary,
  getOccurrenceEvaluations,
  updateMyEvaluation,
} from './evaluation-api';

const occurrenceId = '30000000-0000-4000-8000-000000000001';
const evaluation = {
  id: '72000000-0000-4000-8000-000000000001',
  occurrenceId,
  rating: 4,
  problemResolved: true,
  serviceQuality: 5,
  comment: 'Reparo bem executado.',
  isMine: true,
  createdAt: '2026-07-22T12:00:00.000Z',
  updatedAt: '2026-07-22T12:00:00.000Z',
};
const summary = {
  occurrenceId,
  occurrenceStatus: 'RESOLVED',
  total: 1,
  negativeCount: 0,
  negativePercentage: 0,
  averageRating: 4,
  averageServiceQuality: 5,
  minimumEvaluationsForContestation: 3,
  negativeThresholdPercentage: 60,
  eligibleForContestation: false,
};

afterEach(() => setAccessToken(null));

describe('API de avaliações de reparo', () => {
  it('consulta o resumo publicamente e a avaliação pessoal com JWT', async () => {
    const authorizations: Array<string | null> = [];
    server.use(
      http.get(
        `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/evaluations/summary`,
        ({ request }) => {
          authorizations.push(request.headers.get('authorization'));
          return HttpResponse.json({
            success: true,
            data: { summary },
            meta: { requestId: 'summary' },
          });
        },
      ),
      http.get(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/evaluations`, ({ request }) => {
        authorizations.push(request.headers.get('authorization'));
        return HttpResponse.json({
          success: true,
          data: { evaluations: [evaluation] },
          meta: { requestId: 'list', page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }),
    );

    await expect(getEvaluationSummary(occurrenceId)).resolves.toMatchObject({ total: 1 });
    setAccessToken('access-token');
    await expect(getOccurrenceEvaluations(occurrenceId)).resolves.toEqual([evaluation]);
    expect(authorizations).toEqual([null, 'Bearer access-token']);
  });

  it('cria e atualiza a avaliação com o contrato esperado', async () => {
    setAccessToken('access-token');
    const methods: string[] = [];
    const handler = async ({ request }: { request: Request }) => {
      methods.push(`${request.method}:${request.headers.get('authorization')}`);
      expect(await request.json()).toEqual({
        rating: 4,
        problemResolved: true,
        serviceQuality: 5,
        comment: 'Reparo bem executado.',
      });
      return HttpResponse.json({
        success: true,
        data: { evaluation, summary, occurrenceContested: false },
        meta: { requestId: 'mutation' },
      });
    };
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/evaluations`, handler),
      http.patch(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/evaluations/me`, handler),
    );
    const input = {
      rating: 4,
      problemResolved: true,
      serviceQuality: 5,
      comment: 'Reparo bem executado.',
    };

    await expect(createEvaluation(occurrenceId, input)).resolves.toMatchObject({ evaluation });
    await expect(updateMyEvaluation(occurrenceId, input)).resolves.toMatchObject({ evaluation });
    expect(methods).toEqual(['POST:Bearer access-token', 'PATCH:Bearer access-token']);
  });
});
