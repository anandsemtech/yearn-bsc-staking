import { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (count, err: any) => {
        const s = err?.response?.status ?? 0;
        return (s === 429 || (s >= 500 && s < 600)) && count < 3;
      },
    },
  },
});

export function DataProvider({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
