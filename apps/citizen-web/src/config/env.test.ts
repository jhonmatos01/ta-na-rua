import { describe, expect, it } from 'vitest';

import { parseEnvironment } from './env';

const validEnvironment = {
  VITE_APP_NAME: 'Tá na Rua!',
  VITE_APP_VERSION: '1.0.0',
  VITE_API_BASE_URL: 'http://localhost:3333/',
  VITE_API_TIMEOUT_MS: '8000',
  VITE_ENABLE_API_STATUS: 'true',
  VITE_ENABLE_DATABASE_STATUS: 'false',
  VITE_ENABLE_DEVTOOLS: 'false',
  VITE_DEFAULT_MUNICIPALITY_ID: '10000000-0000-4000-8000-000000000001',
  VITE_DEFAULT_MUNICIPALITY_NAME: 'Salvador - BA',
  VITE_PASSWORD_MIN_LENGTH: '12',
};

describe('parseEnvironment', () => {
  it('valida, converte e normaliza as variáveis públicas', () => {
    expect(parseEnvironment(validEnvironment)).toEqual({
      appName: 'Tá na Rua!',
      appVersion: '1.0.0',
      apiBaseUrl: 'http://localhost:3333',
      apiTimeoutMs: 8000,
      enableApiStatus: true,
      enableDatabaseStatus: false,
      enableDevtools: false,
      defaultMunicipalityId: '10000000-0000-4000-8000-000000000001',
      defaultMunicipalityName: 'Salvador - BA',
      passwordMinLength: 12,
    });
  });

  it('interrompe a inicialização quando uma variável obrigatória está ausente', () => {
    const missingApiUrl: Record<string, unknown> = { ...validEnvironment };
    delete missingApiUrl.VITE_API_BASE_URL;

    expect(() => parseEnvironment(missingApiUrl)).toThrow('VITE_API_BASE_URL');
  });

  it('rejeita timeout fora do intervalo permitido', () => {
    expect(() => parseEnvironment({ ...validEnvironment, VITE_API_TIMEOUT_MS: '100' })).toThrow(
      'VITE_API_TIMEOUT_MS',
    );
  });

  it('rejeita valores booleanos ambíguos', () => {
    expect(() => parseEnvironment({ ...validEnvironment, VITE_ENABLE_API_STATUS: '1' })).toThrow(
      'VITE_ENABLE_API_STATUS',
    );
  });
});
