import { AppError } from '../../shared/errors/app-error.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { RequestPrincipal } from '../occurrences/occurrences.types.js';
import type { CreateConfirmationInput } from './confirmations.schemas.js';
import type {
  ConfirmationSummaryRecord,
  ConfirmationsRepository,
  ConfirmationsService,
} from './confirmations.types.js';
import type { PriorityService } from './priority.service.js';

function canSeeRestrictedOccurrence(
  summary: ConfirmationSummaryRecord,
  principal: RequestPrincipal | undefined,
): boolean {
  if (!['PENDING_REVIEW', 'REJECTED'].includes(summary.status)) return true;
  if (principal === undefined) return false;
  if (principal.role === 'ADMIN' || principal.role === 'MODERATOR') return true;
  if (principal.sub === summary.createdBy) return true;
  return principal.role === 'CITY_OPERATOR' && principal.municipalityId === summary.municipalityId;
}

export class DefaultConfirmationsService implements ConfirmationsService {
  public constructor(
    private readonly repository: ConfirmationsRepository,
    private readonly priorityService: PriorityService,
  ) {}

  public async confirm(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: CreateConfirmationInput,
    context: RequestContext,
  ): Promise<unknown> {
    this.requireCitizen(principal);
    const result = await this.repository.add(
      { occurrenceId, userId: principal.sub, input, context, now: new Date() },
      (priorityInput) => this.priorityService.calculate(priorityInput),
    );
    if (result.kind === 'occurrence_not_found') this.occurrenceNotFound();
    if (result.kind === 'duplicate') {
      throw new AppError(409, 'CONFIRMATION_ALREADY_EXISTS', 'Voce ja confirmou esta ocorrencia.');
    }
    if (result.kind === 'not_confirmable') {
      throw new AppError(
        409,
        'OCCURRENCE_NOT_CONFIRMABLE',
        `A ocorrencia nao aceita confirmacoes no status ${result.status}.`,
      );
    }

    return {
      confirmation: {
        id: result.confirmation.id,
        occurrenceId: result.confirmation.occurrenceId,
        directlyAffected: result.confirmation.directlyAffected,
        problemWorsened: result.confirmation.problemWorsened,
        comment: result.confirmation.comment,
        createdAt: result.confirmation.createdAt,
        updatedAt: result.confirmation.updatedAt,
      },
      occurrence: {
        confirmationCount: result.summary.confirmationCount,
        priorityScore: result.summary.priorityScore,
      },
    };
  }

  public async remove(
    principal: RequestPrincipal,
    occurrenceId: string,
    context: RequestContext,
  ): Promise<void> {
    this.requireCitizen(principal);
    const result = await this.repository.remove(
      { occurrenceId, userId: principal.sub, context, now: new Date() },
      (priorityInput) => this.priorityService.calculate(priorityInput),
    );
    if (result.kind === 'occurrence_not_found') this.occurrenceNotFound();
    if (result.kind === 'confirmation_not_found') {
      throw new AppError(
        404,
        'CONFIRMATION_NOT_FOUND',
        'Voce ainda nao confirmou esta ocorrencia.',
      );
    }
  }

  public async count(
    principal: RequestPrincipal | undefined,
    occurrenceId: string,
  ): Promise<unknown> {
    const summary = await this.repository.getSummary(occurrenceId, principal?.sub);
    if (summary === null || !canSeeRestrictedOccurrence(summary, principal)) {
      this.occurrenceNotFound();
    }
    return {
      occurrenceId: summary.occurrenceId,
      confirmationCount: summary.confirmationCount,
      priorityScore: summary.priorityScore,
      ...(principal === undefined ? {} : { confirmedByMe: summary.confirmedByUser }),
    };
  }

  private requireCitizen(principal: RequestPrincipal): void {
    if (principal.role !== 'CITIZEN') {
      throw new AppError(403, 'FORBIDDEN', 'Somente cidadaos podem confirmar ocorrencias.');
    }
  }

  private occurrenceNotFound(): never {
    throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
  }
}
