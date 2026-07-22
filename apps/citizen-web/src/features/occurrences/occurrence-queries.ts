import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';

import {
  confirmExistingOccurrence,
  createOccurrence,
  getNearbyOccurrences,
  getPublicMapPoints,
  getPublicOccurrence,
  getPublicOccurrences,
  getPublicOccurrenceTimeline,
  type OccurrenceFilters,
  type CreateOccurrenceInput,
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
  nearby: (latitude: number, longitude: number) =>
    [...occurrenceQueryKeys.all, 'nearby', latitude, longitude] as const,
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

export function useNearbyOccurrences(
  location: { latitude: number; longitude: number } | null,
  enabled: boolean,
) {
  return useQuery(
    queryOptions({
      queryKey: occurrenceQueryKeys.nearby(location?.latitude ?? 0, location?.longitude ?? 0),
      queryFn: ({ signal }) => getNearbyOccurrences(location!, signal),
      enabled: enabled && location !== null,
      staleTime: 30_000,
    }),
  );
}

export function useCreateOccurrence() {
  return useMutation({ mutationFn: (input: CreateOccurrenceInput) => createOccurrence(input) });
}

export function useConfirmExistingOccurrence() {
  return useMutation({
    mutationFn: (occurrenceId: string) => confirmExistingOccurrence(occurrenceId),
  });
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
