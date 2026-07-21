import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api-error';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 1 || !(error instanceof ApiError)) return false;
        return ['NETWORK_ERROR', 'SERVER_ERROR', 'TIMEOUT'].includes(error.code);
      },
    },
  },
});
