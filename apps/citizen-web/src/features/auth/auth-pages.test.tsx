import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { renderApp } from '../../tests/render-app';
import { server } from '../../tests/server';
import { authUserFixture, sessionFixture } from '../../tests/auth-fixtures';

describe('jornada de autenticação', () => {
  it('redireciona uma rota privada para o login', async () => {
    const { router } = renderApp('/perfil');

    expect(await screen.findByRole('heading', { name: /que bom ter você/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
  });

  it('faz login e abre o perfil sem persistir o token na interface', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/auth/login`, async ({ request }) => {
        expect(await request.json()).toEqual({
          email: 'ana@example.test',
          password: 'SenhaForte123!',
        });
        return HttpResponse.json(sessionFixture());
      }),
    );
    renderApp('/entrar');

    const submit = await screen.findByRole('button', { name: /^entrar$/i });
    await user.type(screen.getByLabelText(/^E-mail/i), 'ana@example.test');
    await user.type(screen.getByLabelText(/^Senha/i), 'SenhaForte123!');
    await user.click(submit);

    expect(await screen.findByRole('heading', { name: 'Ana Cidadã' })).toBeInTheDocument();
    expect(screen.queryByText('test-access-token')).not.toBeInTheDocument();
  });

  it('traduz credenciais inválidas em mensagem compreensível', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/auth/login`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas.' },
            meta: { requestId: 'invalid-login' },
          },
          { status: 401 },
        ),
      ),
    );
    renderApp('/entrar');

    const submit = await screen.findByRole('button', { name: /^entrar$/i });
    await user.type(screen.getByLabelText(/^E-mail/i), 'ana@example.test');
    await user.type(screen.getByLabelText(/^Senha/i), 'errada');
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('cadastra a conta no município configurado e encaminha ao login', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/auth/register`, async ({ request }) => {
        expect(await request.json()).toMatchObject({
          name: 'Nova Cidadã',
          email: 'nova@example.test',
          municipalityId: env.defaultMunicipalityId,
        });
        return HttpResponse.json(
          {
            success: true,
            data: { user: { ...authUserFixture, name: 'Nova Cidadã', email: 'nova@example.test' } },
            meta: { requestId: 'register-request' },
          },
          { status: 201 },
        );
      }),
    );
    renderApp('/criar-conta');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /criar minha conta/i })).toBeEnabled(),
    );
    await user.type(screen.getByLabelText(/^Nome completo/i), 'Nova Cidadã');
    await user.type(screen.getByLabelText(/^E-mail/i), 'nova@example.test');
    await user.type(screen.getByLabelText(/^Senha/i), 'SenhaForte123!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'SenhaForte123!');
    await user.click(screen.getByRole('button', { name: /criar minha conta/i }));

    expect(await screen.findByText(/conta criada com sucesso/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('nova@example.test')).toBeInTheDocument();
  });

  it('trata conflito de cadastro sem exibir a mensagem interna da API', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/auth/register`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'USER_ALREADY_EXISTS', message: 'internal duplicate detail' },
            meta: { requestId: 'register-conflict' },
          },
          { status: 409 },
        ),
      ),
    );
    renderApp('/criar-conta');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /criar minha conta/i })).toBeEnabled(),
    );
    await user.type(screen.getByLabelText(/^Nome completo/i), 'Nova Cidadã');
    await user.type(screen.getByLabelText(/^E-mail/i), 'existente@example.test');
    await user.type(screen.getByLabelText(/^Senha/i), 'SenhaForte123!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'SenhaForte123!');
    await user.click(screen.getByRole('button', { name: /criar minha conta/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe uma conta com este e-mail ou telefone.',
    );
    expect(screen.queryByText('internal duplicate detail')).not.toBeInTheDocument();
  });

  it('trata erro de validação ao atualizar o perfil', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/auth/refresh`, () => HttpResponse.json(sessionFixture())),
      http.patch(`${env.apiBaseUrl}/api/v1/users/me`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'internal field detail' },
            meta: { requestId: 'profile-validation' },
          },
          { status: 422 },
        ),
      ),
    );
    renderApp('/perfil');

    await screen.findByLabelText(/^Nome/i);
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Revise os dados destacados e tente novamente.',
    );
    expect(screen.queryByText('internal field detail')).not.toBeInTheDocument();
  });

  it('recupera a sessão, atualiza o perfil e encerra a conta localmente', async () => {
    const user = userEvent.setup();
    const updatedUser = {
      ...authUserFixture,
      name: 'Ana Atualizada',
      updatedAt: '2026-07-20T22:00:00.000Z',
    };
    server.use(
      http.post(`${env.apiBaseUrl}/api/v1/auth/refresh`, () => HttpResponse.json(sessionFixture())),
      http.patch(`${env.apiBaseUrl}/api/v1/users/me`, async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer test-access-token');
        expect(await request.json()).toMatchObject({ name: 'Ana Atualizada' });
        return HttpResponse.json({
          success: true,
          data: { user: updatedUser },
          meta: { requestId: 'profile-update' },
        });
      }),
      http.post(
        `${env.apiBaseUrl}/api/v1/auth/logout`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    renderApp('/perfil');

    const name = await screen.findByLabelText(/^Nome/i);
    await user.clear(name);
    await user.type(name, 'Ana Atualizada');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));
    expect(await screen.findByText(/perfil atualizado com sucesso/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ana Atualizada' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sair da conta/i }));
    expect(await screen.findByRole('heading', { name: /que bom ter você/i })).toBeInTheDocument();
  });
});
