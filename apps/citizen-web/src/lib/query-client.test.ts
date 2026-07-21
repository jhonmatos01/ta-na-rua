import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';
import { queryClient } from './query-client';

describe('queryClient', () => {
  const retry = queryClient.getDefaultOptions().queries?.retry;

  it('repete somente uma vez as falhas transitórias', () => {
    expect(typeof retry).toBe('function');
    if (typeof retry !== 'function') return;

    expect(retry(0, new ApiError({ code: 'NETWORK_ERROR', message: 'offline' }))).toBe(true);
    expect(retry(1, new ApiError({ code: 'NETWORK_ERROR', message: 'offline' }))).toBe(false);
  });

  it('não repete falhas não transitórias ou desconhecidas', () => {
    if (typeof retry !== 'function') return;

    expect(retry(0, new ApiError({ code: 'BAD_REQUEST', message: 'inválido' }))).toBe(false);
    expect(retry(0, new Error('desconhecido'))).toBe(false);
  });
});
