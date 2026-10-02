import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api/types";

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1 || !(error instanceof ApiError)) return false;
  return error.status === 0 || error.status >= 500;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
  },
});
