import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createConfirmation, getConfirmationState, removeMyConfirmation } from './confirmation-api';
import type { ConfirmationState } from './confirmation-contracts';

export const confirmationQueryKeys = {
  all: ['confirmations'] as const,
  state: (occurrenceId: string, authenticated: boolean) =>
    [...confirmationQueryKeys.all, 'state', occurrenceId, authenticated] as const,
};

export function useConfirmationState(occurrenceId: string, authenticated: boolean, enabled = true) {
  return useQuery(
    queryOptions({
      queryKey: confirmationQueryKeys.state(occurrenceId, authenticated),
      queryFn: ({ signal }) => getConfirmationState(occurrenceId, authenticated, signal),
      enabled: enabled && occurrenceId.length > 0,
      staleTime: 15_000,
    }),
  );
}

export function useCreateConfirmation(occurrenceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createConfirmation(occurrenceId),
    onSuccess: async (result) => {
      const state: ConfirmationState = {
        occurrenceId,
        confirmationCount: result.occurrence.confirmationCount,
        priorityScore: result.occurrence.priorityScore,
        confirmedByMe: true,
      };
      queryClient.setQueryData(confirmationQueryKeys.state(occurrenceId, true), state);
      await queryClient.invalidateQueries({ queryKey: ['occurrences'] });
    },
  });
}

export function useRemoveConfirmation(occurrenceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeMyConfirmation(occurrenceId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: confirmationQueryKeys.state(occurrenceId, true),
        }),
        queryClient.invalidateQueries({ queryKey: ['occurrences'] }),
      ]);
    },
  });
}
