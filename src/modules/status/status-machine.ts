import type { UserRole } from '../auth/auth.types.js';
import type { OccurrenceStatus } from '../occurrences/occurrences.types.js';

export const validStatusTransitions: Readonly<
  Record<OccurrenceStatus, readonly OccurrenceStatus[]>
> = {
  PENDING_REVIEW: ['PUBLISHED', 'REJECTED', 'DUPLICATE'],
  PUBLISHED: ['FORWARDED', 'REJECTED', 'DUPLICATE'],
  FORWARDED: ['ACKNOWLEDGED', 'UNDER_ANALYSIS'],
  ACKNOWLEDGED: ['UNDER_ANALYSIS'],
  UNDER_ANALYSIS: ['SCHEDULED', 'IN_PROGRESS', 'REJECTED'],
  SCHEDULED: ['IN_PROGRESS', 'UNDER_ANALYSIS'],
  IN_PROGRESS: ['RESOLVED', 'UNDER_ANALYSIS'],
  RESOLVED: ['CLOSED', 'CONTESTED', 'IN_PROGRESS'],
  CLOSED: ['CONTESTED'],
  CONTESTED: ['IN_PROGRESS', 'RESOLVED'],
  REJECTED: ['PENDING_REVIEW'],
  DUPLICATE: ['PENDING_REVIEW'],
};

const cityOperatorTransitions = new Set([
  'PUBLISHED->FORWARDED',
  'FORWARDED->ACKNOWLEDGED',
  'FORWARDED->UNDER_ANALYSIS',
  'ACKNOWLEDGED->UNDER_ANALYSIS',
  'UNDER_ANALYSIS->SCHEDULED',
  'UNDER_ANALYSIS->IN_PROGRESS',
  'SCHEDULED->IN_PROGRESS',
  'SCHEDULED->UNDER_ANALYSIS',
  'IN_PROGRESS->RESOLVED',
  'IN_PROGRESS->UNDER_ANALYSIS',
  'RESOLVED->CLOSED',
  'RESOLVED->IN_PROGRESS',
  'CONTESTED->IN_PROGRESS',
  'CONTESTED->RESOLVED',
]);

export function isValidStatusTransition(
  previousStatus: OccurrenceStatus,
  newStatus: OccurrenceStatus,
): boolean {
  return validStatusTransitions[previousStatus].includes(newStatus);
}

export function canRoleTransition(
  role: UserRole,
  previousStatus: OccurrenceStatus,
  newStatus: OccurrenceStatus,
): boolean {
  if (!isValidStatusTransition(previousStatus, newStatus) || role === 'CITIZEN') return false;
  if (role === 'ADMIN' || role === 'MODERATOR') return true;
  return cityOperatorTransitions.has(`${previousStatus}->${newStatus}`);
}
