import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { env } from '../config/env';
import { server } from '../tests/server';
import { renderApp } from '../tests/render-app';

describe('páginas públicas', () => {
  it('exibe a fundação do aplicativo e o status real da API', async () => {
    renderApp('/');

    expect(
      screen.getByRole('heading', { level: 1, name: /sua cidade.*mais próxima/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument();
    expect(screen.getByRole('figure', { name: /conceito visual/i })).toBeInTheDocument();
    expect(screen.getAllByText('Planejado')).toHaveLength(3);
    expect(await screen.findByText('Disponível')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /criar conta cidadã/i })).toHaveAttribute(
      'href',
      '/criar-conta',
    );
  });

  it('permite navegar por teclado até a página de status', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.tab();
    expect(screen.getByRole('link', { name: /ir para o conteúdo/i })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Status' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(
      await screen.findByRole('heading', { level: 1, name: /status dos serviços/i }),
    ).toBeInTheDocument();
  });

  it('mostra o estado dos dois serviços e permite atualização manual', async () => {
    const user = userEvent.setup();
    renderApp('/status');

    expect(await screen.findByText('API respondendo normalmente.')).toBeInTheDocument();
    expect(await screen.findByText('Camada de dados respondendo normalmente.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /atualizar status/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /atualizar status/i })).toBeEnabled(),
    );
  });

  it('apresenta mensagem segura e tentativa novamente quando a API falha', async () => {
    server.use(http.get(`${env.apiBaseUrl}/health`, () => HttpResponse.error()));
    renderApp('/status');

    expect(await screen.findByText(/verifique sua conexão/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /tentar novamente/i }).length).toBeGreaterThan(0);
  });

  it('exibe a página de indisponibilidade sem prometer funcionalidades futuras', () => {
    renderApp('/indisponivel');

    expect(
      screen.getByRole('heading', { name: /estamos preparando o caminho/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver status/i })).toHaveAttribute('href', '/status');
  });

  it('trata rotas desconhecidas com uma página 404', () => {
    renderApp('/nao-existe');

    expect(screen.getByRole('heading', { name: /página não encontrada/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar ao início/i })).toHaveAttribute('href', '/');
  });
});
