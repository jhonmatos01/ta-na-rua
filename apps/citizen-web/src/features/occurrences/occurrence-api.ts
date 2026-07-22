import { env } from '../../config/env';
import { apiRequest } from '../../lib/http-client';
import {
  occurrenceDetailResponseSchema,
  occurrenceListResponseSchema,
  occurrenceMapResponseSchema,
  occurrenceTimelineResponseSchema,
  type OccurrenceStatus,
} from './occurrence-contracts';

export interface OccurrenceFilters {
  category?: string;
  neighborhood?: string;
  status?: OccurrenceStatus;
}

export async function getPublicOccurrences(filters: OccurrenceFilters, signal?: AbortSignal) {
  const response = await apiRequest('/api/v1/occurrences', {
    query: {
      municipalityId: env.defaultMunicipalityId,
      category: filters.category,
      neighborhood: filters.neighborhood,
      status: filters.status,
      page: 1,
      limit: 100,
    },
    signal,
    schema: occurrenceListResponseSchema,
  });

  return {
    occurrences: response.data.occurrences,
    pagination: {
      page: response.meta.page,
      limit: response.meta.limit,
      total: response.meta.total,
      totalPages: response.meta.totalPages,
    },
  };
}

export async function getPublicMapPoints(
  filters: Pick<OccurrenceFilters, 'category' | 'status'>,
  signal?: AbortSignal,
) {
  const response = await apiRequest('/api/v1/occurrences/map', {
    query: {
      municipalityId: env.defaultMunicipalityId,
      category: filters.category,
      status: filters.status,
      limit: 500,
    },
    signal,
    schema: occurrenceMapResponseSchema,
  });
  return response.data.points;
}

export async function getPublicOccurrence(occurrenceId: string, signal?: AbortSignal) {
  const response = await apiRequest(`/api/v1/occurrences/${occurrenceId}`, {
    signal,
    schema: occurrenceDetailResponseSchema,
  });
  return response.data.occurrence;
}

export async function getPublicOccurrenceTimeline(occurrenceId: string, signal?: AbortSignal) {
  const response = await apiRequest(`/api/v1/occurrences/${occurrenceId}/timeline`, {
    signal,
    schema: occurrenceTimelineResponseSchema,
  });
  return response.data.timeline;
}

export function resolveApiAssetUrl(value: string): string | null {
  try {
    const url = new URL(value, `${env.apiBaseUrl}/`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
