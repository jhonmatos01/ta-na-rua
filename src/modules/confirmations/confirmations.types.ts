import type { RequestContext } from '../auth/auth.types.js';
import type {
  OccurrenceStatus,
  RequestPrincipal,
  RiskLevel,
} from '../occurrences/occurrences.types.js';
import type { CreateConfirmationInput } from './confirmations.schemas.js';
import type { PriorityInput } from './priority.service.js';

export const confirmableOccurrenceStatuses: readonly OccurrenceStatus[] = [
  'PUBLISHED',
  'FORWARDED',
  'ACKNOWLEDGED',
  'UNDER_ANALYSIS',
  'SCHEDULED',
  'IN_PROGRESS',
  'CONTESTED',
];

export interface ConfirmationRecord {
  id: string;
  occurrenceId: string;
  directlyAffected: boolean;
  problemWorsened: boolean;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfirmationSummaryRecord {
  occurrenceId: string;
  protocol: string;
  createdBy: string;
  municipalityId: string;
  status: OccurrenceStatus;
  confirmationCount: number;
  priorityScore: number;
  confirmedByUser: boolean;
}

export interface LockedOccurrence {
  id: string;
  protocol: string;
  createdBy: string;
  municipalityId: string;
  status: OccurrenceStatus;
  severity: number | null;
  riskLevel: RiskLevel | null;
  firstReportedAt: Date;
}

export interface CreateConfirmationData {
  occurrenceId: string;
  userId: string;
  input: CreateConfirmationInput;
  context: RequestContext;
  now: Date;
}

export interface RemoveConfirmationData {
  occurrenceId: string;
  userId: string;
  context: RequestContext;
  now: Date;
}

export type CalculatePriority = (input: PriorityInput) => number;

export type AddConfirmationResult =
  | {
      kind: 'created';
      confirmation: ConfirmationRecord;
      summary: ConfirmationSummaryRecord;
    }
  | { kind: 'occurrence_not_found' }
  | { kind: 'not_confirmable'; status: OccurrenceStatus }
  | { kind: 'duplicate' };

export type RemoveConfirmationResult =
  | { kind: 'removed'; summary: ConfirmationSummaryRecord }
  | { kind: 'occurrence_not_found' }
  | { kind: 'confirmation_not_found' };

export interface PriorityRecalculationResult {
  processed: number;
  correctedCounters: number;
}

export interface ConfirmationsRepository {
  add(
    data: CreateConfirmationData,
    calculatePriority: CalculatePriority,
  ): Promise<AddConfirmationResult>;
  remove(
    data: RemoveConfirmationData,
    calculatePriority: CalculatePriority,
  ): Promise<RemoveConfirmationResult>;
  getSummary(occurrenceId: string, userId?: string): Promise<ConfirmationSummaryRecord | null>;
  recalculateAll(
    calculatedAt: Date,
    calculatePriority: CalculatePriority,
  ): Promise<PriorityRecalculationResult>;
}

export interface ConfirmationsService {
  confirm(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: CreateConfirmationInput,
    context: RequestContext,
  ): Promise<unknown>;
  remove(principal: RequestPrincipal, occurrenceId: string, context: RequestContext): Promise<void>;
  count(principal: RequestPrincipal | undefined, occurrenceId: string): Promise<unknown>;
}
