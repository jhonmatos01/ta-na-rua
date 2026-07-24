import { AppError } from '../../shared/errors/app-error.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { RequestPrincipal } from '../occurrences/occurrences.types.js';
import type { PriorityService } from '../confirmations/priority.service.js';
import {
  canRoleTransition,
  isValidStatusTransition,
  validStatusTransitions,
} from './status-machine.js';
import type {
  UpdateOccurrenceAssignmentInput,
  UpdateOccurrenceStatusInput,
} from './status.schemas.js';
import type {
  LockedStatusOccurrence,
  PreparedStatusTransition,
  StatusOccurrenceVisibility,
  StatusRepository,
  StatusService,
} from './status.types.js';

const reopenTargets = new Set([
  'PENDING_REVIEW',
  'PUBLISHED',
  'FORWARDED',
  'ACKNOWLEDGED',
  'UNDER_ANALYSIS',
  'SCHEDULED',
  'IN_PROGRESS',
  'CONTESTED',
]);
const terminalStatuses = new Set(['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE']);
const assignmentStatuses = new Set([
  'PUBLISHED',
  'FORWARDED',
  'ACKNOWLEDGED',
  'UNDER_ANALYSIS',
  'SCHEDULED',
  'IN_PROGRESS',
  'CONTESTED',
]);

type StatusActionField =
  | 'departmentId'
  | 'duplicateOfOccurrenceId'
  | 'expectedResolutionAt'
  | 'reason'
  | 'resolutionDescription'
  | 'scheduledFor';

function requiredFields(
  previousStatus: LockedStatusOccurrence['status'],
  newStatus: LockedStatusOccurrence['status'],
): StatusActionField[] {
  const fields: StatusActionField[] = [];
  if (newStatus === 'FORWARDED') fields.push('departmentId', 'expectedResolutionAt');
  if (newStatus === 'SCHEDULED') fields.push('scheduledFor');
  if (newStatus === 'RESOLVED') fields.push('resolutionDescription');
  if (newStatus === 'DUPLICATE') fields.push('duplicateOfOccurrenceId');
  const reopening =
    (terminalStatuses.has(previousStatus) && reopenTargets.has(newStatus)) ||
    previousStatus === 'CONTESTED';
  if (['REJECTED', 'DUPLICATE', 'CONTESTED'].includes(newStatus) || reopening) {
    fields.push('reason');
  }
  return fields;
}

function serialize(occurrence: LockedStatusOccurrence) {
  return {
    id: occurrence.id,
    protocol: occurrence.protocol,
    status: occurrence.status,
    municipalityId: occurrence.municipalityId,
    assignedDepartmentId: occurrence.assignedDepartmentId,
    assignedBy: occurrence.assignedBy,
    assignedAt: occurrence.assignedAt,
    expectedResolutionAt: occurrence.expectedResolutionAt,
    scheduledFor: occurrence.scheduledFor,
    resolutionDescription: occurrence.resolutionDescription,
    resolvedAt: occurrence.resolvedAt,
    resolvedBy: occurrence.resolvedBy,
    closedAt: occurrence.closedAt,
    closedBy: occurrence.closedBy,
    duplicateOfOccurrenceId: occurrence.duplicateOfOccurrenceId,
    priorityScore: occurrence.priorityScore,
  };
}

function canSeeRestricted(
  occurrence: StatusOccurrenceVisibility,
  principal: RequestPrincipal | undefined,
): boolean {
  if (!['PENDING_REVIEW', 'REJECTED'].includes(occurrence.status)) return true;
  if (principal === undefined) return false;
  if (principal.role === 'ADMIN' || principal.role === 'MODERATOR') return true;
  if (principal.sub === occurrence.createdBy) return true;
  return (
    principal.role === 'CITY_OPERATOR' && principal.municipalityId === occurrence.municipalityId
  );
}

export class DefaultStatusService implements StatusService {
  public constructor(
    private readonly repository: StatusRepository,
    private readonly priorityService: PriorityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async transition(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: UpdateOccurrenceStatusInput,
    context: RequestContext,
  ): Promise<unknown> {
    this.requireOperational(principal);
    const now = this.now();
    const result = await this.repository.transition(
      { occurrenceId, actorId: principal.sub, input, context, now },
      (occurrence) => this.prepareTransition(principal, occurrence, input, now),
    );
    if (result.kind === 'occurrence_not_found') this.notFound();
    if (result.kind === 'department_not_found') {
      throw new AppError(
        422,
        'INVALID_DEPARTMENT',
        'O departamento deve estar ativo e pertencer ao municipio da ocorrencia.',
      );
    }
    if (result.kind === 'duplicate_target_invalid') {
      throw new AppError(
        422,
        'INVALID_DUPLICATE_TARGET',
        'A ocorrencia principal e invalida para esta decisao de duplicidade.',
      );
    }
    return { occurrence: serialize(result.occurrence) };
  }

  public async assign(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: UpdateOccurrenceAssignmentInput,
    context: RequestContext,
  ): Promise<unknown> {
    this.requireOperational(principal);
    const now = this.now();
    const result = await this.repository.assign(
      { occurrenceId, actorId: principal.sub, input, context, now },
      (occurrence) => {
        this.requireMunicipality(principal, occurrence.municipalityId);
        if (!assignmentStatuses.has(occurrence.status)) {
          throw new AppError(
            409,
            'OCCURRENCE_NOT_ASSIGNABLE',
            `A ocorrencia nao aceita atribuicao no status ${occurrence.status}.`,
          );
        }
        if (
          input.expectedResolutionAt !== undefined &&
          input.expectedResolutionAt.getTime() <= now.getTime()
        ) {
          throw new AppError(
            422,
            'INVALID_EXPECTED_RESOLUTION_AT',
            'A previsao de resolucao deve estar no futuro.',
          );
        }
        return {
          departmentId: input.departmentId,
          expectedResolutionAt: input.expectedResolutionAt ?? occurrence.expectedResolutionAt,
        };
      },
    );
    if (result.kind === 'occurrence_not_found') this.notFound();
    if (result.kind === 'department_not_found') {
      throw new AppError(
        422,
        'INVALID_DEPARTMENT',
        'O departamento deve estar ativo e pertencer ao municipio da ocorrencia.',
      );
    }
    return { occurrence: serialize(result.occurrence) };
  }

  public async capabilities(principal: RequestPrincipal, occurrenceId: string): Promise<unknown> {
    this.requireOperational(principal);
    const occurrence = await this.repository.findOperational(occurrenceId);
    if (occurrence === null) this.notFound();
    this.requireMunicipality(principal, occurrence.municipalityId);
    return {
      occurrence: serialize(occurrence),
      actions: validStatusTransitions[occurrence.status]
        .filter((status) => canRoleTransition(principal.role, occurrence.status, status))
        .map((status) => ({ status, requiredFields: requiredFields(occurrence.status, status) })),
      canAssign: assignmentStatuses.has(occurrence.status),
      canDelete: principal.role === 'ADMIN' || principal.role === 'MODERATOR',
    };
  }

  public async history(
    principal: RequestPrincipal | undefined,
    occurrenceId: string,
  ): Promise<unknown> {
    const occurrence = await this.repository.findVisibility(occurrenceId);
    if (occurrence === null || !canSeeRestricted(occurrence, principal)) this.notFound();
    const detailed =
      principal !== undefined &&
      (principal.role === 'ADMIN' ||
        principal.role === 'MODERATOR' ||
        principal.sub === occurrence.createdBy ||
        (principal.role === 'CITY_OPERATOR' &&
          principal.municipalityId === occurrence.municipalityId));
    const history = await this.repository.history(occurrenceId);
    return {
      history: history.map((item) => ({
        id: item.id,
        previousStatus: item.previousStatus,
        newStatus: item.newStatus,
        publicMessage: item.publicMessage,
        ...(detailed ? { reason: item.reason, changedBy: item.changedBy } : {}),
        createdAt: item.createdAt,
      })),
    };
  }

  private prepareTransition(
    principal: RequestPrincipal,
    occurrence: LockedStatusOccurrence,
    input: UpdateOccurrenceStatusInput,
    now: Date,
  ): PreparedStatusTransition {
    this.requireMunicipality(principal, occurrence.municipalityId);
    if (!isValidStatusTransition(occurrence.status, input.status)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Nao e possivel alterar diretamente de ${occurrence.status} para ${input.status}.`,
        { previousStatus: occurrence.status, newStatus: input.status },
      );
    }
    if (!canRoleTransition(principal.role, occurrence.status, input.status)) {
      throw new AppError(
        403,
        'STATUS_TRANSITION_FORBIDDEN',
        'Seu perfil nao pode executar esta transicao de status.',
      );
    }
    this.validateRequiredFields(occurrence, input, now);

    let assignedDepartmentId = occurrence.assignedDepartmentId;
    let assignedBy = occurrence.assignedBy;
    let assignedAt = occurrence.assignedAt;
    let expectedResolutionAt = occurrence.expectedResolutionAt;
    let scheduledFor = occurrence.scheduledFor;
    let resolutionDescription = occurrence.resolutionDescription;
    let resolvedAt = occurrence.resolvedAt;
    let resolvedBy = occurrence.resolvedBy;
    let closedAt = occurrence.closedAt;
    let closedBy = occurrence.closedBy;
    let duplicateOfOccurrenceId = occurrence.duplicateOfOccurrenceId;

    if (input.status === 'FORWARDED') {
      assignedDepartmentId = input.departmentId!;
      assignedBy = principal.sub;
      assignedAt = now;
      expectedResolutionAt = input.expectedResolutionAt!;
    }
    if (input.status === 'SCHEDULED') scheduledFor = input.scheduledFor!;
    if (occurrence.status === 'SCHEDULED' && input.status === 'UNDER_ANALYSIS') {
      scheduledFor = null;
    }
    if (input.status === 'RESOLVED') {
      resolutionDescription = input.resolutionDescription!;
      resolvedAt = now;
      resolvedBy = principal.sub;
      closedAt = null;
      closedBy = null;
    }
    if (input.status === 'CLOSED') {
      closedAt = now;
      closedBy = principal.sub;
    }
    if (input.status === 'DUPLICATE') {
      duplicateOfOccurrenceId = input.duplicateOfOccurrenceId!;
    } else if (occurrence.status === 'DUPLICATE') {
      duplicateOfOccurrenceId = null;
    }

    const reopened =
      (terminalStatuses.has(occurrence.status) && reopenTargets.has(input.status)) ||
      (occurrence.status === 'CONTESTED' && input.status === 'IN_PROGRESS');
    if (reopened) {
      resolvedAt = null;
      resolvedBy = null;
      closedAt = null;
      closedBy = null;
      if (input.status !== 'CONTESTED') resolutionDescription = null;
    }
    const priorityScore = reopened
      ? this.priorityService.calculate({
          confirmationCount: occurrence.confirmationCount,
          severity: occurrence.severity,
          riskLevel: occurrence.riskLevel,
          firstReportedAt: occurrence.firstReportedAt,
          calculatedAt: now,
        })
      : occurrence.priorityScore;

    return {
      status: input.status,
      assignedDepartmentId,
      assignedBy,
      assignedAt,
      expectedResolutionAt,
      scheduledFor,
      resolutionDescription,
      resolvedAt,
      resolvedBy,
      closedAt,
      closedBy,
      duplicateOfOccurrenceId,
      priorityScore,
    };
  }

  private validateRequiredFields(
    occurrence: LockedStatusOccurrence,
    input: UpdateOccurrenceStatusInput,
    now: Date,
  ): void {
    if (input.status === 'FORWARDED') {
      if (input.departmentId === undefined) {
        throw new AppError(
          422,
          'DEPARTMENT_REQUIRED',
          'Informe o departamento responsavel pelo encaminhamento.',
        );
      }
      if (input.expectedResolutionAt === undefined) {
        throw new AppError(
          422,
          'EXPECTED_RESOLUTION_AT_REQUIRED',
          'Informe a previsao de resolucao.',
        );
      }
      if (input.expectedResolutionAt.getTime() <= now.getTime()) {
        throw new AppError(
          422,
          'INVALID_EXPECTED_RESOLUTION_AT',
          'A previsao de resolucao deve estar no futuro.',
        );
      }
    }
    if (input.status === 'SCHEDULED') {
      if (input.scheduledFor === undefined) {
        throw new AppError(422, 'SCHEDULED_FOR_REQUIRED', 'Informe a data do agendamento.');
      }
      if (input.scheduledFor.getTime() <= now.getTime()) {
        throw new AppError(422, 'INVALID_SCHEDULED_FOR', 'O agendamento deve estar no futuro.');
      }
    }
    if (input.status === 'RESOLVED' && input.resolutionDescription === undefined) {
      throw new AppError(422, 'RESOLUTION_DESCRIPTION_REQUIRED', 'Descreva a solucao executada.');
    }
    if (input.status === 'DUPLICATE' && input.duplicateOfOccurrenceId === undefined) {
      throw new AppError(422, 'DUPLICATE_TARGET_REQUIRED', 'Informe a ocorrencia principal.');
    }
    const reopening =
      (terminalStatuses.has(occurrence.status) && reopenTargets.has(input.status)) ||
      occurrence.status === 'CONTESTED';
    if (
      (['REJECTED', 'DUPLICATE', 'CONTESTED'].includes(input.status) || reopening) &&
      (input.reason === undefined || input.reason === null)
    ) {
      throw new AppError(422, 'STATUS_REASON_REQUIRED', 'Informe o motivo da transicao.');
    }
  }

  private requireOperational(principal: RequestPrincipal): void {
    if (principal.role === 'CITIZEN') {
      throw new AppError(403, 'FORBIDDEN', 'Cidadaos nao alteram status diretamente.');
    }
  }

  private requireMunicipality(principal: RequestPrincipal, municipalityId: string): void {
    if (
      principal.role === 'CITY_OPERATOR' &&
      (principal.municipalityId === null || principal.municipalityId !== municipalityId)
    ) {
      throw new AppError(403, 'MUNICIPALITY_FORBIDDEN', 'Acesso negado para este municipio.');
    }
  }

  private notFound(): never {
    throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
  }
}
