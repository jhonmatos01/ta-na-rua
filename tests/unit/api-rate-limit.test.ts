import { describe, expect, it } from 'vitest';

import { InMemoryApiRateLimiter } from '../../src/shared/middleware/api-rate-limit.js';

describe('InMemoryApiRateLimiter', () => {
  it('limita por chave e libera uma nova janela', () => {
    let now = new Date('2026-07-20T12:00:00.000Z');
    const limiter = new InMemoryApiRateLimiter(2, 60, () => now);

    expect(limiter.consume('127.0.0.1')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume('127.0.0.1')).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume('127.0.0.1')).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    expect(limiter.consume('127.0.0.2')).toMatchObject({ allowed: true, remaining: 1 });

    now = new Date('2026-07-20T12:01:00.000Z');
    expect(limiter.consume('127.0.0.1')).toMatchObject({ allowed: true, remaining: 1 });
  });
});
