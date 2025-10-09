// src/hooks/useEarningsSG.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";

import { gql, subgraphRequest } from "@/lib/subgraph";

/**
 * This hook reads referral earnings (lifetime + available-by-token) from the Subgraph.
 * It ONLY talks to subgraph.ts (which handles 429s, backoff, failover, LRU cache, in-flight dedupe).
 * There is no polling — only manual refresh and short post-claim polling.
 */

/* =========================
   Types
========================= */
type RawEarning = { token: string; amount: string; timestamp: string };
type RawClaim = { yAmount: string; sAmount: string; pAmount: string; timestamp: string };

type Totals = {
  lifeSum: bigint; // lifetime claimed total (wei)
  availY: bigint;
  availS: bigint;
  availP: bigint;
  availSum: bigint;
};

/* =========================
   Queries (paginated where needed)
========================= */
const Q_LAST = gql`
  query LastReferralClaim($userBytes: Bytes!) {
    last: referralRewardsClaims(
      where: { user: $userBytes }
      first: 1
      orderBy: timestamp
      orderDirection: desc
    ) { timestamp }
  }
`;

const Q_CLAIMS_PAGE = gql`
  query ClaimsPage($userBytes: Bytes!, $first: Int!, $skip: Int!) {
    claims: referralRewardsClaims(
      where: { user: $userBytes }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: asc
    ) { yAmount sAmount pAmount timestamp }
  }
`;

const Q_EARNINGS_PAGE = gql`
  query EarningsPage($user: String!, $since: BigInt!, $first: Int!, $skip: Int!) {
    earnings: referralEarnings(
      where: { user: $user, timestamp_gt: $since }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: asc
    ) { token amount timestamp }
  }
`;

/* =========================
   Tunables
========================= */
// Cooldown between manual fetches (prevents 429)
const COOLDOWN_MS = 6000;

// Short, bounded backoff sequence after a successful claim (stop early if avail==0)
const POST_CLAIM_STEPS_MS = [2500, 4000, 6000, 9000];

// Pagination
const PAGE_SIZE = 500;
const MAX_PAGES = 10; // hard cap (safety)

/* =========================
   Helpers
========================= */
const toLower = (s?: string | null) => (s ? s.toLowerCase() : s);

const Y_ENV = toLower(import.meta.env.VITE_YYEARN_ADDRESS);
const S_ENV = toLower(import.meta.env.VITE_SYEARN_ADDRESS);
const P_ENV = toLower(import.meta.env.VITE_PYEARN_ADDRESS);

const safeBig = (v: string | number | bigint | null | undefined): bigint => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (!v) return 0n;
  return BigInt(String(v));
};

function sumBig(a: bigint, b: string | bigint) {
  if (typeof b === "bigint") return a + b;
  return a + BigInt(b || "0");
}

/* =========================
   Hook
========================= */
export function useEarningsSG(user?: Address | string, opts?: { ttlMs?: number }) {
  const ttlMs = opts?.ttlMs ?? 30_000;

  const userHex = toLower(user ?? "") || null;
  const userBytes = userHex as string | null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);
  const [version, setVersion] = useState(0);

  const inFlight = useRef(false);
  const abortRef = useRef(0);

  const [lifeSum, setLifeSum] = useState<bigint>(0n);
  const [availY, setAvailY] = useState<bigint>(0n);
  const [availS, setAvailS] = useState<bigint>(0n);
  const [availP, setAvailP] = useState<bigint>(0n);

  const availSum = useMemo(() => availY + availS + availP, [availY, availS, availP]);

  const coolingDown = useMemo(() => {
    const dt = Date.now() - lastFetchedAt;
    return dt < COOLDOWN_MS;
  }, [lastFetchedAt]);

  const fetchPaginated = async <T,>(
    query: string,
    variables: Record<string, any>,
    key: "claims" | "earnings",
    ttl = ttlMs,
  ): Promise<T[]> => {
    const out: T[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
       const resp = await subgraphRequest<{ [k: string]: T[] }>(
         query,
         { ...variables, first: PAGE_SIZE, skip: page * PAGE_SIZE },
         ttl
       );
      const chunk = (resp?.[key] ?? []) as T[];
      out.push(...chunk);
      if (chunk.length < PAGE_SIZE) break; // last page
    }
    return out;
  };

  const fetchOnce = useCallback(
    async (force = false) => {
      if (!userHex || !userBytes) return;
      if (inFlight.current) return;

      if (!force) {
        const dt = Date.now() - lastFetchedAt;
        if (dt < COOLDOWN_MS) return;
      }

      inFlight.current = true;
      setLoading(true);
      setError(null);
      const marker = ++abortRef.current;

      try {
        // 1) Last claim timestamp
         const lastRes = await subgraphRequest<{ last: { timestamp: string }[] }>(
           Q_LAST,
           { userBytes },
           ttlMs
         );
        const since = lastRes?.last?.[0]?.timestamp ? safeBig(lastRes.last[0].timestamp) : 0n;

        // 2) Lifetime claimed (paginated)
        const claimRows = await fetchPaginated<RawClaim>(
          Q_CLAIMS_PAGE,
          { userBytes },
          "claims",
          ttlMs
        );

        let lifeY = 0n, lifeS = 0n, lifeP = 0n;
        for (const c of claimRows) {
          lifeY = sumBig(lifeY, c.yAmount);
          lifeS = sumBig(lifeS, c.sAmount);
          lifeP = sumBig(lifeP, c.pAmount);
        }
        const lifeTotal = lifeY + lifeS + lifeP;

        // 3) Earnings since last claim (paginated), grouped by token
        const earnRows = await fetchPaginated<RawEarning>(
          Q_EARNINGS_PAGE,
          { user: userHex, since: since.toString() },
          "earnings",
          ttlMs
        );

        const perToken = new Map<string, bigint>();
        for (const e of earnRows) {
          const key = toLower(e.token);
          if (!key) continue;
          perToken.set(key, sumBig(perToken.get(key) ?? 0n, e.amount));
        }

        // 4) Map to YY/SY/PY via ENV (robust to missing envs)
        const yVal = Y_ENV ? (perToken.get(Y_ENV) ?? 0n) : 0n;
        const sVal = S_ENV ? (perToken.get(S_ENV) ?? 0n) : 0n;
        const pVal = P_ENV ? (perToken.get(P_ENV) ?? 0n) : 0n;

        // If a newer fetch started, abort result application
        if (abortRef.current !== marker) return;

        setLifeSum(lifeTotal);
        setAvailY(yVal);
        setAvailS(sVal);
        setAvailP(pVal);
        setLastFetchedAt(Date.now());
        setVersion((v) => v + 1);
      } catch (e: any) {
        if (abortRef.current !== marker) return;
        setError(e?.message || "Failed to load earnings");
      } finally {
        if (abortRef.current === marker) {
          setLoading(false);
          inFlight.current = false;
        }
      }
    },
    [userHex, userBytes, lastFetchedAt, ttlMs]
  );

  const refetch = useCallback(() => fetchOnce(true), [fetchOnce]);

  // After a successful on-chain claim, briefly poll SG until available is 0 or we exhaust steps
  const refetchAfterMutation = useCallback(async () => {
    for (const delay of POST_CLAIM_STEPS_MS) {
      await new Promise((r) => setTimeout(r, delay));
      await fetchOnce(true);
      if (availSum === 0n) break;
    }
  }, [fetchOnce, availSum]);

  // Initial fetch (once per user)
  useEffect(() => {
    void fetchOnce(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userHex]);

  const totals: Totals = useMemo(
    () => ({
      lifeSum,
      availY,
      availS,
      availP,
      availSum,
    }),
    [lifeSum, availY, availS, availP, availSum]
  );

  return {
    loading,
    error,                 // <— expose error for UI
    totals,                // { lifeSum, availY, availS, availP, availSum } in wei
    refetch,               // manual refresh (cooldown-protected)
    refetchAfterMutation,  // short post-claim polling
    lastFetchedAt,
    coolingDown,
    version,
  };
}
