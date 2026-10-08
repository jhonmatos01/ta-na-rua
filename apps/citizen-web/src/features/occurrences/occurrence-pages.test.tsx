import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../../config/env';
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
});
