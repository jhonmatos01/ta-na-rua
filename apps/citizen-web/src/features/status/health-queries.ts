import { queryOptions, useQuery } from '@tanstack/react-query';

import { env } from '../../config/env';
import { getApiHealth, getDatabaseHealth } from './health-api';

export const healthQueryKeys = {
  all: ['health'] as const,
  api: () => [...healthQueryKeys.all, 'api'] as const,
  database: () => [...healthQueryKeys.all, 'database'] as const,
};

export const apiHealthQueryOptions = queryOptions({
  queryKey: healthQueryKeys.api(),
  queryFn: ({ signal }) => getApiHealth(signal),
  enabled: env.enableApiStatus,
});

export const databaseHealthQueryOptions = queryOptions({
  queryKey: healthQueryKeys.database(),
  queryFn: ({ signal }) => getDatabaseHealth(signal),
  enabled: env.enableDatabaseStatus,
});

export function useApiHealth() {
  return useQuery(apiHealthQueryOptions);
}

export function useDatabaseHealth() {
  return useQuery(databaseHealthQueryOptions);
}
