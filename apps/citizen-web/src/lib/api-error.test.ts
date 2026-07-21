import { describe, expect, it } from 'vitest';

import { ApiError, getSafeErrorMessage } from './api-error';

describe('getSafeErrorMessage', () => {
  it.each([
    ['TIMEOUT', 'demorou mais que o esperado'],
    ['NETWORK_ERROR', 'Verifique sua conexão'],
    ['NOT_FOUND', 'não foi encontrado'],
    ['FORBIDDEN', 'não tem permissão'],
    ['SERVER_ERROR', 'temporariamente indisponível'],
  ] as const)('converte %s em mensagem segura', (code, expected) => {
    expect(getSafeErrorMessage(new ApiError({ code, message: 'mensagem interna' }))).toContain(
      expected,
    );
  });

  it('não expõe o texto de um erro desconhecido', () => {
    expect(getSafeErrorMessage(new Error('segredo interno'))).not.toContain('segredo interno');
  });
});
