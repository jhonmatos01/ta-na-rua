import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import type { AiAnalysisService, AiAnalysisType } from '../../src/modules/ai/ai.types.js';

interface PriorityResponseBody {
  data: { priorityScore: number };
}

function fakeService(): AiAnalysisService & {
  analyzeOccurrence: ReturnType<typeof vi.fn<AiAnalysisService['analyzeOccurrence']>>;
  recalculatePriority: ReturnType<typeof vi.fn<AiAnalysisService['recalculatePriority']>>;
} {
  const analyzeOccurrence = vi.fn<AiAnalysisService['analyzeOccurrence']>(
    (_occurrenceId: string, _analysisType?: AiAnalysisType) =>
      Promise.resolve({
        analysisId: randomUUID(),
        state: 'VALIDATED',
        attempts: 1,
        appliedClassification: true,
        requiresHumanReview: false,
        confidence: 0.91,
        possibleDuplicateCount: 0,
      }),
  );
  const recalculatePriority = vi.fn<AiAnalysisService['recalculatePriority']>(() =>
    Promise.resolve({ priorityScore: 42.5 }),
  );
  return {
    analyzeAfterCreation: (occurrenceId) => analyzeOccurrence(occurrenceId, 'CLASSIFICATION'),
    analyzeOccurrence,
    recalculatePriority,
  };
}

describe('rotas internas da Fase 7', () => {
  it('nao deixa as rotas abertas sem o segredo correto', async () => {
    const app = createApp({ aiService: fakeService() });
    await request(app)
      .post('/api/v1/internal/ai/classify')
      .send({ occurrenceId: randomUUID() })
      .expect(401);
    await request(app)
      .post('/api/v1/internal/ai/classify')
      .set('x-ai-service-secret', 'incorreto')
      .send({ occurrenceId: randomUUID() })
      .expect(401);
  });

  it('valida UUID antes de chamar a classificacao', async () => {
    const service = fakeService();
    await request(createApp({ aiService: service }))
      .post('/api/v1/internal/ai/classify')
      .set('x-ai-service-secret', env.AI_SERVICE_SECRET!)
      .send({ occurrenceId: 'invalido' })
      .expect(422);
    expect(service.analyzeOccurrence).not.toHaveBeenCalled();
  });

  it('executa classificacao e deteccao de duplicidade autenticadas', async () => {
    const service = fakeService();
    const occurrenceId = randomUUID();
    const app = createApp({ aiService: service });
    await request(app)
      .post('/api/v1/internal/ai/classify')
      .set('x-ai-service-secret', env.AI_SERVICE_SECRET!)
      .send({ occurrenceId })
      .expect(200);
    await request(app)
      .post('/api/v1/internal/ai/find-duplicates')
      .set('x-ai-service-secret', env.AI_SERVICE_SECRET!)
      .send({ occurrenceId })
      .expect(200);
    expect(service.analyzeOccurrence).toHaveBeenNthCalledWith(1, occurrenceId, 'CLASSIFICATION');
    expect(service.analyzeOccurrence).toHaveBeenNthCalledWith(
      2,
      occurrenceId,
      'DUPLICATE_DETECTION',
    );
  });

  it('recalcula prioridade pela rota interna protegida', async () => {
    const service = fakeService();
    const occurrenceId = randomUUID();
    const response = await request(createApp({ aiService: service }))
      .post('/api/v1/internal/ai/recalculate-priority')
      .set('x-ai-service-secret', env.AI_SERVICE_SECRET!)
      .send({ occurrenceId })
      .expect(200);
    expect((response.body as PriorityResponseBody).data.priorityScore).toBe(42.5);
    expect(service.recalculatePriority).toHaveBeenCalledWith(occurrenceId);
  });
});
