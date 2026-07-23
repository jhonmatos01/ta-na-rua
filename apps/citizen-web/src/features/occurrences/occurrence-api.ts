import { env } from '../../config/env';
import { apiRequest } from '../../lib/http-client';
import { createConfirmation } from '../confirmations/confirmation-api';
import {
  accountOccurrenceListResponseSchema,
  createOccurrenceResponseSchema,
  occurrenceDetailResponseSchema,
  occurrenceListResponseSchema,
  occurrenceMapResponseSchema,
  occurrenceTimelineResponseSchema,
  type OccurrenceStatus,
} from './occurrence-contracts';
import type { ReportDetails, ReportLocation } from './report-form-schema';

export interface OccurrenceFilters {
  category?: string;
  neighborhood?: string;
  status?: OccurrenceStatus;
}

export interface AccountOccurrenceFilters extends OccurrenceFilters {
  page: number;
  limit?: number;
}

export interface CreateOccurrenceInput extends ReportDetails, ReportLocation {
  anonymousPublication: boolean;
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

async function getAccountOccurrences(
  path:
    | '/api/v1/occurrences/confirmed-by-me'
    | '/api/v1/occurrences/mine'
    | '/api/v1/occurrences/pending-evaluations',
  filters: AccountOccurrenceFilters,
  signal?: AbortSignal,
) {
  const response = await apiRequest(path, {
    query: {
      category: filters.category,
      neighborhood: filters.neighborhood,
      status: filters.status,
      page: filters.page,
      limit: filters.limit ?? 6,
    },
    signal,
    schema: accountOccurrenceListResponseSchema,
    auth: true,
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

export function getMyOccurrences(filters: AccountOccurrenceFilters, signal?: AbortSignal) {
  return getAccountOccurrences('/api/v1/occurrences/mine', filters, signal);
}

export function getConfirmedOccurrences(filters: AccountOccurrenceFilters, signal?: AbortSignal) {
  return getAccountOccurrences('/api/v1/occurrences/confirmed-by-me', filters, signal);
}

export function getPendingEvaluationOccurrences(
  filters: AccountOccurrenceFilters,
  signal?: AbortSignal,
) {
  return getAccountOccurrences('/api/v1/occurrences/pending-evaluations', filters, signal);
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

export async function getNearbyOccurrences(
  location: Pick<ReportLocation, 'latitude' | 'longitude'>,
  signal?: AbortSignal,
) {
  const response = await apiRequest('/api/v1/occurrences/nearby', {
    query: {
      municipalityId: env.defaultMunicipalityId,
      latitude: location.latitude,
      longitude: location.longitude,
      page: 1,
      limit: 5,
    },
    signal,
    schema: occurrenceListResponseSchema,
  });
  return response.data.occurrences;
}

export async function createOccurrence(input: CreateOccurrenceInput, signal?: AbortSignal) {
  const body = new FormData();
  body.set('title', input.title);
  if (input.description) body.set('description', input.description);
  if (input.categoryId) body.set('categoryId', input.categoryId);
  body.set('municipalityId', env.defaultMunicipalityId);
  if (input.neighborhoodText) body.set('neighborhoodText', input.neighborhoodText);
  if (input.address) body.set('address', input.address);
  body.set('latitude', String(input.latitude));
  body.set('longitude', String(input.longitude));
  if (input.locationAccuracy !== undefined) {
    body.set('locationAccuracy', String(input.locationAccuracy));
  }
  body.set('anonymousPublication', String(input.anonymousPublication));
  body.set('image', input.image, input.image.name);

  const response = await apiRequest('/api/v1/occurrences', {
    method: 'POST',
    body,
    signal,
    schema: createOccurrenceResponseSchema,
    auth: true,
  });
  return response.data.occurrence;
}

export async function confirmExistingOccurrence(occurrenceId: string, signal?: AbortSignal) {
  return createConfirmation(occurrenceId, {}, signal);
}

export function resolveApiAssetUrl(value: string): string | null {
  try {
    const url = new URL(value, `${env.apiBaseUrl}/`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
