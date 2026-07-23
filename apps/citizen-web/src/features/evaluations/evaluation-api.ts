import { apiRequest } from '../../lib/http-client';
import {
  evaluationListResponseSchema,
  evaluationMutationResponseSchema,
  evaluationSummaryResponseSchema,
  type EvaluationInput,
} from './evaluation-contracts';

export async function getEvaluationSummary(occurrenceId: string, signal?: AbortSignal) {
  const response = await apiRequest(`/api/v1/occurrences/${occurrenceId}/evaluations/summary`, {
    signal,
    schema: evaluationSummaryResponseSchema,
  });
  return response.data.summary;
}

export async function getOccurrenceEvaluations(occurrenceId: string, signal?: AbortSignal) {
  const response = await apiRequest(`/api/v1/occurrences/${occurrenceId}/evaluations`, {
    query: { page: 1, limit: 20 },
    signal,
    schema: evaluationListResponseSchema,
    auth: true,
  });
  return response.data.evaluations;
}

export async function createEvaluation(occurrenceId: string, input: EvaluationInput) {
  const response = await apiRequest(`/api/v1/occurrences/${occurrenceId}/evaluations`, {
    method: 'POST',
    body: { ...input },
    schema: evaluationMutationResponseSchema,
    auth: true,
  });
  return response.data;
}

export async function updateMyEvaluation(occurrenceId: string, input: EvaluationInput) {
  const response = await apiRequest(`/api/v1/occurrences/${occurrenceId}/evaluations/me`, {
    method: 'PATCH',
    body: { ...input },
    schema: evaluationMutationResponseSchema,
    auth: true,
  });
  return response.data;
}
