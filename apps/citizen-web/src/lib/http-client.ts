import { z } from 'zod';

import { env } from '../config/env';
import { ApiError, type ApiErrorCode } from './api-error';

const apiFailureSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
    details: z.unknown().optional(),
  }),
  meta: z
    .object({
      requestId: z.string().optional(),
    })
    .optional(),
});

interface RequestOptions<TSchema extends z.ZodType> {
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  query?: Record<string, boolean | number | string | null | undefined>;
  headers?: HeadersInit;
  body?: BodyInit | Record<string, unknown>;
  signal?: AbortSignal;
  schema: TSchema;
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 400 || status === 422) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
}

function createUrl(path: string, query?: RequestOptions<z.ZodType>['query']): URL {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${env.apiBaseUrl}${normalizedPath}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }

  return url;
}

function prepareBody(body: RequestOptions<z.ZodType>['body']): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }
  return JSON.stringify(body);
}

export async function apiRequest<TSchema extends z.ZodType>(
  path: string,
  options: RequestOptions<TSchema>,
): Promise<z.output<TSchema>> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, env.apiTimeoutMs);
  const abortFromCaller = (): void => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const body = prepareBody(options.body);
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-Request-ID', globalThis.crypto.randomUUID());
    if (body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(createUrl(path, options.query), {
      method: options.method ?? 'GET',
      body,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    const rawBody = await response.text();
    let payload: unknown;
    try {
      payload = rawBody ? JSON.parse(rawBody) : undefined;
    } catch (cause) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: 'A API retornou conteúdo inválido.',
        status: response.status,
        cause,
      });
    }

    if (!response.ok) {
      const failure = apiFailureSchema.safeParse(payload);
      throw new ApiError({
        code: codeForStatus(response.status),
        message: failure.success
          ? (failure.data.error.message ?? 'Falha na API.')
          : 'Falha na API.',
        status: response.status,
        requestId: failure.success ? failure.data.meta?.requestId : undefined,
        details: failure.success ? failure.data.error.details : undefined,
      });
    }

    const parsed = options.schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: 'O formato da resposta da API não corresponde ao contrato esperado.',
        status: response.status,
        details: parsed.error.flatten(),
      });
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError({
        code: timedOut ? 'TIMEOUT' : 'ABORTED',
        message: timedOut ? 'Tempo limite da consulta excedido.' : 'Consulta cancelada.',
        cause: error,
      });
    }
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Não foi possível se comunicar com a API.',
      cause: error,
    });
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
