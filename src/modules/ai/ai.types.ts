import type { RiskLevel } from '../occurrences/occurrences.types.js';
import type { AiServiceResponse } from './ai.schemas.js';

export type AiAnalysisType =
  'CLASSIFICATION' | 'DUPLICATE_DETECTION' | 'CONTENT_MODERATION' | 'REASSESSMENT';

export interface AiCategoryOption {
  id: string;
  code: string;
  name: string;
}

export interface AiNearbyOccurrence {
  id: string;
  category: string | null;
  distanceMeters: number;
  description: string;
  imageUrls: string[];
}

export interface AiServiceRequest {
  analysisType: AiAnalysisType;
  reportId: string;
  imageUrl: string;
  description: string;
  latitude: number;
  longitude: number;
  nearbyOccurrences: AiNearbyOccurrence[];
  availableCategories: Array<{ code: string; name: string }>;
}

export interface AiAnalysisContext {
  occurrenceId: string;
  reportId: string;
  createdBy: string;
  status: string;
  confirmationCount: number;
  firstReportedAt: Date;
  request: Omit<AiServiceRequest, 'analysisType'>;
  categories: AiCategoryOption[];
}

export type AiClientFailureState =
  'NOT_CONFIGURED' | 'TIMEOUT' | 'UNAVAILABLE' | 'HTTP_ERROR' | 'INVALID_RESPONSE';

export type AiClientResult =
  | {
      ok: true;
      attempts: number;
      response: AiServiceResponse;
      rawResponse: unknown;
    }
  | {
      ok: false;
      attempts: number;
      state: AiClientFailureState;
      rawResponse: unknown;
      statusCode?: number;
    };

export interface AiHttpClient {
  analyze(request: AiServiceRequest): Promise<AiClientResult>;
}

export interface PersistAiAnalysisInput {
  occurrenceId: string;
  reportId: string;
  analysisType: AiAnalysisType;
  modelName: string;
  suggestedCategory: string | null;
  suggestedSubcategory: string | null;
  suggestedSeverity: number | null;
  suggestedRisk: RiskLevel | null;
  confidence: number;
  summary: string | null;
  possibleDuplicates: unknown[];
  rawResult: Record<string, unknown>;
  requiresHumanReview: boolean;
  applyClassification: boolean;
  categoryId: string | null;
  priorityScore: number | null;
  state: AiProcessingState;
}

export interface PersistAiAnalysisResult {
  analysisId: string;
  occurrenceStatus: string;
}

export interface AiAnalysisRepository {
  loadContext(occurrenceId: string): Promise<AiAnalysisContext | null>;
  persist(input: PersistAiAnalysisInput): Promise<PersistAiAnalysisResult>;
  recalculatePriority(occurrenceId: string, now: Date): Promise<number | null>;
}

export type AiProcessingState = 'VALIDATED' | AiClientFailureState | 'DOMAIN_INCONSISTENCY';

export interface AiProcessingResult {
  analysisId: string | null;
  state: AiProcessingState;
  attempts: number;
  appliedClassification: boolean;
  requiresHumanReview: boolean;
  confidence: number;
  possibleDuplicateCount: number;
}

export interface OccurrenceAiProcessor {
  analyzeAfterCreation(occurrenceId: string): Promise<AiProcessingResult>;
}

export interface AiAnalysisService extends OccurrenceAiProcessor {
  analyzeOccurrence(
    occurrenceId: string,
    analysisType?: AiAnalysisType,
  ): Promise<AiProcessingResult>;
  recalculatePriority(occurrenceId: string): Promise<{ priorityScore: number }>;
}
