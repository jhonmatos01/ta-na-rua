import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { aiServiceResponseSchema } from './ai.schemas.js';
import type {
  AiClientFailureState,
  AiClientResult,
  AiHttpClient,
  AiServiceRequest,
} from './ai.types.js';

type FetchImplementation = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

export interface AiHttpClientOptions {
  serviceUrl?: string | null;
  secret?: string | null;
  timeoutMs?: number;
  maxAttempts?: number;
  fetchImplementation?: FetchImplementation;
  sleep?: Sleep;
}

function sanitizedRaw(value: unknown): unknown {
  const sensitive = /authorization|cookie|secret|token|password|api[-_]?key/iu;
  if (Array.isArray(value)) return value.map(sanitizedRaw);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitive.test(key))
      .map(([key, entry]) => [key, sanitizedRaw(entry)]),
  );
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function failureState(error: unknown): AiClientFailureState {
  return error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'UNAVAILABLE';
}

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class DefaultAiHttpClient implements AiHttpClient {
  private readonly serviceUrl: string | undefined;
  private readonly secret: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly sleep: Sleep;

  public constructor(options: AiHttpClientOptions = {}) {
    this.serviceUrl =
      options.serviceUrl === null ? undefined : (options.serviceUrl ?? env.AI_SERVICE_URL);
    this.secret = options.secret === null ? undefined : (options.secret ?? env.AI_SERVICE_SECRET);
    this.timeoutMs = options.timeoutMs ?? env.AI_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts ?? env.AI_MAX_ATTEMPTS;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
  }

  public async analyze(request: AiServiceRequest): Promise<AiClientResult> {
    if (this.serviceUrl === undefined || this.secret === undefined) {
      return { ok: false, attempts: 0, state: 'NOT_CONFIGURED', rawResponse: null };
    }

    const endpoint = new URL('analyze', `${this.serviceUrl.replace(/\/+$/u, '')}/`);
    let lastFailure: AiClientResult = {
      ok: false,
      attempts: 0,
      state: 'UNAVAILABLE',
      rawResponse: null,
    };

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImplementation(endpoint, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-ai-service-secret': this.secret,
            'x-idempotency-key': request.reportId,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        const responseText = await response.text();
        if (responseText.length > 262_144) {
          return {
            ok: false,
            attempts: attempt,
            state: 'INVALID_RESPONSE',
            rawResponse: { reason: 'RESPONSE_TOO_LARGE', size: responseText.length },
          };
        }

        let rawResponse: unknown = null;
        if (responseText.length > 0) {
          try {
            rawResponse = JSON.parse(responseText) as unknown;
          } catch {
            rawResponse = { body: responseText.slice(0, 2_000) };
          }
        }
        rawResponse = sanitizedRaw(rawResponse);

        if (!response.ok) {
          lastFailure = {
            ok: false,
            attempts: attempt,
            state: 'HTTP_ERROR',
            rawResponse,
            statusCode: response.status,
          };
          if (attempt < this.maxAttempts && retryableStatus(response.status)) {
            await this.sleep(100 * attempt);
            continue;
          }
          return lastFailure;
        }

        const parsed = aiServiceResponseSchema.safeParse(rawResponse);
        if (!parsed.success) {
          return {
            ok: false,
            attempts: attempt,
            state: 'INVALID_RESPONSE',
            rawResponse,
          };
        }
        return { ok: true, attempts: attempt, response: parsed.data, rawResponse };
      } catch (error) {
        const state = failureState(error);
        lastFailure = { ok: false, attempts: attempt, state, rawResponse: null };
        logger.warn({ state, attempt }, 'Falha controlada na chamada ao servico de IA.');
        if (attempt < this.maxAttempts) {
          await this.sleep(100 * attempt);
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    return lastFailure;
  }
}
