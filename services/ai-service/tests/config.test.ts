import { describe, expect, it } from 'vitest';

import { parseAiServiceConfig } from '../src/config.js';

describe('parseAiServiceConfig', () => {
  it('fails fast when the service secret is weak', () => {
    expect(() =>
      parseAiServiceConfig({
        NODE_ENV: 'development',
        AI_SERVICE_SECRET: 'short',
      }),
    ).toThrow();
  });

  it('prevents the deterministic engine from starting in production', () => {
    expect(() =>
      parseAiServiceConfig({
        NODE_ENV: 'production',
        AI_SERVICE_MODE: 'DETERMINISTIC',
        AI_SERVICE_SECRET: 'x'.repeat(32),
      }),
    ).toThrow(/exclusivo de desenvolvimento/);
  });

  it('requires a provider URL in OpenAI-compatible mode', () => {
    expect(() =>
      parseAiServiceConfig({
        NODE_ENV: 'development',
        AI_SERVICE_MODE: 'OPENAI_COMPATIBLE',
        AI_SERVICE_SECRET: 'x'.repeat(32),
      }),
    ).toThrow(/URL base do provedor/);
  });

  it('parses the local OmniRoute provider configuration without exposing the key', () => {
    const config = parseAiServiceConfig({
      NODE_ENV: 'development',
      AI_SERVICE_MODE: 'OPENAI_COMPATIBLE',
      AI_SERVICE_SECRET: 'x'.repeat(32),
      AI_PROVIDER_BASE_URL: 'http://localhost:20128/v1',
      AI_PROVIDER_API_KEY: 'local-only-key',
      AI_PROVIDER_MODEL: 'Meu primeiro combo',
    });

    expect(config.providerBaseUrl).toBe('http://localhost:20128/v1');
    expect(config.providerModel).toBe('Meu primeiro combo');
    expect(config.providerApiKey).toBe('local-only-key');
  });
});
