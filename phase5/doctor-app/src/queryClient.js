/**
 * doctor-app/src/queryClient.js
 * Phase 5 Fix — React Query client configuration
 *
 * COPY TO: doctor-app/src/queryClient.js
 * INSTALL: npm install @tanstack/react-query @tanstack/react-query-devtools
 *
 * Then update doctor-app/src/index.jsx — see the UPDATED index.jsx file
 * in this package.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 min — data stays fresh
      gcTime: 1000 * 60 * 30,        // 30 min — keep in cache after unmount
      retry: 1,                       // retry once on failure
      refetchOnWindowFocus: false,    // don't refetch on tab switch (medical app)
      refetchOnReconnect: true,       // refetch when internet reconnects
    },
    mutations: {
      retry: 0,                       // never retry mutations (prevents double-submit)
    },
  },
});
