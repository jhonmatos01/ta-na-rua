import type { RequestHandler } from 'express';

import { env } from '../../config/env.js';

export interface ApiRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

export interface ApiRateLimiter {
  consume(key: string): ApiRateLimitResult;
}

export class InMemoryApiRateLimiter implements ApiRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  public constructor(
    private readonly maximum = env.API_RATE_LIMIT_MAX,
    private readonly windowSeconds = env.API_RATE_LIMIT_WINDOW_SECONDS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public consume(key: string): ApiRateLimitResult {
    const now = this.now().getTime();
    const current = this.windows.get(key);

    if (current === undefined || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowSeconds * 1_000 });
      this.prune(now);
      return {
        allowed: true,
        limit: this.maximum,
        remaining: Math.max(0, this.maximum - 1),
        retryAfterSeconds: this.windowSeconds,
      };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
    if (current.count >= this.maximum) {
      return {
        allowed: false,
        limit: this.maximum,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    current.count += 1;
    return {
      allowed: true,
      limit: this.maximum,
      remaining: Math.max(0, this.maximum - current.count),
      retryAfterSeconds,
    };
  }

  private prune(now: number): void {
    if (this.windows.size < 10_000) return;
    for (const [key, value] of this.windows) {
      if (value.resetAt <= now) this.windows.delete(key);
    }
  }
}

export function createApiRateLimitMiddleware(
  limiter: ApiRateLimiter = new InMemoryApiRateLimiter(),
): RequestHandler {
  return (request, response, next) => {
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const result = limiter.consume(key);

    response.setHeader('RateLimit-Limit', String(result.limit));
    response.setHeader('RateLimit-Remaining', String(result.remaining));
    response.setHeader('RateLimit-Reset', String(result.retryAfterSeconds));

    if (result.allowed) {
      next();
      return;
    }

    response.setHeader('Retry-After', String(result.retryAfterSeconds));
    response.status(429).json({
      success: false,
      error: {
        code: 'API_RATE_LIMITED',
        message: 'Limite de requisicoes da API excedido.',
        details: {},
      },
      meta: {
        requestId: request.requestId,
      },
    });
  };
}
