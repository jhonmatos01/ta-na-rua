import { http, HttpResponse } from 'msw';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { env } from '../config/env';
import { sessionFixture } from '../tests/auth-fixtures';
import { publicOccurrenceFixture } from '../tests/occurrence-fixtures';
import { renderApp } from '../tests/render-app';
import { server } from '../tests/server';

const resolvedOccurrence = { ...publicOccurrenceFixture, status: 'RESOLVED' as const };

function authenticate() {
  server.use(
    http.post(`${env.apiBaseUrl}/api/v1/auth/refresh`, () => HttpResponse.json(sessionFixture())),
    http.get(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId`, () =>
      HttpResponse.json({
        success: true,
        data: { occurrence: resolvedOccurrence },
        meta: { requestId: 'resolved-occurrence' },
      }),
    ),
  );
}

describe('página de avaliação do reparo', () => {
  it('envia nota, confirmação da solução e comentário', async () => {
    const user = userEvent.setup();
    authenticate();
    let submitted: unknown;
    server.use(
      http.post(
        `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/evaluations`,
        async ({ request }) => {
          submitted = await request.json();
          return HttpResponse.json({
            success: true,
            data: {
              evaluation: {
                id: '72000000-0000-4000-8000-000000000001',
                occurrenceId: resolvedOccurrence.id,
                rating: 4,
                problemResolved: true,
                serviceQuality: null,
                comment: 'O asfalto ficou nivelado.',
                isMine: true,
                createdAt: '2026-07-22T12:00:00.000Z',
                updatedAt: '2026-07-22T12:00:00.000Z',
              },
              summary: {
                occurrenceId: resolvedOccurrence.id,
                occurrenceStatus: 'RESOLVED',
                total: 1,
                negativeCount: 0,
                negativePercentage: 0,
                averageRating: 4,
                averageServiceQuality: null,
                minimumEvaluationsForContestation: 3,
                negativeThresholdPercentage: 60,
                eligibleForContestation: false,
              },
              occurrenceContested: false,
            },
            meta: { requestId: 'evaluation-created' },
          });
        },
      ),
    );
    renderApp(`/avaliar/${resolvedOccurrence.id}`);

    expect(
      await screen.findByRole('heading', { name: 'Como ficou o reparo?' }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('group', { name: 'Nota geral do reparo' })).getByRole('radio', {
        name: '4',
      }),
    );
    await user.click(screen.getByRole('radio', { name: 'Sim, foi resolvido' }));
    await user.type(
      screen.getByRole('textbox', { name: /comentário/i }),
      'O asfalto ficou nivelado.',
    );
    await user.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    expect(await screen.findByText('Avaliação enviada com sucesso.')).toBeInTheDocument();
    expect(submitted).toEqual({
      rating: 4,
      problemResolved: true,
      serviceQuality: null,
      comment: 'O asfalto ficou nivelado.',
    });
  });

  it('traduz a proibição da API para quem não está relacionado', async () => {
    authenticate();
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/evaluations`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'EVALUATIONS_FORBIDDEN', message: 'Acesso negado.' },
            meta: { requestId: 'forbidden-evaluations' },
          },
          { status: 403 },
        ),
      ),
    );
    renderApp(`/avaliar/${resolvedOccurrence.id}`);

    expect(
      await screen.findByRole('heading', { name: 'Avaliação não permitida' }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/não tem permissão para consultar/i)).toBeInTheDocument();
  });
});
