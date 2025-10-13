// src/hooks/useEarningsStable.ts
import type { Address } from "viem";
import { useMemo } from "react";
import { useEarningsRPC } from "@/hooks/useEarningsRPC";

/**
 * Wrapper that keeps a stable hook order even across HMR.
 * It does not branch or early-return before finishing its own hooks.
 */
export function useEarningsStable(user?: Address | string) {
  // 1) Call the underlying hook unconditionally
  const rpc = useEarningsRPC(user);

  // 2) Memoize the shape we expose so the object identity is stable when values are
  return useMemo(
    () => ({
      loading: rpc.loading,
      error: rpc.error,
      totals: rpc.totals,
      refetch: rpc.refetch,
      refetchAfterMutation: rpc.refetchAfterMutation,
      lastFetchedAt: rpc.lastFetchedAt,
      coolingDown: rpc.coolingDown,
      version: rpc.version,
    }),
    [
      rpc.loading,
      rpc.error,
      rpc.totals,
      rpc.refetch,
      rpc.refetchAfterMutation,
      rpc.lastFetchedAt,
      rpc.coolingDown,
      rpc.version,
    ]
  );
}
