import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { AppError } from '../../src/shared/errors/app-error.js';
import { DefaultConfirmationsService } from '../../src/modules/confirmations/confirmations.service.js';
import type {
  AddConfirmationResult,
  CalculatePriority,
  ConfirmationSummaryRecord,
  ConfirmationsRepository,
  CreateConfirmationData,
  PriorityRecalculationResult,
  RemoveConfirmationData,
  RemoveConfirmationResult,
} from '../../src/modules/confirmations/confirmations.types.js';
import { DefaultPriorityService } from '../../src/modules/confirmations/priority.service.js';
import type { RequestPrincipal } from '../../src/modules/occurrences/occurrences.types.js';

const occurrenceId = randomUUID();
const ownerId = randomUUID();
const municipalityId = randomUUID();
const now = new Date('2026-07-19T12:00:00.000Z');

const baseSummary: ConfirmationSummaryRecord = {
  occurrenceId,
  protocol: 'TNR-2026-000001',
  createdBy: ownerId,
  municipalityId,
  status: 'PUBLISHED',
  confirmationCount: 2,
  priorityScore: 31.75,
  confirmedByUser: true,
};

class FakeConfirmationsRepository implements ConfirmationsRepository {
  public addCalls = 0;
  public addResult: AddConfirmationResult = {
    kind: 'created',
    confirmation: {
      id: randomUUID(),
      occurrenceId,
      directlyAffected: true,
      problemWorsened: false,
      comment: 'Tambem vi.',
      createdAt: now,
      updatedAt: now,
    },
    summary: baseSummary,
  };
  public removeResult: RemoveConfirmationResult = { kind: 'removed', summary: baseSummary };
  public summary: ConfirmationSummaryRecord | null = baseSummary;

  public add(
    _data: CreateConfirmationData,
    calculatePriority: CalculatePriority,
  ): Promise<AddConfirmationResult> {
    this.addCalls += 1;
    calculatePriority({
      confirmationCount: 2,
      severity: 3,
      riskLevel: 'MEDIUM',
      firstReportedAt: now,
      calculatedAt: now,
    });
    return Promise.resolve(this.addResult);
  }

  public remove(
    _data: RemoveConfirmationData,
    calculatePriority: CalculatePriority,
  ): Promise<RemoveConfirmationResult> {
    calculatePriority({
      confirmationCount: 1,
      severity: 3,
      riskLevel: 'MEDIUM',
      firstReportedAt: now,
      calculatedAt: now,
    });
    return Promise.resolve(this.removeResult);
  }

  public getSummary(): Promise<ConfirmationSummaryRecord | null> {
    return Promise.resolve(this.summary);
  }

  public recalculateAll(): Promise<PriorityRecalculationResult> {
    return Promise.resolve({ processed: 1, correctedCounters: 0 });
  }
}

function principal(override: Partial<RequestPrincipal> = {}): RequestPrincipal {
  return {
    sub: randomUUID(),
    role: 'CITIZEN',
    municipalityId,
    ...override,
  };
}

function service(repository: FakeConfirmationsRepository) {
  return new DefaultConfirmationsService(repository, new DefaultPriorityService());
}

const input = {
  directlyAffected: true,
  problemWorsened: false,
  comment: 'Tambem vi.',
};
const context = { ipAddress: '127.0.0.1', userAgent: 'vitest' };
const addFailures: ReadonlyArray<readonly [AddConfirmationResult, number, string]> = [
  [{ kind: 'duplicate' }, 409, 'CONFIRMATION_ALREADY_EXISTS'],
  [{ kind: 'not_confirmable', status: 'RESOLVED' }, 409, 'OCCURRENCE_NOT_CONFIRMABLE'],
  [{ kind: 'occurrence_not_found' }, 404, 'OCCURRENCE_NOT_FOUND'],
];

describe('DefaultConfirmationsService', () => {
  it('cria a primeira confirmacao e retorna contador e prioridade', async () => {
    const repository = new FakeConfirmationsRepository();
    const result = (await service(repository).confirm(
      principal(),
      occurrenceId,
      input,
      context,
    )) as {
      confirmation: { occurrenceId: string };
      occurrence: { confirmationCount: number; priorityScore: number };
    };
    expect(result.confirmation.occurrenceId).toBe(occurrenceId);
    expect(result.occurrence).toEqual({ confirmationCount: 2, priorityScore: 31.75 });
  });

  it('rejeita perfil diferente de CITIZEN antes do repositorio', async () => {
    const repository = new FakeConfirmationsRepository();
    await expect(
      service(repository).confirm(
        principal({ role: 'CITY_OPERATOR' }),
        occurrenceId,
        input,
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'FORBIDDEN' });
    expect(repository.addCalls).toBe(0);
  });

  it.each(addFailures)('mapeia falha de inclusao %#', async (addResult, statusCode, code) => {
    const repository = new FakeConfirmationsRepository();
    repository.addResult = addResult;
    await expect(
      service(repository).confirm(principal(), occurrenceId, input, context),
    ).rejects.toMatchObject<AppError>({ statusCode, code });
  });

  it('remove a confirmacao propria', async () => {
    const repository = new FakeConfirmationsRepository();
    await expect(
      service(repository).remove(principal(), occurrenceId, context),
    ).resolves.toBeUndefined();
  });

  it('retorna 404 ao remover confirmacao inexistente', async () => {
    const repository = new FakeConfirmationsRepository();
    repository.removeResult = { kind: 'confirmation_not_found' };
    await expect(
      service(repository).remove(principal(), occurrenceId, context),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'CONFIRMATION_NOT_FOUND' });
  });

  it('oculta contagem de pendencia para publico e libera o autor', async () => {
    const repository = new FakeConfirmationsRepository();
    repository.summary = { ...baseSummary, status: 'PENDING_REVIEW' };
    await expect(
      service(repository).count(undefined, occurrenceId),
    ).rejects.toMatchObject<AppError>({ statusCode: 404, code: 'OCCURRENCE_NOT_FOUND' });
    await expect(
      service(repository).count(principal({ sub: ownerId }), occurrenceId),
    ).resolves.toMatchObject({ confirmationCount: 2, confirmedByMe: true });
  });

  it('retorna contagem publica sem expor estado pessoal', async () => {
    const repository = new FakeConfirmationsRepository();
    const result = (await service(repository).count(undefined, occurrenceId)) as Record<
      string,
      unknown
    >;
    expect(result).toMatchObject({ occurrenceId, confirmationCount: 2, priorityScore: 31.75 });
    expect(result).not.toHaveProperty('confirmedByMe');
  });
});
