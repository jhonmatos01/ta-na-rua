import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { AppError } from '../../src/shared/errors/app-error.js';
import { DefaultAiAnalysisService } from '../../src/modules/ai/ai.service.js';
import type {
  AiAnalysisContext,
  AiAnalysisRepository,
  AiClientResult,
  AiHttpClient,
  PersistAiAnalysisInput,
} from '../../src/modules/ai/ai.types.js';

const occurrenceId = '60000000-0000-4000-8000-000000000001';
const reportId = '70000000-0000-4000-8000-000000000001';
const nearbyId = '60000000-0000-4000-8000-000000000002';

const response = {
  category: 'POTHOLE',
  subcategory: 'ASPHALT_DAMAGE',
  severity: 4,
  risk: 'HIGH' as const,
  confidence: 0.91,
  summary: 'Buraco de grande dimensao.',
  requiresHumanReview: false,
  possibleDuplicates: [],
};

function context(): AiAnalysisContext {
  return {
    occurrenceId,
    reportId,
    createdBy: randomUUID(),
    status: 'PENDING_REVIEW',
    confirmationCount: 1,
    firstReportedAt: new Date('2026-07-18T00:00:00.000Z'),
    request: {
      reportId,
      imageUrl: 'https://example.test/image.webp',
      description: 'Buraco na via',
      latitude: -12.97,
      longitude: -38.5,
      nearbyOccurrences: [
        {
          id: nearbyId,
          category: 'POTHOLE',
          distanceMeters: 12,
          description: 'Outro buraco',
          imageUrls: [],
        },
      ],
      availableCategories: [{ code: 'POTHOLE', name: 'Buraco na via' }],
    },
    categories: [{ id: randomUUID(), code: 'POTHOLE', name: 'Buraco na via' }],
  };
}

class FakeRepository implements AiAnalysisRepository {
  public current: AiAnalysisContext | null = context();
  public persisted: PersistAiAnalysisInput[] = [];
  public priority: number | null = 44.5;

  public loadContext(): Promise<AiAnalysisContext | null> {
    return Promise.resolve(this.current);
  }

  public persist(input: PersistAiAnalysisInput) {
    this.persisted.push(input);
    return Promise.resolve({ analysisId: randomUUID(), occurrenceStatus: 'PENDING_REVIEW' });
  }

  public recalculatePriority(): Promise<number | null> {
    return Promise.resolve(this.priority);
  }
}

class FakeClient implements AiHttpClient {
  public constructor(public result: AiClientResult) {}

  public analyze(): Promise<AiClientResult> {
    return Promise.resolve(this.result);
  }
}

function successful(overrides: Partial<typeof response> = {}): AiClientResult {
  const value = { ...response, ...overrides };
  return { ok: true, attempts: 1, response: value, rawResponse: value };
}

function service(repository: FakeRepository, result: AiClientResult) {
  return new DefaultAiAnalysisService(
    repository,
    new FakeClient(result),
    undefined,
    () => new Date('2026-07-19T00:00:00.000Z'),
  );
}

describe('servico de analise por IA', () => {
  it('aplica classificacao valida sem alterar o status', async () => {
    const repository = new FakeRepository();
    const result = await service(repository, successful()).analyzeOccurrence(occurrenceId);
    expect(result).toMatchObject({
      state: 'VALIDATED',
      appliedClassification: true,
      requiresHumanReview: false,
      confidence: 0.91,
    });
    expect(repository.persisted[0]).toMatchObject({
      occurrenceId,
      suggestedCategory: 'POTHOLE',
      suggestedSeverity: 4,
      suggestedRisk: 'HIGH',
      applyClassification: true,
      requiresHumanReview: false,
    });
    expect(repository.persisted[0]!.priorityScore).toBeTypeOf('number');
    expect(repository.current!.status).toBe('PENDING_REVIEW');
  });

  it('mantem baixa confianca em revisao sem aplicar classificacao', async () => {
    const repository = new FakeRepository();
    const result = await service(repository, successful({ confidence: 0.5 })).analyzeOccurrence(
      occurrenceId,
    );
    expect(result).toMatchObject({
      state: 'VALIDATED',
      appliedClassification: false,
      requiresHumanReview: true,
    });
    expect(repository.persisted[0]).toMatchObject({
      applyClassification: false,
      priorityScore: null,
      requiresHumanReview: true,
    });
  });

  it('registra duplicidade como sugestao para revisao sem fusao automatica', async () => {
    const repository = new FakeRepository();
    const result = await service(
      repository,
      successful({
        possibleDuplicates: [
          { occurrenceId: nearbyId, similarity: 0.87, reason: 'Local e imagem semelhantes.' },
        ],
      }),
    ).analyzeOccurrence(occurrenceId, 'DUPLICATE_DETECTION');
    expect(result).toMatchObject({ possibleDuplicateCount: 1, requiresHumanReview: true });
    expect(repository.persisted[0]!.possibleDuplicates).toEqual([
      expect.objectContaining({
        occurrenceId: nearbyId,
        meetsThreshold: true,
        decision: 'REQUIRES_REVIEW',
      }),
    ]);
    expect(repository.persisted[0]).not.toHaveProperty('duplicateOfOccurrenceId');
  });

  it('rejeita categoria ou duplicidade fora do contexto', async () => {
    const repository = new FakeRepository();
    const result = await service(repository, successful({ category: 'UNKNOWN' })).analyzeOccurrence(
      occurrenceId,
    );
    expect(result).toMatchObject({
      state: 'DOMAIN_INCONSISTENCY',
      appliedClassification: false,
      requiresHumanReview: true,
    });
    expect(repository.persisted[0]).toMatchObject({
      suggestedCategory: null,
      state: 'DOMAIN_INCONSISTENCY',
    });
  });

  it.each(['INVALID_RESPONSE', 'TIMEOUT', 'UNAVAILABLE'] as const)(
    'salva fallback para %s e preserva a ocorrencia',
    async (state) => {
      const repository = new FakeRepository();
      const result = await service(repository, {
        ok: false,
        state,
        attempts: 2,
        rawResponse: { authorization: 'remover', reason: state },
      }).analyzeOccurrence(occurrenceId);
      expect(result).toMatchObject({
        state,
        appliedClassification: false,
        requiresHumanReview: true,
      });
      expect(repository.persisted[0]).toMatchObject({ confidence: 0, state });
      expect(JSON.stringify(repository.persisted[0]!.rawResult)).not.toContain('authorization');
    },
  );

  it('retorna 404 para ocorrencia inexistente', async () => {
    const repository = new FakeRepository();
    repository.current = null;
    await expect(
      service(repository, successful()).analyzeOccurrence(occurrenceId),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'OCCURRENCE_NOT_FOUND' });
  });

  it('recalcula prioridade pela rota interna sem envolver o cliente', async () => {
    const repository = new FakeRepository();
    await expect(
      service(repository, successful()).recalculatePriority(occurrenceId),
    ).resolves.toEqual({
      priorityScore: 44.5,
    });
    repository.priority = null;
    await expect(
      service(repository, successful()).recalculatePriority(occurrenceId),
    ).rejects.toMatchObject<AppError>({ statusCode: 404 });
  });
});
