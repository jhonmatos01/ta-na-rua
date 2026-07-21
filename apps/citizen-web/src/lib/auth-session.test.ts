import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
  setRefreshHandler,
} from './auth-session';

afterEach(() => {
  setAccessToken(null);
  setRefreshHandler(null);
});

describe('sessão em memória', () => {
  it('não persiste o access token fora do estado do módulo', () => {
    setAccessToken('temporary-token');
    expect(getAccessToken()).toBe('temporary-token');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it('deduplica tentativas simultâneas de refresh', async () => {
    const handler = vi.fn().mockResolvedValue('renewed-token');
    setRefreshHandler(handler);

    await expect(Promise.all([refreshAccessToken(), refreshAccessToken()])).resolves.toEqual([
      'renewed-token',
      'renewed-token',
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('retorna nulo quando não existe recuperação configurada', async () => {
    await expect(refreshAccessToken()).resolves.toBeNull();
  });
});
