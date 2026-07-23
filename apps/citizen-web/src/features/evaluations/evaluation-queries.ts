import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationQueryKeys } from '../notifications/notification-queries';
import { occurrenceQueryKeys } from '../occurrences/occurrence-queries';
import {
  createEvaluation,
  getEvaluationSummary,
  getOccurrenceEvaluations,
  updateMyEvaluation,
} from './evaluation-api';
import type { EvaluationInput } from './evaluation-contracts';

export const evaluationQueryKeys = {
  all: ['evaluations'] as const,
  list: (occurrenceId: string) => [...evaluationQueryKeys.all, 'list', occurrenceId] as const,
  summary: (occurrenceId: string) => [...evaluationQueryKeys.all, 'summary', occurrenceId] as const,
};

export function useEvaluationSummary(occurrenceId: string | undefined, enabled = true) {
  return useQuery(
    queryOptions({
      queryKey: evaluationQueryKeys.summary(occurrenceId ?? ''),
      queryFn: ({ signal }) => getEvaluationSummary(occurrenceId!, signal),
      enabled: enabled && occurrenceId !== undefined,
    }),
  );
}

export function useOccurrenceEvaluations(occurrenceId: string | undefined, enabled = true) {
  return useQuery(
    queryOptions({
      queryKey: evaluationQueryKeys.list(occurrenceId ?? ''),
      queryFn: ({ signal }) => getOccurrenceEvaluations(occurrenceId!, signal),
      enabled: enabled && occurrenceId !== undefined,
    }),
  );
}

function useRefreshEvaluationData(occurrenceId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: evaluationQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: occurrenceQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: occurrenceQueryKeys.detail(occurrenceId) }),
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all }),
    ]);
  };
}

export function useSaveEvaluation(occurrenceId: string, editing: boolean) {
  const refresh = useRefreshEvaluationData(occurrenceId);
  return useMutation({
    mutationFn: (input: EvaluationInput) =>
      editing ? updateMyEvaluation(occurrenceId, input) : createEvaluation(occurrenceId, input),
    onSuccess: refresh,
  });
}
