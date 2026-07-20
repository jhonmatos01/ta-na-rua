export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

export class InMemoryWebhookRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  public constructor(
    private readonly maximum: number,
    private readonly windowSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public consume(key: string): RateLimitResult {
    const now = this.now().getTime();
    const current = this.windows.get(key);
    if (current === undefined || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowSeconds * 1_000 });
      this.prune(now);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= this.maximum) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
      };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(now: number): void {
    if (this.windows.size < 10_000) return;
    for (const [key, value] of this.windows) {
      if (value.resetAt <= now) this.windows.delete(key);
    }
  }
}
