import { QueryClient } from "@tanstack/react-query";

export function clearLmsSessionCache(queryClient: QueryClient) {
  queryClient.clear();
}

export function createLmsQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const status = typeof error === "object" && error && "status" in error
            ? Number(error.status)
            : 0;
          return status !== 401 && failureCount < 1;
        },
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
