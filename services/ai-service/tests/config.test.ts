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
});
