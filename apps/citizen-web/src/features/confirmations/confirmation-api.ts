import { z } from 'zod';

import { apiRequest } from '../../lib/http-client';
import {
  confirmationMutationResponseSchema,
  confirmationStateResponseSchema,
} from './confirmation-contracts';

export interface CreateConfirmationInput {
  directlyAffected?: boolean;
  problemWorsened?: boolean;
  comment?: string | null;
}

export async function getConfirmationState(
  occurrenceId: string,
  authenticated: boolean,
  signal?: AbortSignal,
) {
  const response = await apiRequest(`/api/v1/occurrences/${occurrenceId}/confirmations/count`, {
    signal,
    schema: confirmationStateResponseSchema,
    auth: authenticated,
  });
  return response.data;
}

export async function createConfirmation(
  occurrenceId: string,
  input: CreateConfirmationInput = {},
  signal?: AbortSignal,
) {
  const response = await apiRequest(`/api/v1/occurrences/${occurrenceId}/confirmations`, {
    method: 'POST',
    body: {
      directlyAffected: input.directlyAffected ?? false,
      problemWorsened: input.problemWorsened ?? false,
      comment: input.comment ?? null,
    },
    signal,
    schema: confirmationMutationResponseSchema,
    auth: true,
  });
  return response.data;
}

export async function removeMyConfirmation(occurrenceId: string, signal?: AbortSignal) {
  await apiRequest(`/api/v1/occurrences/${occurrenceId}/confirmations/me`, {
    method: 'DELETE',
    signal,
    schema: z.undefined(),
    auth: true,
  });
}
