"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/api-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              // Never retry auth/permission/validation failures — retrying
              // won't change the outcome and just delays the error state.
              if (error instanceof ApiClientError && ["UNAUTHENTICATED", "FORBIDDEN", "VALIDATION_ERROR", "NOT_FOUND"].includes(error.code)) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
