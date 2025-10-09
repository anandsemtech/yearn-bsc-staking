// src/hooks/useReferralProfile.ts
// Mobile-first, subgraph-backed referral profile hook with:
// - lib/subgraph client (rate limiting, backoff, dedupe)
// - localStorage cache (default 120s)
// - graceful GraphQL error handling (treat as empty profile)
// - bigint formatting helper

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
/** 10^n as bigint */
const BI10 = (n: number): bigint => {
  let x = 1n;
  for (let i = 0; i < n; i++) x *= 10n;
  return x;
};

/** Format bigint with given decimals (wei-style) */
export function fmt(v: bigint, decimals = 18, maxFrac = 4): string {
  const neg = v < 0n;
  const val: bigint = neg ? -v : v;
  const base: bigint = BI10(decimals);

  const intPart = val / base;
  let frac = (val % base).toString().padStart(decimals, "0");

  if (maxFrac <= 0) return `${neg ? "-" : ""}${intPart}`;

  // keep up to maxFrac digits, trim trailing zeros
  frac = frac.slice(0, maxFrac).replace(/0+$/, "");
  return `${neg ? "-" : ""}${intPart}${frac ? "." + frac : ""}`;
}

/* ============================================
   Query (adjust field names if your subgraph differs)
============================================ */
const REFERRAL_PROFILE = gql/* GraphQL */ `
  query ReferralProfile($id: ID!, $perLevel: Int!) {
    user(id: $id) {
      id
      myTotalYY
      decimalsYY
      referralLevelAggregates(first: 15, orderBy: level, orderDirection: asc) {
        level
        totalYY
        rows: referralLevelRows(first: $perLevel, orderBy: totalYY, orderDirection: desc) {
          referee { id }
          stakes
          totalYY
        }
      }
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
    const levels: ReferralLevel[] = (parsed.payload.levels ?? []).map((L) => ({
      level: L.level,
      totalYY: BigInt(L.totalYY ?? "0"),
      rows: (L.rows ?? []).map((r) => ({
        addr: r.addr,
        stakes: Number(r.stakes || 0),
        totalYY: BigInt(r.totalYY ?? "0"),
      })),
    }));

    return {
      decimals: { yy: dec },
      myTotalYY: BigInt(parsed.payload.myTotalYY ?? "0"),
      levels,
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
      levels: data.levels.map((L) => ({
        level: L.level,
        totalYY: L.totalYY.toString(),
        rows: L.rows.map((r) => ({
          addr: r.addr,
          stakes: r.stakes,
          totalYY: r.totalYY.toString(),
        })),
      })),
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
  const perLevel = options?.perLevel ?? 200;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [profile, setProfile] = useState<ReferralProfile | null>(() =>
    readCache(address ?? undefined, ttlMs)
  );

  const addrRef = useRef<string | null>(address ? address.toLowerCase() : null);

  // Keep cache snapshot synced when address or TTL changes
  useEffect(() => {
    addrRef.current = address ? address.toLowerCase() : null;
    setProfile(readCache(address ?? undefined, ttlMs));
  }, [address, ttlMs]);

  // Fetch (uses lib/subgraph with 429 handling)
  useEffect(() => {
    const addr = addrRef.current;
    if (!addr) return;

    // If we already have a fresh cache, don't fetch
    if (readCache(addr, ttlMs)) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Works with either export shape from lib/subgraph
        const call =
          (typeof subgraphRequest === "function" && subgraphRequest) ||
          ((subgraphShim as any)?.request as (q: string, v: any) => Promise<any>);

        if (!call) {
          throw new Error("lib/subgraph: missing subgraphRequest() or subgraph.request() export");
        }

        const data: any = await call(REFERRAL_PROFILE, { id: addr, perLevel });
        const u = data?.user;

        // If the user is not indexed yet, treat as empty profile
        if (!u) {
          const empty: ReferralProfile = { decimals: { yy: 18 }, myTotalYY: 0n, levels: [] };
          if (!cancelled) {
            setProfile(empty);
            writeCache(addr, empty);
          }
          return;
        }

        const dec = Number(u?.decimalsYY ?? 18);
        const levels: ReferralLevel[] = (u?.referralLevelAggregates ?? []).map((L: any) => ({
          level: Number(L?.level ?? 0),
          totalYY: BigInt(L?.totalYY ?? "0"),
          rows: (L?.rows ?? []).map((r: any) => ({
            addr: String(r?.referee?.id ?? "").toLowerCase(),
            stakes: Number(r?.stakes ?? 0),
            totalYY: BigInt(r?.totalYY ?? "0"),
          })),
        }));

        const next: ReferralProfile = {
          decimals: { yy: dec },
          myTotalYY: BigInt(u?.myTotalYY ?? "0"),
          levels,
        };

        if (!cancelled) {
          setProfile(next);
          writeCache(addr, next);
        }
      } catch (_e: any) {
        // Graceful fallback: show empty profile (UI will say “No referees yet”)
        const empty: ReferralProfile = { decimals: { yy: 18 }, myTotalYY: 0n, levels: [] };
        if (!cancelled) {
          setProfile(empty);
          setError(null); // suppress scary error banners in the UI
          writeCache(addr!, empty);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ttlMs, perLevel]);

  // Public API
  return useMemo(
    () => ({
      loading,
      error,
      decimals: profile?.decimals ?? { yy: 18 },
      myTotalYY: profile?.myTotalYY ?? 0n,
      levels: profile?.levels ?? [],
      /** clear local cache for the current address */
      invalidate: () => {
        const addr = addrRef.current;
        if (!addr) return;
        try {
          localStorage.removeItem(cacheKey(addr));
        } catch {}
      },
    }),
    [loading, error, profile]
  );
}
