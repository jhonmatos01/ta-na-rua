import { describe, expect, it, vi } from 'vitest';

import { DefaultAiHttpClient } from '../../src/modules/ai/ai.client.js';
import type { AiServiceRequest } from '../../src/modules/ai/ai.types.js';

const request: AiServiceRequest = {
  analysisType: 'CLASSIFICATION',
  reportId: '70000000-0000-4000-8000-000000000001',
  imageUrl: 'https://example.test/image.webp',
  description: 'Buraco grande na via',
  latitude: -12.97,
  longitude: -38.5,
  nearbyOccurrences: [],
  availableCategories: [{ code: 'POTHOLE', name: 'Buraco na via' }],
};

const validResponse = {
  category: 'POTHOLE',
  subcategory: 'ASPHALT_DAMAGE',
  severity: 4,
  risk: 'HIGH',
  confidence: 0.91,
  summary: 'Buraco de grande dimensao.',
  requiresHumanReview: false,
  possibleDuplicates: [],
};

function client(fetchImplementation: typeof fetch, overrides: Record<string, unknown> = {}) {
  return new DefaultAiHttpClient({
    serviceUrl: 'http://ai.example.test',
    secret: 'segredo-de-teste',
    timeoutMs: 20,
    maxAttempts: 2,
    fetchImplementation,
    sleep: () => Promise.resolve(),
    ...overrides,
  });
}

describe('cliente HTTP da IA', () => {
  it('envia contrato, segredo e chave idempotente e valida a resposta', async () => {
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      expect(new Headers(init?.headers).get('x-ai-service-secret')).toBe('segredo-de-teste');
      expect(new Headers(init?.headers).get('x-idempotency-key')).toBe(request.reportId);
      expect(typeof init?.body).toBe('string');
      expect(JSON.parse(init?.body as string)).toMatchObject({ reportId: request.reportId });
      return Promise.resolve(new Response(JSON.stringify(validResponse), { status: 200 }));
    });
    const result = await client(fetchMock).analyze(request);
    expect(result).toMatchObject({ ok: true, attempts: 1, response: validResponse });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejeita resposta invalida sem repetir e remove chaves sensiveis', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ category: 'POTHOLE', token: 'nao-persistir' }), {
          status: 200,
        }),
      ),
    );
    const result = await client(fetchMock).analyze(request);
    expect(result).toMatchObject({ ok: false, state: 'INVALID_RESPONSE', attempts: 1 });
    expect(JSON.stringify(result.rawResponse)).not.toContain('nao-persistir');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('repete erro transitorio uma vez e retorna sucesso', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"error":"temporario"}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validResponse), { status: 200 }));
    const result = await client(fetchMock).analyze(request);
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('trata timeout com AbortController', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('abortado');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const result = await client(fetchMock, { timeoutMs: 5, maxAttempts: 1 }).analyze(request);
    expect(result).toMatchObject({ ok: false, state: 'TIMEOUT', attempts: 1 });
  });

  it('trata indisponibilidade depois do limite de tentativas', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new Error('offline')));
    const result = await client(fetchMock).analyze(request);
    expect(result).toMatchObject({ ok: false, state: 'UNAVAILABLE', attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aplica fallback sem rede quando nao configurado', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const result = await new DefaultAiHttpClient({
      serviceUrl: null,
      secret: null,
      fetchImplementation: fetchMock,
    }).analyze(request);
    expect(result).toEqual({
      ok: false,
      attempts: 0,
      state: 'NOT_CONFIGURED',
      rawResponse: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
