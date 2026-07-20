import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { RequestContext } from '../auth/auth.types.js';
import type { PriorityService } from '../confirmations/priority.service.js';
import type { RequestPrincipal } from '../occurrences/occurrences.types.js';
import { negativeRatio, type EvaluationPolicy } from './evaluation-policy.js';
import type {
  CreateEvaluationInput,
  EvaluationListQuery,
  UpdateEvaluationInput,
} from './evaluations.schemas.js';
import type {
  EvaluationRecord,
  EvaluationSummaryRecord,
  EvaluationsRepository,
  EvaluationsService,
  EvaluationVisibility,
} from './evaluations.types.js';

export const defaultEvaluationPolicy: EvaluationPolicy = {
  editWindowDays: env.EVALUATION_EDIT_WINDOW_DAYS,
  negativeThreshold: env.EVALUATION_NEGATIVE_THRESHOLD,
  minimumCountForContestation: env.EVALUATION_MIN_COUNT_FOR_CONTESTATION,
};

function serializeEvaluation(evaluation: EvaluationRecord, principalId: string) {
  return {
    id: evaluation.id,
    occurrenceId: evaluation.occurrenceId,
    rating: evaluation.rating,
    problemResolved: evaluation.problemResolved,
    serviceQuality: evaluation.serviceQuality,
    comment: evaluation.comment,
    isMine: evaluation.userId === principalId,
    createdAt: evaluation.createdAt,
    updatedAt: evaluation.updatedAt,
  };
}

function serializeSummary(summary: EvaluationSummaryRecord, policy: EvaluationPolicy) {
  const ratio = negativeRatio(summary.total, summary.negativeCount);
  return {
    occurrenceId: summary.occurrenceId,
    occurrenceStatus: summary.occurrenceStatus,
    total: summary.total,
    negativeCount: summary.negativeCount,
    negativePercentage: Number((ratio * 100).toFixed(2)),
    averageRating: summary.averageRating,
    averageServiceQuality: summary.averageServiceQuality,
    minimumEvaluationsForContestation: policy.minimumCountForContestation,
    negativeThresholdPercentage: Number((policy.negativeThreshold * 100).toFixed(2)),
    eligibleForContestation:
      summary.total >= policy.minimumCountForContestation && ratio >= policy.negativeThreshold,
  };
}

function canViewDetails(principal: RequestPrincipal, occurrence: EvaluationVisibility): boolean {
  if (principal.role === 'ADMIN' || principal.role === 'MODERATOR') return true;
  if (principal.role === 'CITY_OPERATOR') {
    return (
      principal.municipalityId !== null && principal.municipalityId === occurrence.municipalityId
    );
  }
  return occurrence.relatedToUser;
}

function isPubliclyVisible(occurrence: EvaluationVisibility): boolean {
  return !['PENDING_REVIEW', 'REJECTED'].includes(occurrence.status);
}

export class DefaultEvaluationsService implements EvaluationsService {
  public constructor(
    private readonly repository: EvaluationsRepository,
    private readonly priorityService: PriorityService,
    private readonly policy: EvaluationPolicy = defaultEvaluationPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async create(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: CreateEvaluationInput,
    context: RequestContext,
  ): Promise<unknown> {
    this.requireCitizen(principal);
    const result = await this.repository.create(
      { occurrenceId, userId: principal.sub, input, context, now: this.now() },
      this.policy,
      (priorityInput) => this.priorityService.calculate(priorityInput),
    );
    if (result.kind === 'occurrence_not_found') this.notFound();
    if (result.kind === 'status_not_evaluable') {
      throw new AppError(
        409,
        'OCCURRENCE_NOT_EVALUABLE',
        `A ocorrencia nao pode ser avaliada no status ${result.status}.`,
      );
    }
    if (result.kind === 'user_not_related') {
      throw new AppError(
        403,
        'OCCURRENCE_RELATION_REQUIRED',
        'Somente quem criou, reportou ou confirmou a ocorrencia pode avaliar o reparo.',
      );
    }
    if (result.kind === 'duplicate') {
      throw new AppError(
        409,
        'EVALUATION_ALREADY_EXISTS',
        'Voce ja avaliou esta ocorrencia. Use a rota de edicao.',
      );
    }
    return {
      evaluation: serializeEvaluation(result.evaluation, principal.sub),
      summary: serializeSummary(result.summary, this.policy),
      occurrenceContested: result.occurrenceContested,
    };
  }

  public async updateMine(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: UpdateEvaluationInput,
    context: RequestContext,
  ): Promise<unknown> {
    this.requireCitizen(principal);
    const result = await this.repository.update(
      { occurrenceId, userId: principal.sub, input, context, now: this.now() },
      this.policy,
      (priorityInput) => this.priorityService.calculate(priorityInput),
    );
    if (result.kind === 'occurrence_not_found') this.notFound();
    if (result.kind === 'status_not_editable') {
      throw new AppError(
        409,
        'EVALUATION_NOT_EDITABLE_FOR_STATUS',
        `A avaliacao nao pode ser editada no status ${result.status}.`,
      );
    }
    if (result.kind === 'evaluation_not_found') {
      throw new AppError(404, 'EVALUATION_NOT_FOUND', 'Avaliacao nao encontrada.');
    }
    if (result.kind === 'edit_window_expired') {
      throw new AppError(
        409,
        'EVALUATION_EDIT_WINDOW_EXPIRED',
        'O prazo para editar esta avaliacao terminou.',
        { deadline: result.deadline.toISOString() },
      );
    }
    return {
      evaluation: serializeEvaluation(result.evaluation, principal.sub),
      summary: serializeSummary(result.summary, this.policy),
      occurrenceContested: result.occurrenceContested,
    };
  }

  public async list(
    principal: RequestPrincipal,
    occurrenceId: string,
    query: EvaluationListQuery,
  ): Promise<unknown> {
    const occurrence = await this.repository.findVisibility(occurrenceId, principal.sub);
    if (occurrence === null) this.notFound();
    if (!canViewDetails(principal, occurrence)) {
      throw new AppError(403, 'EVALUATIONS_FORBIDDEN', 'Acesso negado as avaliacoes detalhadas.');
    }
    const result = await this.repository.list(
      occurrenceId,
      (query.page - 1) * query.limit,
      query.limit,
    );
    return {
      evaluations: result.items.map((item) => serializeEvaluation(item, principal.sub)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  public async summary(
    principal: RequestPrincipal | undefined,
    occurrenceId: string,
  ): Promise<unknown> {
    const occurrence = await this.repository.findVisibility(occurrenceId, principal?.sub);
    if (occurrence === null || (!isPubliclyVisible(occurrence) && principal === undefined)) {
      this.notFound();
    }
    if (
      !isPubliclyVisible(occurrence) &&
      principal !== undefined &&
      !canViewDetails(principal, occurrence)
    ) {
      this.notFound();
    }
    const summary = await this.repository.summary(occurrenceId);
    if (summary === null) this.notFound();
    return { summary: serializeSummary(summary, this.policy) };
  }

  private requireCitizen(principal: RequestPrincipal): void {
    if (principal.role !== 'CITIZEN') {
      throw new AppError(403, 'FORBIDDEN', 'Somente cidadaos podem avaliar reparos.');
    }
  }

  private notFound(): never {
    throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
  }
}
