import { queryOptions, useQuery } from '@tanstack/react-query';

import {
  getPublicMapPoints,
  getPublicOccurrence,
  getPublicOccurrences,
  getPublicOccurrenceTimeline,
  type OccurrenceFilters,
} from './occurrence-api';

export const occurrenceQueryKeys = {
  all: ['occurrences'] as const,
  catalog: () => [...occurrenceQueryKeys.all, 'catalog'] as const,
  list: (filters: OccurrenceFilters) => [...occurrenceQueryKeys.all, 'list', filters] as const,
  map: (filters: Pick<OccurrenceFilters, 'category' | 'status'>) =>
    [...occurrenceQueryKeys.all, 'map', filters] as const,
  detail: (occurrenceId: string) => [...occurrenceQueryKeys.all, 'detail', occurrenceId] as const,
  timeline: (occurrenceId: string) =>
    [...occurrenceQueryKeys.all, 'timeline', occurrenceId] as const,
};

export function useOccurrenceCatalog() {
  return useQuery(
    queryOptions({
      queryKey: occurrenceQueryKeys.catalog(),
      queryFn: ({ signal }) => getPublicOccurrences({}, signal),
      staleTime: 5 * 60 * 1000,
    }),
  );
}

export function usePublicOccurrences(filters: OccurrenceFilters) {
  return useQuery(
    queryOptions({
      queryKey: occurrenceQueryKeys.list(filters),
      queryFn: ({ signal }) => getPublicOccurrences(filters, signal),
    }),
  );
}

export function usePublicMapPoints(filters: Pick<OccurrenceFilters, 'category' | 'status'>) {
  return useQuery(
    queryOptions({
      queryKey: occurrenceQueryKeys.map(filters),
      queryFn: ({ signal }) => getPublicMapPoints(filters, signal),
    }),
  );
}

export function usePublicOccurrence(occurrenceId: string | undefined) {
  return useQuery(
    queryOptions({
      queryKey: occurrenceQueryKeys.detail(occurrenceId ?? ''),
      queryFn: ({ signal }) => getPublicOccurrence(occurrenceId!, signal),
      enabled: occurrenceId !== undefined,
    }),
  );
}

export function usePublicOccurrenceTimeline(occurrenceId: string | undefined) {
  return useQuery(
    queryOptions({
      queryKey: occurrenceQueryKeys.timeline(occurrenceId ?? ''),
      queryFn: ({ signal }) => getPublicOccurrenceTimeline(occurrenceId!, signal),
      enabled: occurrenceId !== undefined,
    }),
  );
}
