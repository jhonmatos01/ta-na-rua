import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../../config/env';
import { sessionFixture } from '../../tests/auth-fixtures';
import { renderApp } from '../../tests/render-app';
import { server } from '../../tests/server';

vi.mock('../../components/public-occurrences-map', () => ({
  PublicOccurrencesMap: ({
    points,
    onSelect,
  }: {
    points: Array<{ id: string }>;
    onSelect: (occurrenceId: string) => void;
  }) => (
    <div aria-label="Mapa interativo de ocorrências públicas">
      <span>{points.length} pontos no mapa simulado</span>
      {points[0] ? (
        <button type="button" onClick={() => onSelect(points[0]!.id)}>
          Abrir primeiro ponto
        </button>
      ) : null}
    </div>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mapa público e detalhes', () => {
  it('retorna à ocorrência depois do login iniciado pelo botão de confirmação', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/auth/login`, () => HttpResponse.json(sessionFixture())),
    );
    const occurrencePath = '/ocorrencias/30000000-0000-4000-8000-000000000001';
    const { router } = renderApp(occurrencePath);

    const community = await screen.findByRole(
      'region',
      { name: /você também viu este problema/i },
      { timeout: 10_000 },
    );
    await user.click(within(community).getByRole('link', { name: /entre para confirmar/i }));
    await user.type(screen.getByLabelText(/^E-mail/i), 'ana@example.test');
    await user.type(screen.getByLabelText(/^Senha/i), 'SenhaForte123!');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe(occurrencePath));
    expect(await screen.findByRole('button', { name: /eu também vi/i })).toBeInTheDocument();
  });

  it('lista dados reais e abre os detalhes públicos pelo marcador', async () => {
    const user = userEvent.setup();
    renderApp('/mapa');

    expect(
      await screen.findByRole(
        'heading',
        { name: /o que está acontecendo na cidade/i },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('Buraco na Rua das Flores')).toBeInTheDocument();
    expect(screen.getByText('2 pontos no mapa simulado')).toBeInTheDocument();
    expect(screen.getByText(/posições e os endereços são aproximados/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /abrir primeiro ponto/i }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Buraco na Rua das Flores' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Equipe responsável iniciou o atendimento.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/não publica autoria, coordenadas exatas/i)).toBeInTheDocument();
  });

  it('aplica busca textual sobre a janela pública carregada', async () => {
    const user = userEvent.setup();
    renderApp('/mapa');
    await screen.findByText('Buraco na Rua das Flores');

    await user.type(screen.getByLabelText('Buscar'), 'poste');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(await screen.findByText('Poste apagado na avenida')).toBeInTheDocument();
    expect(screen.queryByText('Buraco na Rua das Flores')).not.toBeInTheDocument();
    expect(screen.getByText('1 pontos no mapa simulado')).toBeInTheDocument();
  });

  it('envia categoria, status e bairro pelos filtros suportados', async () => {
    const user = userEvent.setup();
    const filteredRequests: URL[] = [];
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/occurrences`, ({ request }) => {
        filteredRequests.push(new URL(request.url));
        return HttpResponse.json({
          success: true,
          data: { occurrences: [] },
          meta: {
            requestId: 'filters-request',
            page: 1,
            limit: 100,
            total: 0,
            totalPages: 0,
          },
        });
      }),
    );
    renderApp('/mapa?categoria=categoria-teste&status=RESOLVED&bairro=Centro');

    await screen.findByText('Nenhuma ocorrência encontrada');
    await waitFor(() =>
      expect(
        filteredRequests.some(
          (url) =>
            url.searchParams.get('category') === 'categoria-teste' &&
            url.searchParams.get('status') === 'RESOLVED' &&
            url.searchParams.get('neighborhood') === 'Centro',
        ),
      ).toBe(true),
    );
    expect(screen.getByLabelText('Categoria')).toHaveValue('categoria-teste');
    expect(screen.getByLabelText('Status')).toHaveValue('RESOLVED');
    expect(screen.getByLabelText('Bairro')).toHaveValue('Centro');

    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('oferece busca manual quando a localização do navegador é negada', async () => {
    const user = userEvent.setup();
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const deniedGeolocation = {
      getCurrentPosition: vi.fn((_success: PositionCallback, error?: PositionErrorCallback) =>
        error?.({ code: 1, message: 'permission denied' } as GeolocationPositionError),
      ),
    } as unknown as Geolocation;

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: deniedGeolocation,
    });

    try {
      renderApp('/mapa');
      await screen.findByText('Buraco na Rua das Flores');

      await user.click(screen.getByRole('button', { name: /usar minha localização/i }));
      expect(await screen.findByText(/não foi possível usar sua localização/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /centralizar no município/i }));
      expect(await screen.findByText(/mapa centralizado em salvador/i)).toBeInTheDocument();
    } finally {
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', originalGeolocation);
      } else {
        Reflect.deleteProperty(navigator, 'geolocation');
      }
    }
  });

  it('preserva uma lista acessível quando a API ou o mapa base falha', async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/occurrences`, () => HttpResponse.error()),
      http.get(`${env.apiBaseUrl}/api/v1/occurrences/map`, () => HttpResponse.error()),
    );
    renderApp('/mapa');

    expect(
      await screen.findByRole('heading', { name: /não foi possível carregar o mapa público/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('trata ocorrência inexistente sem expor o erro interno', async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'OCCURRENCE_NOT_FOUND', message: 'internal database detail' },
            meta: { requestId: 'not-found' },
          },
          { status: 404 },
        ),
      ),
    );
    renderApp('/ocorrencias/30000000-0000-4000-8000-000000000099');

    expect(
      await screen.findByRole('heading', {
        name: /este registro não está disponível publicamente/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('internal database detail')).not.toBeInTheDocument();
  });

  it('sincroniza confirmação e remoção para uma sessão cidadã', async () => {
    const user = userEvent.setup();
    let confirmed = false;
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/auth/refresh`, () =>
        HttpResponse.json({
          success: true,
          data: {
            accessToken: 'citizen-access-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            user: {
              id: '50000000-0000-4000-8000-000000000001',
              name: 'Ana Cidadã',
              email: 'ana@example.test',
              phone: null,
              role: 'CITIZEN',
              municipalityId: env.defaultMunicipalityId,
              neighborhood: 'Pituba',
              avatarUrl: null,
              status: 'ACTIVE',
              emailVerifiedAt: null,
              lastLoginAt: '2026-07-22T12:00:00.000Z',
              createdAt: '2026-07-20T12:00:00.000Z',
              updatedAt: '2026-07-22T12:00:00.000Z',
              deletedAt: null,
            },
          },
          meta: { requestId: 'community-session' },
        }),
      ),
      http.get(
        `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations/count`,
        ({ params }) =>
          HttpResponse.json({
            success: true,
            data: {
              occurrenceId: params.occurrenceId,
              confirmationCount: confirmed ? 19 : 18,
              priorityScore: confirmed ? 83.1 : 82.4,
              confirmedByMe: confirmed,
            },
            meta: { requestId: 'community-state' },
          }),
      ),
      http.post(
        `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations`,
        ({ params }) => {
          confirmed = true;
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
              meta: { requestId: 'community-created' },
            },
            { status: 201 },
          );
        },
      ),
      http.delete(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations/me`, () => {
        confirmed = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderApp('/ocorrencias/30000000-0000-4000-8000-000000000001');
    const community = await screen.findByRole('region', { name: /você também viu este problema/i });
    await user.click(within(community).getByRole('button', { name: 'Eu também vi' }));
    expect(
      await within(community).findByRole('button', { name: /desfazer minha confirmação/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(within(community).getByText('19')).toBeInTheDocument();

    await user.click(
      within(community).getByRole('button', { name: /desfazer minha confirmação/i }),
    );
    expect(await within(community).findByRole('button', { name: 'Eu também vi' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(community).getByText('18')).toBeInTheDocument();
  });

  it('trata conflito de confirmação duplicada sem quebrar a tela', async () => {
    const user = userEvent.setup();
    let synchronized = false;
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/auth/refresh`, () =>
        HttpResponse.json({
          success: true,
          data: {
            accessToken: 'citizen-access-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            user: {
              id: '50000000-0000-4000-8000-000000000001',
              name: 'Ana Cidadã',
              email: 'ana@example.test',
              phone: null,
              role: 'CITIZEN',
              municipalityId: env.defaultMunicipalityId,
              neighborhood: null,
              avatarUrl: null,
              status: 'ACTIVE',
              emailVerifiedAt: null,
              lastLoginAt: null,
              createdAt: '2026-07-20T12:00:00.000Z',
              updatedAt: '2026-07-22T12:00:00.000Z',
              deletedAt: null,
            },
          },
          meta: { requestId: 'duplicate-session' },
        }),
      ),
      http.get(
        `${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations/count`,
        ({ params }) =>
          HttpResponse.json({
            success: true,
            data: {
              occurrenceId: params.occurrenceId,
              confirmationCount: synchronized ? 19 : 18,
              priorityScore: 83.1,
              confirmedByMe: synchronized,
            },
            meta: { requestId: 'duplicate-state' },
          }),
      ),
      http.post(`${env.apiBaseUrl}/api/v1/occurrences/:occurrenceId/confirmations`, () => {
        synchronized = true;
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'CONFIRMATION_ALREADY_EXISTS',
              message: 'Você já confirmou esta ocorrência.',
            },
            meta: { requestId: 'duplicate-confirmation' },
          },
          { status: 409 },
        );
      }),
    );

    renderApp('/ocorrencias/30000000-0000-4000-8000-000000000001');
    const community = await screen.findByRole('region', { name: /você também viu este problema/i });
    await user.click(within(community).getByRole('button', { name: 'Eu também vi' }));

    expect(
      await within(community).findByText(/sua confirmação já estava registrada/i),
    ).toBeInTheDocument();
    expect(
      within(community).getByRole('button', { name: /desfazer minha confirmação/i }),
    ).toBeInTheDocument();
  });

  it('copia somente o link público quando o compartilhamento nativo não está disponível', async () => {
    const user = userEvent.setup();
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });

    try {
      renderApp('/ocorrencias/30000000-0000-4000-8000-000000000001');
      const community = await screen.findByRole('region', {
        name: /você também viu este problema/i,
      });
      await user.click(within(community).getByRole('button', { name: /compartilhar ocorrência/i }));

      expect(writeText).toHaveBeenCalledWith(
        'http://localhost:3000/ocorrencias/30000000-0000-4000-8000-000000000001',
      );
      expect(await within(community).findByText('Link público copiado.')).toBeInTheDocument();
      expect(
        within(community).getByRole('link', { name: /entre para confirmar/i }),
      ).toHaveAttribute('href', '/entrar');
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
      if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
      else Reflect.deleteProperty(navigator, 'share');
    }
  });
});
