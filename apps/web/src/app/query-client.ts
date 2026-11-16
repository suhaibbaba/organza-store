import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@web/shared/lib/api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) =>
        error instanceof ApiError && error.status < 500 ? false : count < 2,
    },
    mutations: { retry: false },
  },
});
