/**
 * queryClient.js
 * Phase 5 Fix: React Query client configuration
 *
 * APPLY TO: doctor-app/src/queryClient.js (create new file)
 *
 * Install dependency first:
 *   npm install @tanstack/react-query @tanstack/react-query-devtools
 *
 * Then update doctor-app/src/index.jsx (or main.jsx) to wrap your app:
 *
 *   import { QueryClientProvider } from "@tanstack/react-query";
 *   import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
 *   import { queryClient } from "./queryClient";
 *
 *   root.render(
 *     <QueryClientProvider client={queryClient}>
 *       <App />
 *       <ReactQueryDevtools initialIsOpen={false} />
 *     </QueryClientProvider>
 *   );
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutes — data considered fresh
      gcTime: 1000 * 60 * 30,          // 30 minutes — keep unused data in cache
      retry: 1,                         // Retry once on failure
      refetchOnWindowFocus: false,      // Don't refetch on tab switch (medical app)
      refetchOnReconnect: true,         // Refetch when internet reconnects
    },
    mutations: {
      retry: 0,                         // Never retry mutations (avoid double-submit)
    },
  },
});

// -----------------------------------------------------------------------
// Example usage in a component (copy-paste starter):
//
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import useAuthStore from "./store/useAuthStore";
//
// const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
//
// // Fetching the queue:
// const { data: queue, isLoading } = useQuery({
//   queryKey: ["queue", hospitalId],
//   queryFn: async () => {
//     const { token } = useAuthStore.getState();
//     const res = await fetch(`${API_BASE}/api/v1/healthcare/walkin?hospital_id=${hospitalId}`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });
//     if (!res.ok) throw new Error("Failed to fetch queue");
//     return res.json();
//   },
// });
//
// // Creating a prescription (mutation):
// const { mutate: createPrescription, isPending } = useMutation({
//   mutationFn: async (prescriptionData) => {
//     const { token } = useAuthStore.getState();
//     const res = await fetch(`${API_BASE}/api/v1/healthcare/prescriptions`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//       body: JSON.stringify(prescriptionData),
//     });
//     if (!res.ok) throw new Error("Failed to create prescription");
//     return res.json();
//   },
//   onSuccess: () => {
//     queryClient.invalidateQueries({ queryKey: ["queue"] }); // refresh queue
//   },
// });
// -----------------------------------------------------------------------
