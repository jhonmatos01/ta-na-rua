import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { DefaultPriorityService, type PriorityService } from '../confirmations/priority.service.js';
import { DefaultAiHttpClient } from './ai.client.js';
import { PostgresAiAnalysisRepository } from './ai.repository.js';
import type {
  AiAnalysisRepository,
  AiAnalysisService,
  AiAnalysisType,
  AiHttpClient,
  AiProcessingResult,
  AiProcessingState,
  PersistAiAnalysisInput,
} from './ai.types.js';

function redactSensitive(value: unknown): unknown {
  const sensitive = /authorization|cookie|secret|token|password|api[-_]?key/iu;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitive.test(key))
      .map(([key, entry]) => [key, redactSensitive(entry)]),
  );
}

function rawResult(
  state: AiProcessingState,
  attempts: number,
  received: unknown,
  validated?: unknown,
): Record<string, unknown> {
  return {
    state,
    attempts,
    received: redactSensitive(received),
    ...(validated === undefined ? {} : { validated: redactSensitive(validated) }),
  };
}

export class DefaultAiAnalysisService implements AiAnalysisService {
  public constructor(
    private readonly repository: AiAnalysisRepository = new PostgresAiAnalysisRepository(),
    private readonly client: AiHttpClient = new DefaultAiHttpClient(),
    private readonly priorityService: PriorityService = new DefaultPriorityService(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  public analyzeAfterCreation(occurrenceId: string): Promise<AiProcessingResult> {
    return this.analyzeOccurrence(occurrenceId, 'CLASSIFICATION');
  }

  public async analyzeOccurrence(
    occurrenceId: string,
    analysisType: AiAnalysisType = 'CLASSIFICATION',
  ): Promise<AiProcessingResult> {
    const context = await this.repository.loadContext(occurrenceId);
    if (context === null) {
      throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
    }

    const clientResult = await this.client.analyze({ analysisType, ...context.request });
    if (!clientResult.ok) {
      const persisted = await this.repository.persist({
        occurrenceId,
        reportId: context.reportId,
        analysisType,
        modelName: env.AI_MODEL_NAME,
        suggestedCategory: null,
        suggestedSubcategory: null,
        suggestedSeverity: null,
        suggestedRisk: null,
        confidence: 0,
        summary: null,
        possibleDuplicates: [],
        rawResult: rawResult(clientResult.state, clientResult.attempts, clientResult.rawResponse),
        requiresHumanReview: true,
        applyClassification: false,
        categoryId: null,
        priorityScore: null,
        state: clientResult.state,
      });
      return {
        analysisId: persisted.analysisId,
        state: clientResult.state,
        attempts: clientResult.attempts,
        appliedClassification: false,
        requiresHumanReview: true,
        confidence: 0,
        possibleDuplicateCount: 0,
      };
    }

    const response = clientResult.response;
    const category = context.categories.find(
      (candidate) => candidate.code === response.category.toUpperCase(),
    );
    const nearbyIds = new Set(context.request.nearbyOccurrences.map((candidate) => candidate.id));
    const inconsistentDuplicate = response.possibleDuplicates.some(
      (duplicate) =>
        duplicate.occurrenceId === occurrenceId || !nearbyIds.has(duplicate.occurrenceId),
    );
    if (category === undefined || inconsistentDuplicate) {
      const state = 'DOMAIN_INCONSISTENCY';
      const persisted = await this.repository.persist({
        occurrenceId,
        reportId: context.reportId,
        analysisType,
        modelName: env.AI_MODEL_NAME,
        suggestedCategory: null,
        suggestedSubcategory: null,
        suggestedSeverity: null,
        suggestedRisk: null,
        confidence: response.confidence,
        summary: null,
        possibleDuplicates: [],
        rawResult: rawResult(state, clientResult.attempts, clientResult.rawResponse),
        requiresHumanReview: true,
        applyClassification: false,
        categoryId: null,
        priorityScore: null,
        state,
      });
      return {
        analysisId: persisted.analysisId,
        state,
        attempts: clientResult.attempts,
        appliedClassification: false,
        requiresHumanReview: true,
        confidence: response.confidence,
        possibleDuplicateCount: 0,
      };
    }

    const possibleDuplicates = response.possibleDuplicates.map((duplicate) => ({
      ...duplicate,
      meetsThreshold: duplicate.similarity >= env.AI_DUPLICATE_MIN_SIMILARITY,
      decision: 'REQUIRES_REVIEW',
    }));
    const possibleDuplicateCount = possibleDuplicates.filter(
      (duplicate) => duplicate.meetsThreshold,
    ).length;
    const lowConfidence = response.confidence < env.AI_MIN_CONFIDENCE;
    const requiresHumanReview =
      response.requiresHumanReview || lowConfidence || possibleDuplicateCount > 0;
    const applyClassification = !lowConfidence && !response.requiresHumanReview;
    const priorityScore = applyClassification
      ? this.priorityService.calculate({
          confirmationCount: context.confirmationCount,
          severity: response.severity,
          riskLevel: response.risk,
          firstReportedAt: context.firstReportedAt,
          calculatedAt: this.now(),
        })
      : null;
    const state = 'VALIDATED';
    const input: PersistAiAnalysisInput = {
      occurrenceId,
      reportId: context.reportId,
      analysisType,
      modelName: env.AI_MODEL_NAME,
      suggestedCategory: category.code,
      suggestedSubcategory: response.subcategory,
      suggestedSeverity: response.severity,
      suggestedRisk: response.risk,
      confidence: response.confidence,
      summary: response.summary,
      possibleDuplicates,
      rawResult: rawResult(state, clientResult.attempts, clientResult.rawResponse, response),
      requiresHumanReview,
      applyClassification,
      categoryId: category.id,
      priorityScore,
      state,
    };
    const persisted = await this.repository.persist(input);
    return {
      analysisId: persisted.analysisId,
      state,
      attempts: clientResult.attempts,
      appliedClassification: applyClassification,
      requiresHumanReview,
      confidence: response.confidence,
      possibleDuplicateCount,
    };
  }

  public async recalculatePriority(occurrenceId: string): Promise<{ priorityScore: number }> {
    const priorityScore = await this.repository.recalculatePriority(occurrenceId, this.now());
    if (priorityScore === null) {
      throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrencia nao encontrada.');
    }
    return { priorityScore };
  }
}
