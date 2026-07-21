import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { setAccessToken, setRefreshHandler } from '../../lib/auth-session';
import { authUserFixture } from '../../tests/auth-fixtures';
import { server } from '../../tests/server';
import { getMyProfile } from './auth-api';

afterEach(() => {
  setAccessToken(null);
  setRefreshHandler(null);
});

describe('cliente autenticado', () => {
  it('renova uma vez após 401 e repete a requisição com o novo bearer', async () => {
    const authorizations: Array<string | null> = [];
    setAccessToken('expired-token');
    setRefreshHandler(() => {
      setAccessToken('renewed-token');
      return Promise.resolve('renewed-token');
    });
    server.use(
      http.get(`${env.apiBaseUrl}/api/v1/users/me`, ({ request }) => {
        const authorization = request.headers.get('authorization');
        authorizations.push(authorization);
        if (authorization === 'Bearer expired-token') {
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Token expirado.' },
              meta: { requestId: 'expired-request' },
            },
            { status: 401 },
          );
        }
        return HttpResponse.json({
          success: true,
          data: { user: authUserFixture },
          meta: { requestId: 'renewed-request' },
        });
      }),
    );

    await expect(getMyProfile()).resolves.toEqual(authUserFixture);
    expect(authorizations).toEqual(['Bearer expired-token', 'Bearer renewed-token']);
  });
});
