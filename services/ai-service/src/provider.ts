import type { AiServiceRequest, AiServiceResponse } from './contracts.js';
import { aiServiceResponseSchema } from './contracts.js';

export type FetchImplementation = typeof fetch;
type ProviderErrorKind = 'UNAVAILABLE' | 'INVALID_RESPONSE' | 'HTTP_ERROR';

export interface AiProviderOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  forceHumanReview: boolean;
  fetchImplementation?: FetchImplementation;
}

export class AiProviderError extends Error {
  public readonly kind: ProviderErrorKind;
  public readonly statusCode: 502 | 503;

  public constructor(kind: ProviderErrorKind, statusCode: 502 | 503) {
    super('The configured AI provider could not complete the analysis.');
    this.name = 'AiProviderError';
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function contentFromChunk(chunk: unknown): string {
  if (!isRecord(chunk) || !Array.isArray(chunk.choices)) return '';
  const choices = chunk.choices as unknown[];
  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) return '';
  const delta = isRecord(firstChoice.delta) ? firstChoice.delta : undefined;
  const message = isRecord(firstChoice.message) ? firstChoice.message : undefined;
  return stringValue(delta?.content) ?? stringValue(message?.content) ?? '';
}

function modelContentFromResponse(body: string): string {
  let streamedContent = '';
  let foundDataLine = false;

  for (const line of body.split(/\r?\n/u)) {
    if (!line.startsWith('data:')) continue;
    foundDataLine = true;
    const payload = line.slice('data:'.length).trim();
    if (payload === '' || payload === '[DONE]') continue;
    try {
      streamedContent += contentFromChunk(JSON.parse(payload) as unknown);
    } catch {
      throw new AiProviderError('INVALID_RESPONSE', 502);
    }
  }

  if (foundDataLine && streamedContent.trim() !== '') return streamedContent;
  try {
    return contentFromChunk(JSON.parse(body) as unknown);
  } catch {
    throw new AiProviderError('INVALID_RESPONSE', 502);
  }
}

function jsonFromModelContent(content: string): unknown {
  const trimmed = content.trim();
  const withoutFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)?.[1] ?? trimmed;
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiProviderError('INVALID_RESPONSE', 502);
  try {
    return JSON.parse(withoutFence.slice(start, end + 1)) as unknown;
  } catch {
    throw new AiProviderError('INVALID_RESPONSE', 502);
  }
}

function assertContextBoundResponse(
  request: AiServiceRequest,
  response: AiServiceResponse,
): void {
  if (!request.availableCategories.some((category) => category.code === response.category)) {
    throw new AiProviderError('INVALID_RESPONSE', 502);
  }
  const candidateIds = new Set(request.nearbyOccurrences.map((occurrence) => occurrence.id));
  if (response.possibleDuplicates.some((duplicate) => !candidateIds.has(duplicate.occurrenceId))) {
    throw new AiProviderError('INVALID_RESPONSE', 502);
  }
}

function promptFor(request: AiServiceRequest): { system: string; user: string } {
  return {
    system:
      'Você é um classificador de falhas urbanas. Responda somente com um objeto JSON válido, sem markdown. Use exatamente uma categoria de availableCategories e somente IDs de nearbyOccurrences. Não invente IDs. A resposta deve conter category, subcategory, severity (1-5), risk (LOW, MEDIUM, HIGH ou CRITICAL), confidence (0-1), summary, requiresHumanReview e possibleDuplicates. Mesmo quando tiver confiança, requiresHumanReview deve ser true.',
    user: JSON.stringify(
      {
        analysisType: request.analysisType,
        imageUrl: request.imageUrl,
        description: request.description,
        latitude: request.latitude,
        longitude: request.longitude,
        nearbyOccurrences: request.nearbyOccurrences,
        availableCategories: request.availableCategories,
      },
      null,
      2,
    ),
  };
}

export async function analyzeWithOpenAiCompatible(
  request: AiServiceRequest,
  options: AiProviderOptions,
): Promise<AiServiceResponse> {
  const endpoint = new URL('chat/completions', `${options.baseUrl.replace(/\/+$/u, '')}/`);
  const prompt = promptFor(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const headers: Record<string, string> = {
    accept: 'text/event-stream, application/json',
    'content-type': 'application/json',
  };
  if (options.apiKey !== undefined) headers.authorization = `Bearer ${options.apiKey}`;

  try {
    const response = await (options.fetchImplementation ?? fetch)(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0,
        stream: true,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    const body = await response.text();
    if (body.length > 262_144) throw new AiProviderError('INVALID_RESPONSE', 502);
    if (!response.ok) throw new AiProviderError('HTTP_ERROR', 503);

    const parsed = aiServiceResponseSchema.safeParse(
      jsonFromModelContent(modelContentFromResponse(body)),
    );
    if (!parsed.success) throw new AiProviderError('INVALID_RESPONSE', 502);
    assertContextBoundResponse(request, parsed.data);
    return {
      ...parsed.data,
      requiresHumanReview: options.forceHumanReview || parsed.data.requiresHumanReview,
    };
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError('UNAVAILABLE', 503);
  } finally {
    clearTimeout(timeout);
  }
}
