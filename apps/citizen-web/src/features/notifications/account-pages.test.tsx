import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { authUserFixture, sessionFixture } from '../../tests/auth-fixtures';
import { publicOccurrenceFixture } from '../../tests/occurrence-fixtures';
import { renderApp } from '../../tests/render-app';
import { server } from '../../tests/server';

function authenticate() {
  server.use(
    http.post(`${env.apiBaseUrl}/api/v1/auth/refresh`, () => HttpResponse.json(sessionFixture())),
  );
}

describe('conta e notificações da cidadã', () => {
  it('alterna entre ocorrências criadas e confirmadas', async () => {
    const user = userEvent.setup();
    authenticate();
    renderApp('/minhas-ocorrencias');

    expect(
      await screen.findByRole('heading', { name: 'Ocorrências criadas' }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Buraco na Rua das Flores')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Eu também vi' }));
    expect(
      await screen.findByRole('heading', { name: 'Ocorrências confirmadas' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Poste apagado na avenida')).toBeInTheDocument();
  });

  it('exibe o estado vazio das atividades sem perder a navegação', async () => {
    authenticate();
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/occurrences/mine`, () =>
        HttpResponse.json({
          success: true,
          data: { occurrences: [] },
          meta: { requestId: 'empty-mine', page: 1, limit: 6, total: 0, totalPages: 0 },
        }),
      ),
    );
    renderApp('/minhas-ocorrencias');

    expect(
      await screen.findByRole('heading', { name: 'Nada por aqui ainda' }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Eu também vi' })).toBeEnabled();
  });

  it('marca uma notificação como lida e abre a ocorrência relacionada', async () => {
    const user = userEvent.setup();
    authenticate();
    let isRead = false;
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/notifications`, () =>
        HttpResponse.json({
          success: true,
          data: {
            notifications: [
              {
                id: '71000000-0000-4000-8000-000000000001',
                userId: authUserFixture.id,
                type: 'STATUS_CHANGED',
                title: 'Ocorrência em análise',
                message: 'A equipe iniciou a análise.',
                entityType: 'occurrence',
                entityId: publicOccurrenceFixture.id,
                readAt: isRead ? '2026-07-22T12:10:00.000Z' : null,
                createdAt: '2026-07-22T12:00:00.000Z',
              },
            ],
            pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
          },
          meta: { requestId: 'notifications-stateful' },
        }),
      ),
      http.patch(`${env.apiBaseUrl}/api/v1/notifications/:notificationId/read`, () => {
        isRead = true;
        return HttpResponse.json({
          success: true,
          data: {
            notification: {
              id: '71000000-0000-4000-8000-000000000001',
              userId: authUserFixture.id,
              type: 'STATUS_CHANGED',
              title: 'Ocorrência em análise',
              message: 'A equipe iniciou a análise.',
              entityType: 'occurrence',
              entityId: publicOccurrenceFixture.id,
              readAt: '2026-07-22T12:10:00.000Z',
              createdAt: '2026-07-22T12:00:00.000Z',
            },
          },
          meta: { requestId: 'notification-read' },
        });
      }),
    );
    const { router } = renderApp('/notificacoes');

    await user.click(
      await screen.findByRole('button', { name: 'Ver ocorrência' }, { timeout: 5_000 }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/ocorrencias/${publicOccurrenceFixture.id}`),
    );
    expect(isRead).toBe(true);
  });

  it('mostra estado vazio quando não existem notificações não lidas', async () => {
    authenticate();
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/notifications`, () =>
        HttpResponse.json({
          success: true,
          data: { notifications: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 0 } },
          meta: { requestId: 'empty-notifications' },
        }),
      ),
    );
    renderApp('/notificacoes?filtro=nao-lidas');

    expect(
      await screen.findByRole('heading', { name: 'Tudo acompanhado' }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/não tem notificações pendentes/i)).toBeInTheDocument();
  });
});
