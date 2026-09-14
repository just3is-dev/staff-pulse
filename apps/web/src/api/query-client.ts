import { QueryClient } from '@tanstack/react-query';

const STALE_TIME_MS = 5_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        structuralSharing: true,
        retry: false,
        // Срабатывают только для устаревших данных, лишних запросов не дают.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}
