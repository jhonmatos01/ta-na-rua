import type { OccurrenceStatus } from '../occurrences/occurrences.types.js';

export interface EvaluationPolicy {
  editWindowDays: number;
  negativeThreshold: number;
  minimumCountForContestation: number;
}

export const evaluableStatuses: readonly OccurrenceStatus[] = ['RESOLVED', 'CLOSED'];
export const editableEvaluationStatuses: readonly OccurrenceStatus[] = [
  'RESOLVED',
  'CLOSED',
  'CONTESTED',
];

export function evaluationEditDeadline(createdAt: Date, editWindowDays: number): Date {
  return new Date(createdAt.getTime() + editWindowDays * 24 * 60 * 60 * 1000);
}

export function isEvaluationEditable(createdAt: Date, now: Date, editWindowDays: number): boolean {
  return now.getTime() <= evaluationEditDeadline(createdAt, editWindowDays).getTime();
}

export function negativeRatio(total: number, negativeCount: number): number {
  return total === 0 ? 0 : negativeCount / total;
}

export function shouldContest(
  total: number,
  negativeCount: number,
  policy: EvaluationPolicy,
): boolean {
  return (
    total >= policy.minimumCountForContestation &&
    negativeRatio(total, negativeCount) >= policy.negativeThreshold
  );
}
