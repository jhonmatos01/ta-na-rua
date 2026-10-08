import { describe, expect, it } from 'vitest';

import type { AiServiceRequest } from '../src/contracts.js';
import { analyzeWithOpenAiCompatible } from '../src/provider.js';

const request: AiServiceRequest = {
  analysisType: 'CLASSIFICATION',
  reportId: '70000000-0000-4000-8000-000000000001',
  imageUrl: 'http://localhost:3000/uploads/example.jpg',
  description: 'Buraco grande no asfalto da avenida',
  latitude: -12.9714,
  longitude: -38.5014,
  nearbyOccurrences: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      category: 'POTHOLE',
      distanceMeters: 12,
      description: 'Buraco no asfalto da avenida',
      imageUrls: [],
    },
  ],
  availableCategories: [
    { code: 'POTHOLE', name: 'Buraco na via' },
    { code: 'WATER_LEAK', name: 'Vazamento de água' },
  ],
};

const providerOptions = {
  baseUrl: 'http://localhost:20128/v1',
  apiKey: 'local-only-key',
  model: 'Meu primeiro combo',
  timeoutMs: 1_000,
  forceHumanReview: true,
};

describe('OpenAI-compatible provider adapter', () => {
  it('parses OmniRoute SSE chunks and keeps human review mandatory', async () => {
    const fetchImplementation: typeof fetch = (_input, init) => {
      const rawBody = typeof init?.body === 'string' ? init.body : '';
      const body = JSON.parse(rawBody) as {
        model: string;
        stream: boolean;
      };
      expect(body.model).toBe('Meu primeiro combo');
      expect(body.stream).toBe(true);

      const modelContent = JSON.stringify({
        category: 'POTHOLE', subcategory: null, severity: 4, risk: 'HIGH',
        confidence: 0.92, summary: 'Dano no asfalto.', requiresHumanReview: false,
        possibleDuplicates: [],
      });
      return Promise.resolve(new Response(
        [`data: ${JSON.stringify({ choices: [{ delta: { content: modelContent } }] })}`, 'data: [DONE]', ''].join('\n'),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ));
    };

    const result = await analyzeWithOpenAiCompatible(request, {
      ...providerOptions,
      fetchImplementation,
    });

    expect(result.category).toBe('POTHOLE');
    expect(result.confidence).toBe(0.92);
    expect(result.requiresHumanReview).toBe(true);
  });

  it('rejects a provider category outside the supplied context', async () => {
    const fetchImplementation: typeof fetch = () => Promise.resolve(
      new Response(
        'data: {"choices":[{"delta":{"content":"{\\"category\\":\\"INVENTED\\",\\"subcategory\\":null,\\"severity\\":3,\\"risk\\":\\"MEDIUM\\",\\"confidence\\":0.8,\\"summary\\":\\"Invalid.\\",\\"requiresHumanReview\\":true,\\"possibleDuplicates\\":[]}"}}]}\\ndata: [DONE]\\n',
        { status: 200 },
      ),
    );

    await expect(
      analyzeWithOpenAiCompatible(request, {
        ...providerOptions,
        fetchImplementation,
      }),
    ).rejects.toMatchObject({ kind: 'INVALID_RESPONSE', statusCode: 502 });
  });

  it('maps provider failures to a controlled unavailable error', async () => {
    const fetchImplementation: typeof fetch = () =>
      Promise.resolve(new Response('{"error":"offline"}', { status: 503 }));

    await expect(
      analyzeWithOpenAiCompatible(request, {
        ...providerOptions,
        fetchImplementation,
      }),
    ).rejects.toMatchObject({ kind: 'HTTP_ERROR', statusCode: 503 });
  });
});
