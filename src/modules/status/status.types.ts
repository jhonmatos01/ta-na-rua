import type { RequestContext } from '../auth/auth.types.js';
import type {
  OccurrenceStatus,
  RequestPrincipal,
  RiskLevel,
} from '../occurrences/occurrences.types.js';
import type { PriorityInput } from '../confirmations/priority.service.js';
import type {
  UpdateOccurrenceAssignmentInput,
  UpdateOccurrenceStatusInput,
} from './status.schemas.js';

export interface LockedStatusOccurrence {
  id: string;
  protocol: string;
  createdBy: string;
  municipalityId: string;
  status: OccurrenceStatus;
  assignedDepartmentId: string | null;
  assignedBy: string | null;
  assignedAt: Date | null;
  expectedResolutionAt: Date | null;
  scheduledFor: Date | null;
  resolutionDescription: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  closedAt: Date | null;
  closedBy: string | null;
  duplicateOfOccurrenceId: string | null;
  confirmationCount: number;
  priorityScore: number;
  severity: number | null;
  riskLevel: RiskLevel | null;
  firstReportedAt: Date;
}

export interface StatusOccurrenceVisibility {
  id: string;
  createdBy: string;
  municipalityId: string;
  status: OccurrenceStatus;
}

export interface StatusHistoryRecord {
  id: string;
  previousStatus: OccurrenceStatus | null;
  newStatus: OccurrenceStatus;
  reason: string | null;
  publicMessage: string | null;
  changedBy: string;
  createdAt: Date;
}

export interface PreparedStatusTransition {
  status: OccurrenceStatus;
  assignedDepartmentId: string | null;
  assignedBy: string | null;
  assignedAt: Date | null;
  expectedResolutionAt: Date | null;
  scheduledFor: Date | null;
  resolutionDescription: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  closedAt: Date | null;
  closedBy: string | null;
  duplicateOfOccurrenceId: string | null;
  priorityScore: number;
}

export interface PreparedAssignment {
  departmentId: string;
  expectedResolutionAt: Date | null;
}

export interface StatusTransitionData {
  occurrenceId: string;
  actorId: string;
  input: UpdateOccurrenceStatusInput;
  context: RequestContext;
  now: Date;
}

export interface AssignmentData {
  occurrenceId: string;
  actorId: string;
  input: UpdateOccurrenceAssignmentInput;
  context: RequestContext;
  now: Date;
}

export type PrepareStatusTransition = (
  occurrence: LockedStatusOccurrence,
) => PreparedStatusTransition;
export type PrepareAssignment = (occurrence: LockedStatusOccurrence) => PreparedAssignment;
export type CalculatePriority = (input: PriorityInput) => number;

export type StatusTransitionResult =
  | { kind: 'updated'; occurrence: LockedStatusOccurrence }
  | { kind: 'occurrence_not_found' }
  | { kind: 'department_not_found' }
  | { kind: 'duplicate_target_invalid' };

export type AssignmentResult =
  | { kind: 'updated'; occurrence: LockedStatusOccurrence }
  | { kind: 'occurrence_not_found' }
  | { kind: 'department_not_found' };

export interface StatusRepository {
  transition(
    data: StatusTransitionData,
    prepare: PrepareStatusTransition,
  ): Promise<StatusTransitionResult>;
  assign(data: AssignmentData, prepare: PrepareAssignment): Promise<AssignmentResult>;
  findVisibility(occurrenceId: string): Promise<StatusOccurrenceVisibility | null>;
  history(occurrenceId: string): Promise<StatusHistoryRecord[]>;
}

export interface StatusService {
  transition(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: UpdateOccurrenceStatusInput,
    context: RequestContext,
  ): Promise<unknown>;
  assign(
    principal: RequestPrincipal,
    occurrenceId: string,
    input: UpdateOccurrenceAssignmentInput,
    context: RequestContext,
  ): Promise<unknown>;
  history(principal: RequestPrincipal | undefined, occurrenceId: string): Promise<unknown>;
}
