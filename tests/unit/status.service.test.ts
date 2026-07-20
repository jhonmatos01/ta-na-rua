import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DefaultPriorityService } from '../../src/modules/confirmations/priority.service.js';
import type { RequestPrincipal } from '../../src/modules/occurrences/occurrences.types.js';
import { DefaultStatusService } from '../../src/modules/status/status.service.js';
import type {
  AssignmentData,
  AssignmentResult,
  LockedStatusOccurrence,
  PrepareAssignment,
  PrepareStatusTransition,
  StatusHistoryRecord,
  StatusOccurrenceVisibility,
  StatusRepository,
  StatusTransitionData,
  StatusTransitionResult,
} from '../../src/modules/status/status.types.js';
import type { AppError } from '../../src/shared/errors/app-error.js';

const municipalityId = randomUUID();
const occurrenceId = randomUUID();
const ownerId = randomUUID();
const actorId = randomUUID();
const now = new Date('2026-07-19T15:00:00.000Z');
const context = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

function occurrence(overrides: Partial<LockedStatusOccurrence> = {}): LockedStatusOccurrence {
  return {
    id: occurrenceId,
    protocol: 'TNR-2026-000001',
    createdBy: ownerId,
    municipalityId,
    status: 'PUBLISHED',
    assignedDepartmentId: null,
    assignedBy: null,
    assignedAt: null,
    expectedResolutionAt: null,
    scheduledFor: null,
    resolutionDescription: null,
    resolvedAt: null,
    resolvedBy: null,
    closedAt: null,
    closedBy: null,
    duplicateOfOccurrenceId: null,
    confirmationCount: 2,
    priorityScore: 25,
    severity: 4,
    riskLevel: 'HIGH',
    firstReportedAt: new Date('2026-07-09T15:00:00.000Z'),
    ...overrides,
  };
}

class FakeStatusRepository implements StatusRepository {
  public current = occurrence();
  public transitionResult: StatusTransitionResult | null = null;
  public assignmentResult: AssignmentResult | null = null;
  public visibility: StatusOccurrenceVisibility | null = {
    id: occurrenceId,
    createdBy: ownerId,
    municipalityId,
    status: 'PUBLISHED',
  };
  public historyRows: StatusHistoryRecord[] = [
    {
      id: randomUUID(),
      previousStatus: 'PENDING_REVIEW',
      newStatus: 'PUBLISHED',
      reason: 'Revisao aprovada.',
      publicMessage: 'Publicada.',
      changedBy: actorId,
      createdAt: now,
    },
  ];

  public transition(
    _data: StatusTransitionData,
    prepare: PrepareStatusTransition,
  ): Promise<StatusTransitionResult> {
    if (this.transitionResult !== null) return Promise.resolve(this.transitionResult);
    return Promise.resolve({
      kind: 'updated',
      occurrence: { ...this.current, ...prepare(this.current) },
    });
  }

  public assign(_data: AssignmentData, prepare: PrepareAssignment): Promise<AssignmentResult> {
    if (this.assignmentResult !== null) return Promise.resolve(this.assignmentResult);
    const prepared = prepare(this.current);
    return Promise.resolve({
      kind: 'updated',
      occurrence: {
        ...this.current,
        assignedDepartmentId: prepared.departmentId,
        expectedResolutionAt: prepared.expectedResolutionAt,
      },
    });
  }

  public findVisibility(): Promise<StatusOccurrenceVisibility | null> {
    return Promise.resolve(this.visibility);
  }

  public history(): Promise<StatusHistoryRecord[]> {
    return Promise.resolve(this.historyRows);
  }
}

function principal(overrides: Partial<RequestPrincipal> = {}): RequestPrincipal {
  return { sub: actorId, role: 'CITY_OPERATOR', municipalityId, ...overrides };
}

function service(repository: FakeStatusRepository) {
  return new DefaultStatusService(repository, new DefaultPriorityService(), () => now);
}

describe('DefaultStatusService', () => {
  it('encaminha para departamento com previsao futura', async () => {
    const repository = new FakeStatusRepository();
    const departmentId = randomUUID();
    const expectedResolutionAt = new Date('2026-07-22T15:00:00.000Z');
    const result = (await service(repository).transition(
      principal(),
      occurrenceId,
      { status: 'FORWARDED', departmentId, expectedResolutionAt },
      context,
    )) as { occurrence: LockedStatusOccurrence };
    expect(result.occurrence).toMatchObject({
      status: 'FORWARDED',
      assignedDepartmentId: departmentId,
      assignedBy: actorId,
      expectedResolutionAt,
    });
  });

  it('rejeita transicao inexistente com 409', async () => {
    const repository = new FakeStatusRepository();
    await expect(
      service(repository).transition(
        principal({ role: 'ADMIN' }),
        occurrenceId,
        { status: 'RESOLVED' },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('limita operador por municipio e por transicao de moderacao', async () => {
    const repository = new FakeStatusRepository();
    await expect(
      service(repository).transition(
        principal({ municipalityId: randomUUID() }),
        occurrenceId,
        {
          status: 'FORWARDED',
          departmentId: randomUUID(),
          expectedResolutionAt: new Date('2026-07-22T15:00:00.000Z'),
        },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'MUNICIPALITY_FORBIDDEN' });

    repository.current = occurrence({ status: 'PENDING_REVIEW' });
    await expect(
      service(repository).transition(principal(), occurrenceId, { status: 'PUBLISHED' }, context),
    ).rejects.toMatchObject<AppError>({ statusCode: 403, code: 'STATUS_TRANSITION_FORBIDDEN' });
  });

  it('exige os campos especificos de encaminhamento, agendamento e resolucao', async () => {
    const repository = new FakeStatusRepository();
    await expect(
      service(repository).transition(principal(), occurrenceId, { status: 'FORWARDED' }, context),
    ).rejects.toMatchObject<AppError>({ code: 'DEPARTMENT_REQUIRED' });

    repository.current = occurrence({ status: 'UNDER_ANALYSIS' });
    await expect(
      service(repository).transition(principal(), occurrenceId, { status: 'SCHEDULED' }, context),
    ).rejects.toMatchObject<AppError>({ code: 'SCHEDULED_FOR_REQUIRED' });

    repository.current = occurrence({ status: 'IN_PROGRESS' });
    await expect(
      service(repository).transition(principal(), occurrenceId, { status: 'RESOLVED' }, context),
    ).rejects.toMatchObject<AppError>({ code: 'RESOLUTION_DESCRIPTION_REQUIRED' });
  });

  it('registra resolucao e fechamento nos campos definitivos', async () => {
    const repository = new FakeStatusRepository();
    repository.current = occurrence({ status: 'IN_PROGRESS' });
    const resolved = (await service(repository).transition(
      principal(),
      occurrenceId,
      { status: 'RESOLVED', resolutionDescription: 'Via reparada.' },
      context,
    )) as { occurrence: LockedStatusOccurrence };
    expect(resolved.occurrence).toMatchObject({
      status: 'RESOLVED',
      resolutionDescription: 'Via reparada.',
      resolvedAt: now,
      resolvedBy: actorId,
    });

    repository.current = { ...resolved.occurrence, status: 'RESOLVED' };
    const closed = (await service(repository).transition(
      principal(),
      occurrenceId,
      { status: 'CLOSED' },
      context,
    )) as { occurrence: LockedStatusOccurrence };
    expect(closed.occurrence).toMatchObject({ status: 'CLOSED', closedAt: now, closedBy: actorId });
  });

  it('exige alvo e motivo ao marcar duplicidade', async () => {
    const repository = new FakeStatusRepository();
    await expect(
      service(repository).transition(
        principal({ role: 'MODERATOR' }),
        occurrenceId,
        { status: 'DUPLICATE' },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ code: 'DUPLICATE_TARGET_REQUIRED' });
    await expect(
      service(repository).transition(
        principal({ role: 'MODERATOR' }),
        occurrenceId,
        { status: 'DUPLICATE', duplicateOfOccurrenceId: randomUUID() },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ code: 'STATUS_REASON_REQUIRED' });
  });

  it('reabre ocorrencia, limpa conclusao e recalcula prioridade', async () => {
    const repository = new FakeStatusRepository();
    repository.current = occurrence({
      status: 'RESOLVED',
      resolutionDescription: 'Tentativa anterior.',
      resolvedAt: new Date('2026-07-18T15:00:00.000Z'),
      resolvedBy: randomUUID(),
      priorityScore: 1,
    });
    const result = (await service(repository).transition(
      principal(),
      occurrenceId,
      { status: 'IN_PROGRESS', reason: 'Problema voltou.' },
      context,
    )) as { occurrence: LockedStatusOccurrence };
    expect(result.occurrence.resolvedAt).toBeNull();
    expect(result.occurrence.resolutionDescription).toBeNull();
    expect(result.occurrence.priorityScore).toBeGreaterThan(1);
  });

  it('atribui ou reatribui somente em status operacional', async () => {
    const repository = new FakeStatusRepository();
    const departmentId = randomUUID();
    await expect(
      service(repository).assign(principal(), occurrenceId, { departmentId }, context),
    ).resolves.toMatchObject({ occurrence: { assignedDepartmentId: departmentId } });
    repository.current = occurrence({ status: 'CLOSED' });
    await expect(
      service(repository).assign(principal(), occurrenceId, { departmentId }, context),
    ).rejects.toMatchObject<AppError>({ statusCode: 409, code: 'OCCURRENCE_NOT_ASSIGNABLE' });
  });

  it('oculta motivo e autor da mudanca no historico publico', async () => {
    const repository = new FakeStatusRepository();
    const publicResult = (await service(repository).history(undefined, occurrenceId)) as {
      history: Array<Record<string, unknown>>;
    };
    expect(publicResult.history[0]).not.toHaveProperty('reason');
    expect(publicResult.history[0]).not.toHaveProperty('changedBy');
    const detailed = (await service(repository).history(
      principal({ sub: ownerId, role: 'CITIZEN' }),
      occurrenceId,
    )) as { history: Array<Record<string, unknown>> };
    expect(detailed.history[0]).toMatchObject({ reason: 'Revisao aprovada.', changedBy: actorId });
  });

  it('mapeia falhas atomicas do repositorio', async () => {
    const repository = new FakeStatusRepository();
    repository.transitionResult = { kind: 'department_not_found' };
    await expect(
      service(repository).transition(
        principal(),
        occurrenceId,
        {
          status: 'FORWARDED',
          departmentId: randomUUID(),
          expectedResolutionAt: new Date('2026-07-22T15:00:00.000Z'),
        },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ code: 'INVALID_DEPARTMENT' });
    repository.transitionResult = { kind: 'occurrence_not_found' };
    await expect(
      service(repository).transition(
        principal(),
        occurrenceId,
        {
          status: 'FORWARDED',
          departmentId: randomUUID(),
          expectedResolutionAt: new Date('2026-07-22T15:00:00.000Z'),
        },
        context,
      ),
    ).rejects.toMatchObject<AppError>({ code: 'OCCURRENCE_NOT_FOUND' });
  });
});
