import { http, HttpResponse, delay } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../config/env';
import { authUserFixture, sessionFixture } from '../tests/auth-fixtures';
import { createdOccurrenceFixture, publicOccurrenceFixture } from '../tests/occurrence-fixtures';
import { renderApp } from '../tests/render-app';
import { server } from '../tests/server';

vi.mock('../components/report-location-picker', () => ({
  ReportLocationPicker: ({ value }: { value: { latitude: number; longitude: number } }) => (
    <div aria-label="Mapa para corrigir a localização do problema">
      {value.latitude}, {value.longitude}
    </div>
  ),
}));

const originalGeolocation = navigator.geolocation;

afterEach(() => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: originalGeolocation,
  });
});

function authenticate() {
  server.use(
    http.post(`${env.apiBaseUrl}/api/v1/auth/refresh`, () =>
      HttpResponse.json(sessionFixture(authUserFixture)),
    ),
  );
}

async function reachReview() {
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: /mostre onde a cidade precisa/i }, { timeout: 5_000 });
  await user.upload(
    screen.getByLabelText('Foto do problema'),
    new File(['imagem'], 'buraco.jpg', { type: 'image/jpeg' }),
  );
  await user.type(screen.getByLabelText('Título do problema'), 'Buraco próximo à escola');
  await user.click(screen.getByRole('button', { name: 'Continuar para localização' }));
  await user.click(screen.getByRole('button', { name: 'Marcar manualmente' }));
  await user.click(screen.getByRole('button', { name: 'Revisar registro' }));
  await screen.findByRole('heading', { name: 'Problemas próximos' });
  return user;
}

describe('NewOccurrencePage', () => {
  it('protege a rota para cidadãos autenticados', async () => {
    const { router } = renderApp('/nova-ocorrencia');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'), {
      timeout: 5_000,
    });
  });

  it('envia foto e localização uma única vez e exibe o protocolo', async () => {
    authenticate();
    let submissions = 0;
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/occurrences`, async () => {
        submissions += 1;
        await delay(30);
        return HttpResponse.json(
          {
            success: true,
            data: { occurrence: createdOccurrenceFixture },
            meta: { requestId: 'created-once' },
          },
          { status: 201 },
        );
      }),
    );

    renderApp('/nova-ocorrencia');
    const user = await reachReview();
    await screen.findByText(/nenhum problema público foi encontrado/i);
    const submit = screen.getByRole('button', { name: 'Enviar ocorrência' });
    await Promise.all([user.click(submit), user.click(submit)]);

    expect(await screen.findByText('TNR-2026-000099')).toBeVisible();
    expect(screen.getByText(/ainda não aparece no mapa nem na lista pública/i)).toBeVisible();
    expect(submissions).toBe(1);
  });

  it('descarta localização em cache e avisa quando a precisão do dispositivo é baixa', async () => {
    authenticate();
    const getCurrentPosition = vi.fn(
      (success: PositionCallback, _error?: PositionErrorCallback, options?: PositionOptions) => {
        success({
          coords: {
            accuracy: 840,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            latitude: -12.7953,
            longitude: -38.3955,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        });
        expect(options).toEqual({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
      },
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    renderApp('/nova-ocorrencia');
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: /mostre onde a cidade precisa/i });
    await user.upload(
      screen.getByLabelText('Foto do problema'),
      new File(['imagem'], 'buraco.jpg', { type: 'image/jpeg' }),
    );
    await user.type(screen.getByLabelText('Título do problema'), 'Buraco próximo à escola');
    await user.click(screen.getByRole('button', { name: 'Continuar para localização' }));
    await user.click(screen.getByRole('button', { name: 'Usar minha localização' }));

    expect(await screen.findByText(/margem aproximada de 840 m/i)).toBeVisible();
    expect(screen.getByText(/precisão informada pelo dispositivo: cerca de 840 m/i)).toBeVisible();
    expect(await screen.findByText(/endereço aproximado encontrado/i)).toBeVisible();
    expect(screen.getByLabelText(/endereço ou referência/i)).toHaveValue('Rua das Flores, 123');
    expect(screen.getByLabelText(/^bairro/i)).toHaveValue('Pituba');
    expect(screen.getByRole('link', { name: /openstreetmap contributors/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tentar melhorar precisão' })).toBeVisible();
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it('apresenta candidato próximo e associa a confirmação ao registro existente', async () => {
    authenticate();
    let confirmations = 0;
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/occurrences/nearby`, () =>
        HttpResponse.json({
          success: true,
          data: { occurrences: [publicOccurrenceFixture] },
          meta: { requestId: 'nearby', page: 1, limit: 5, total: 1, totalPages: 1 },
        }),
      ),
      http.post(
        `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations`,
        ({ params }) => {
          confirmations += 1;
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
                  createdAt: '2026-07-21T12:00:00.000Z',
                  updatedAt: '2026-07-21T12:00:00.000Z',
                },
                occurrence: { confirmationCount: 19, priorityScore: 83.1 },
              },
              meta: { requestId: 'confirmed' },
            },
            { status: 201 },
          );
        },
      ),
    );

    renderApp('/nova-ocorrencia');
    const user = await reachReview();
    expect(await screen.findByText(publicOccurrenceFixture.title)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'É o mesmo problema' }));

    expect(
      await screen.findByRole('heading', { name: /fortaleceu o chamado existente/i }),
    ).toBeVisible();
    expect(confirmations).toBe(1);
  });
});
