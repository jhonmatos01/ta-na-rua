import type { RequestContext } from '../auth/auth.types.js';
import type { PriorityInput } from '../confirmations/priority.service.js';
import type {
  OccurrenceStatus,
  RequestPrincipal,
  RiskLevel,
} from '../occurrences/occurrences.types.js';
import type { EvaluationPolicy } from './evaluation-policy.js';
import type {
  CreateEvaluationInput,
  EvaluationListQuery,
  UpdateEvaluationInput,
} from './evaluations.schemas.js';

export interface EvaluationOccurrence {
  id: string;
  protocol: string;
  createdBy: string;
  municipalityId: string;
  status: OccurrenceStatus;
  confirmationCount: number;
  priorityScore: number;
  severity: number | null;
  riskLevel: RiskLevel | null;
  firstReportedAt: Date;
}

export interface EvaluationVisibility {
  id: string;
  createdBy: string;
  municipalityId: string;
  status: OccurrenceStatus;
  relatedToUser: boolean;
}

export interface EvaluationRecord {
  id: string;
  occurrenceId: string;
  userId: string;
  rating: number;
  problemResolved: boolean;
  serviceQuality: number | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvaluationSummaryRecord {
  occurrenceId: string;
  occurrenceStatus: OccurrenceStatus;
  total: number;
  negativeCount: number;
  averageRating: number | null;
  averageServiceQuality: number | null;
}

export interface EvaluationListResult {
  items: EvaluationRecord[];
  total: number;
}

export interface CreateEvaluationData {
  occurrenceId: string;
  userId: string;
  input: CreateEvaluationInput;
  context: RequestContext;
  now: Date;
}

export interface UpdateEvaluationData {
  occurrenceId: string;
  userId: string;
  input: UpdateEvaluationInput;
  context: RequestContext;
  now: Date;
}

export type CalculatePriority = (input: PriorityInput) => number;

export type CreateEvaluationResult =
  | {
      kind: 'created';
      evaluation: EvaluationRecord;
      summary: EvaluationSummaryRecord;
      occurrenceContested: boolean;
    }
  | { kind: 'occurrence_not_found' }
  | { kind: 'status_not_evaluable'; status: OccurrenceStatus }
  | { kind: 'user_not_related' }
  | { kind: 'duplicate' };

export type UpdateEvaluationResult =
  | {
      kind: 'updated';
      evaluation: EvaluationRecord;
      summary: EvaluationSummaryRecord;
      occurrenceContested: boolean;
    }
  | { kind: 'occurrence_not_found' }
  | { kind: 'status_not_editable'; status: OccurrenceStatus }
  | { kind: 'evaluation_not_found' }
  | { kind: 'edit_window_expired'; deadline: Date };

export interface EvaluationsRepository {
  create(
    data: CreateEvaluationData,
    policy: EvaluationPolicy,
    calculatePriority: CalculatePriority,
  ): Promise<CreateEvaluationResult>;
  update(
    data: UpdateEvaluationData,
    policy: EvaluationPolicy,
    calculatePriority: CalculatePriority,
  ): Promise<UpdateEvaluationResult>;
  findVisibility(occurrenceId: string, userId?: string): Promise<EvaluationVisibility | null>;
  list(occurrenceId: string, offset: number, limit: number): Promise<EvaluationListResult>;
  summary(occurrenceId: string): Promise<EvaluationSummaryRecord | null>;
}

export interface EvaluationsService {
  create(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: CreateEvaluationInput,
    context: RequestContext,
  ): Promise<unknown>;
  updateMine(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: UpdateEvaluationInput,
    context: RequestContext,
  ): Promise<unknown>;
  list(
    principal: RequestPrincipal,
    occurrenceId: string,
    query: EvaluationListQuery,
  ): Promise<unknown>;
  summary(principal: RequestPrincipal | undefined, occurrenceId: string): Promise<unknown>;
}
