import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DefaultPriorityService } from '../../src/modules/confirmations/priority.service.js';
import type { EvaluationPolicy } from '../../src/modules/evaluations/evaluation-policy.js';
import { DefaultEvaluationsService } from '../../src/modules/evaluations/evaluations.service.js';
import type {
  CreateEvaluationData,
  CreateEvaluationResult,
  EvaluationListResult,
  EvaluationRecord,
  EvaluationSummaryRecord,
  EvaluationsRepository,
  EvaluationVisibility,
  UpdateEvaluationData,
  UpdateEvaluationResult,
} from '../../src/modules/evaluations/evaluations.types.js';
import type { RequestPrincipal } from '../../src/modules/occurrences/occurrences.types.js';
import type { AppError } from '../../src/shared/errors/app-error.js';

const occurrenceId = randomUUID();
const municipalityId = randomUUID();
const citizenId = randomUUID();
const evaluationId = randomUUID();
const now = new Date('2026-07-19T15:00:00.000Z');
const context = { ipAddress: '127.0.0.1', userAgent: 'vitest' };
const policy: EvaluationPolicy = {
  editWindowDays: 7,
  negativeThreshold: 0.5,
  minimumCountForContestation: 3,
};

function evaluation(overrides: Partial<EvaluationRecord> = {}): EvaluationRecord {
  return {
    id: evaluationId,
    occurrenceId,
    userId: citizenId,
    rating: 2,
    problemResolved: false,
    serviceQuality: 2,
    comment: 'O problema continua.',
    createdAt: new Date('2026-07-18T15:00:00.000Z'),
    updatedAt: new Date('2026-07-18T15:00:00.000Z'),
    ...overrides,
  };
}

function summary(overrides: Partial<EvaluationSummaryRecord> = {}): EvaluationSummaryRecord {
  return {
    occurrenceId,
    occurrenceStatus: 'RESOLVED',
    total: 3,
    negativeCount: 2,
    averageRating: 2.67,
    averageServiceQuality: 3,
    ...overrides,
  };
}

class FakeEvaluationsRepository implements EvaluationsRepository {
  public createResult: CreateEvaluationResult = {
    kind: 'created',
    evaluation: evaluation(),
    summary: summary({ occurrenceStatus: 'CONTESTED' }),
    occurrenceContested: true,
  };
  public updateResult: UpdateEvaluationResult = {
    kind: 'updated',
    evaluation: evaluation({ rating: 4, problemResolved: true }),
    summary: summary({ negativeCount: 1 }),
    occurrenceContested: false,
  };
  public visibility: EvaluationVisibility | null = {
    id: occurrenceId,
    createdBy: citizenId,
    municipalityId,
    status: 'RESOLVED',
    relatedToUser: true,
  };
  public listResult: EvaluationListResult = { items: [evaluation()], total: 1 };
  public summaryResult: EvaluationSummaryRecord | null = summary();
  public lastCreate: CreateEvaluationData | null = null;
  public lastUpdate: UpdateEvaluationData | null = null;

  public create(data: CreateEvaluationData): Promise<CreateEvaluationResult> {
    this.lastCreate = data;
    return Promise.resolve(this.createResult);
  }

  public update(data: UpdateEvaluationData): Promise<UpdateEvaluationResult> {
    this.lastUpdate = data;
    return Promise.resolve(this.updateResult);
  }

  public findVisibility(): Promise<EvaluationVisibility | null> {
    return Promise.resolve(this.visibility);
  }

  public list(): Promise<EvaluationListResult> {
    return Promise.resolve(this.listResult);
  }

  public summary(): Promise<EvaluationSummaryRecord | null> {
    return Promise.resolve(this.summaryResult);
  }
}

function principal(overrides: Partial<RequestPrincipal> = {}): RequestPrincipal {
  return { sub: citizenId, role: 'CITIZEN', municipalityId, ...overrides };
}

function service(repository: FakeEvaluationsRepository) {
  return new DefaultEvaluationsService(repository, new DefaultPriorityService(), policy, () => now);
}

describe('DefaultEvaluationsService', () => {
  it('cria a avaliacao e publica os indicadores sem identificar outros usuarios', async () => {
    const repository = new FakeEvaluationsRepository();
    const result = (await service(repository).create(
      principal(),
      occurrenceId,
      { rating: 2, problemResolved: false, serviceQuality: 2, comment: 'Continua.' },
      context,
    )) as {
      evaluation: Record<string, unknown>;
      summary: Record<string, unknown>;
      occurrenceContested: boolean;
    };
    expect(repository.lastCreate).toMatchObject({ occurrenceId, userId: citizenId, now });
    expect(result.evaluation).toMatchObject({ id: evaluationId, isMine: true });
    expect(result.evaluation).not.toHaveProperty('userId');
    expect(result.summary).toMatchObject({
      negativePercentage: 66.67,
      eligibleForContestation: true,
      negativeThresholdPercentage: 50,
    });
    expect(result.occurrenceContested).toBe(true);
  });

  it('mapeia status invalido, ausencia de relacao e duplicidade', async () => {
    const repository = new FakeEvaluationsRepository();
    repository.createResult = { kind: 'status_not_evaluable', status: 'IN_PROGRESS' };
    await expect(
      service(repository).create(
        principal(),
        occurrenceId,
        { rating: 3, problemResolved: false, serviceQuality: null, comment: null },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 409, code: 'OCCURRENCE_NOT_EVALUABLE' });
    repository.createResult = { kind: 'user_not_related' };
    await expect(
      service(repository).create(
        principal(),
        occurrenceId,
        { rating: 3, problemResolved: false, serviceQuality: null, comment: null },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'OCCURRENCE_RELATION_REQUIRED' });
    repository.createResult = { kind: 'duplicate' };
    await expect(
      service(repository).create(
        principal(),
        occurrenceId,
        { rating: 3, problemResolved: false, serviceQuality: null, comment: null },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 409, code: 'EVALUATION_ALREADY_EXISTS' });
  });

  it('mapeia ocorrencia inexistente na criacao', async () => {
    const repository = new FakeEvaluationsRepository();
    repository.createResult = { kind: 'occurrence_not_found' };
    await expect(
      service(repository).create(
        principal(),
        occurrenceId,
        { rating: 5, problemResolved: true, serviceQuality: 5, comment: null },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'OCCURRENCE_NOT_FOUND' });
  });

  it('edita a propria avaliacao durante o prazo', async () => {
    const repository = new FakeEvaluationsRepository();
    const result = (await service(repository).updateMine(
      principal(),
      occurrenceId,
      { rating: 4, problemResolved: true },
      context,
    )) as { evaluation: Record<string, unknown> };
    expect(repository.lastUpdate).toMatchObject({ occurrenceId, userId: citizenId, now });
    expect(result.evaluation).toMatchObject({ rating: 4, problemResolved: true, isMine: true });
  });

  it('mapeia avaliacao ausente, prazo expirado e status de edicao invalido', async () => {
    const repository = new FakeEvaluationsRepository();
    repository.updateResult = { kind: 'evaluation_not_found' };
    await expect(
      service(repository).updateMine(principal(), occurrenceId, { rating: 3 }, context),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'EVALUATION_NOT_FOUND' });
    repository.updateResult = {
      kind: 'edit_window_expired',
      deadline: new Date('2026-07-18T15:00:00.000Z'),
    };
    await expect(
      service(repository).updateMine(principal(), occurrenceId, { rating: 3 }, context),
    ).rejects.toMatchObject<AppError>({
      statusCode: 409,
      code: 'EVALUATION_EDIT_WINDOW_EXPIRED',
    });
    repository.updateResult = { kind: 'status_not_editable', status: 'IN_PROGRESS' };
    await expect(
      service(repository).updateMine(principal(), occurrenceId, { rating: 3 }, context),
    ).rejects.toMatchObject<AppError>({
      statusCode: 409,
      code: 'EVALUATION_NOT_EDITABLE_FOR_STATUS',
    });
  });

  it('mapeia ocorrencia inexistente na edicao', async () => {
    const repository = new FakeEvaluationsRepository();
    repository.updateResult = { kind: 'occurrence_not_found' };
    await expect(
      service(repository).updateMine(principal(), occurrenceId, { rating: 3 }, context),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'OCCURRENCE_NOT_FOUND' });
  });

  it('restringe a listagem detalhada por relacao, perfil e municipio', async () => {
    const repository = new FakeEvaluationsRepository();
    repository.visibility = { ...repository.visibility!, relatedToUser: false };
    await expect(
      service(repository).list(principal(), occurrenceId, { page: 1, limit: 20 }),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'EVALUATIONS_FORBIDDEN' });
    await expect(
      service(repository).list(
        principal({ role: 'CITY_OPERATOR', municipalityId: randomUUID() }),
        occurrenceId,
        { page: 1, limit: 20 },
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'EVALUATIONS_FORBIDDEN' });
    await expect(
      service(repository).list(principal({ role: 'MODERATOR' }), occurrenceId, {
        page: 1,
        limit: 20,
      }),
    ).resolves.toMatchObject({ pagination: { total: 1 } });
  });

  it('retorna 404 ao listar ocorrencia inexistente', async () => {
    const repository = new FakeEvaluationsRepository();
    repository.visibility = null;
    await expect(
      service(repository).list(principal(), occurrenceId, { page: 1, limit: 20 }),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'OCCURRENCE_NOT_FOUND' });
  });

  it('publica apenas o resumo agregado quando a ocorrencia e visivel', async () => {
    const repository = new FakeEvaluationsRepository();
    await expect(service(repository).summary(undefined, occurrenceId)).resolves.toMatchObject({
      summary: { total: 3, negativeCount: 2, averageRating: 2.67 },
    });
    repository.visibility = { ...repository.visibility!, status: 'PENDING_REVIEW' };
    await expect(
      service(repository).summary(undefined, occurrenceId),
    ).rejects.toMatchObject<AppError>({ statusCode: 404 });
    repository.summaryResult = null;
    repository.visibility = { ...repository.visibility, status: 'RESOLVED', relatedToUser: true };
    await expect(
      service(repository).summary(principal(), occurrenceId),
    ).rejects.toMatchObject<AppError>({ statusCode: 404 });
  });

  it('impede perfis operacionais de criar ou editar avaliacoes', async () => {
    const repository = new FakeEvaluationsRepository();
    const operator = principal({ role: 'CITY_OPERATOR' });
    await expect(
      service(repository).create(
        operator,
        occurrenceId,
        { rating: 5, problemResolved: true, serviceQuality: null, comment: null },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'FORBIDDEN' });
    await expect(
      service(repository).updateMine(operator, occurrenceId, { rating: 5 }, context),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'FORBIDDEN' });
  });
});
