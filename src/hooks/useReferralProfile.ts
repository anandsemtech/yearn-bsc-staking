// src/hooks/useReferralProfile.ts
// Minimal profile hook: pulls user's total staked from subgraph,
// provides decimals (YY = 18), local cache + graceful fallback.

import { useEffect, useMemo, useRef, useState } from "react";
import { gql, subgraphRequest, subgraph as subgraphShim } from "@/lib/subgraph";

/* ============================================
   Types
============================================ */
export type ReferralRow = { addr: string; stakes: number; totalYY: bigint };
export type ReferralLevel = { level: number; totalYY: bigint; rows: ReferralRow[] };
export type ReferralProfile = { decimals: { yy: number }; myTotalYY: bigint; levels: ReferralLevel[] };

type CacheShape = {
  at: number;
  payload: {
    decimals?: { yy?: number };
    myTotalYY?: string;
    // kept for forward/backward compat; we'll just store an empty array now
    levels?: Array<{
      level: number;
      totalYY: string;
      rows: Array<{ addr: string; stakes: number; totalYY: string }>;
    }>;
  };
};

type Options = { ttlMs?: number; perLevel?: number };

const DEFAULT_TTL = 120_000;

/* ============================================
   Utils
============================================ */
const BI10 = (n: number): bigint => {
  let x = 1n;
  for (let i = 0; i < n; i++) x *= 10n;
  return x;
};

export function fmt(v: bigint, decimals = 18, maxFrac = 4): string {
  const neg = v < 0n;
  const val: bigint = neg ? -v : v;
  const base: bigint = BI10(decimals);
  const intPart = val / base;
  let frac = (val % base).toString().padStart(decimals, "0");
  if (maxFrac <= 0) return `${neg ? "-" : ""}${intPart}`;
  frac = frac.slice(0, maxFrac).replace(/0+$/, "");
  return `${neg ? "-" : ""}${intPart}${frac ? "." + frac : ""}`;
}

/* ============================================
   Query (aligns with your schema)
   - We only need totalStaked from User.
============================================ */
const REFERRAL_PROFILE = gql/* GraphQL */ `
  query ReferralProfile($id: ID!) {
    user(id: $id) {
      id
      totalStaked
    }
  }
`;

/* ============================================
   Cache helpers (localStorage)
============================================ */
const cacheKey = (addr: string) => `ref:profile:${addr.toLowerCase()}`;

function readCache(addr?: string | null, ttlMs = DEFAULT_TTL): ReferralProfile | null {
  if (!addr) return null;
  try {
    const raw = localStorage.getItem(cacheKey(addr));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed?.at || !parsed.payload) return null;
    if (Date.now() - parsed.at > ttlMs) return null;

    const dec = parsed.payload.decimals?.yy ?? 18;
    return {
      decimals: { yy: dec },
      myTotalYY: BigInt(parsed.payload.myTotalYY ?? "0"),
      // kept for compat with older cache structure
      levels: [],
    };
  } catch {
    return null;
  }
}

function writeCache(addr?: string | null, data?: ReferralProfile) {
  if (!addr || !data) return;
  const wrap: CacheShape = {
    at: Date.now(),
    payload: {
      decimals: { yy: data.decimals?.yy ?? 18 },
      myTotalYY: data.myTotalYY.toString(),
      levels: [], // not used anymore by this hook
    },
  };
  try {
    localStorage.setItem(cacheKey(addr), JSON.stringify(wrap));
  } catch {}
}

/* ============================================
   Hook
============================================ */
export function useReferralProfile(
  address?: `0x${string}` | null,
  options?: Options
) {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [profile, setProfile] = useState<ReferralProfile | null>(() =>
    readCache(address ?? undefined, ttlMs)
  );

  const addrRef = useRef<string | null>(address ? address.toLowerCase() : null);

  useEffect(() => {
    addrRef.current = address ? address.toLowerCase() : null;
    setProfile(readCache(address ?? undefined, ttlMs));
  }, [address, ttlMs]);

  useEffect(() => {
    const addr = addrRef.current;
    if (!addr) return;

    // If cache is fresh, skip fetch
    if (readCache(addr, ttlMs)) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const call =
          (typeof subgraphRequest === "function" && subgraphRequest) ||
          ((subgraphShim as any)?.request as (q: string, v: any) => Promise<any>);
        if (!call) throw new Error("lib/subgraph: missing subgraphRequest() or subgraph.request() export");

        const data: any = await call(REFERRAL_PROFILE, { id: addr });
        const u = data?.user;

        // not indexed yet → empty
        if (!u) {
          const empty: ReferralProfile = { decimals: { yy: 18 }, myTotalYY: 0n, levels: [] };
          if (!cancelled) {
            setProfile(empty);
            writeCache(addr, empty);
          }
          return;
        }

        const next: ReferralProfile = {
          decimals: { yy: 18 },           // YY = 18d
          myTotalYY: BigInt(u.totalStaked ?? "0"),
          levels: [],                     // levels now handled elsewhere
        };

        if (!cancelled) {
          setProfile(next);
          writeCache(addr, next);
        }
      } catch (_e) {
        const empty: ReferralProfile = { decimals: { yy: 18 }, myTotalYY: 0n, levels: [] };
        if (!cancelled) {
          setProfile(empty);
          setError(null);
          writeCache(addr!, empty);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [ttlMs]);

  return useMemo(
    () => ({
      loading,
      error,
      decimals: profile?.decimals ?? { yy: 18 },
      myTotalYY: profile?.myTotalYY ?? 0n,
      levels: [], // intentionally empty; multi-level data is loaded via dedicated hooks
      invalidate: () => {
        const addr = addrRef.current;
        if (!addr) return;
        try { localStorage.removeItem(cacheKey(addr)); } catch {}
      },
    }),
    [loading, error, profile]
  );
}
