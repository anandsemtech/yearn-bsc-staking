import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { bsc } from "viem/chains";
import { usePublicClient } from "wagmi";
import { STAKING_ABI } from "@/web3/abi/stakingAbi";

type Totals = {
  lifeSum: bigint; // lifetime claimed total (wei)
  availY: bigint;
  availS: bigint;
  availP: bigint;
  availSum: bigint;
};

const toLower = (s?: string | null) => (s ? s.toLowerCase() : s);

const Y_ENV = toLower(import.meta.env.VITE_YYEARN_ADDRESS);
const S_ENV = toLower(import.meta.env.VITE_SYEARN_ADDRESS);
const P_ENV = toLower(import.meta.env.VITE_PYEARN_ADDRESS);

const PROXY =
  (import.meta.env.VITE_BASE_CONTRACT_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as const);

const COOLDOWN_MS = 6000;
const POST_CLAIM_STEPS_MS = [2500, 4000, 6000, 9000];

// set this to your proxy’s deploy block for speed
const DEFAULT_FROM_BLOCK = (() => {
  const env = Number(import.meta.env.VITE_STAKING_DEPLOY_BLOCK_BSC || "0");
  return Number.isFinite(env) && env > 0 ? BigInt(env) : 0n;
})();
const BLOCK_SPAN = 10_000n;

/** 🔎 Only the CLAIM event should represent lifetime-claimed aggregation */
const CLAIM_EVENT_CANDIDATES = [
  "ReferralRewardsClaimed", // (user, yAmount, sAmount, pAmount)
];

/** 💰 Earnings events that add to referralEarnings (exclude claim-time "Distributed") */
const EARNING_EVENT_CANDIDATES = [
  "ReferralRewarded",
  "ReferralRewardsAdded",
  "ReferralEarning",
  "ReferralEarnings",
];

/** potential view functions for “available by token” (user, token) -> uint256 */
const FN_AVAIL_CANDIDATES_2ARGS = [
  // ✅ correct mapping getter for your contract
  "referralEarnings",
  // other common names people use
  "referralRewards",
  "referralAvailable",
  "pendingReferralRewards",
  "getReferralAvailable",
  "getReferralRewards",
];

function add(a: bigint, b: bigint) { return a + b; }
function getAbiEvent(name: string) {
  return (STAKING_ABI as any[]).find((x) => x?.type === "event" && x?.name === name) ?? null;
}
function isIndexed(ev: any, inputName: string) {
  const inp = ev?.inputs?.find((i: any) => i.name === inputName);
  return !!inp?.indexed;
}

export function useEarningsRPC(user?: Address | string) {
  const pc = usePublicClient({ chainId: bsc.id });
  const userHex = (toLower(user ?? "") || null) as string | null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);
  const [version, setVersion] = useState(0);

  const [lifeSum, setLifeSum] = useState<bigint>(0n);
  const [availY, setAvailY] = useState<bigint>(0n);
  const [availS, setAvailS] = useState<bigint>(0n);
  const [availP, setAvailP] = useState<bigint>(0n);

  const availSum = useMemo(() => availY + availS + availP, [availY, availS, availP]);
  const coolingDown = useMemo(() => Date.now() - lastFetchedAt < COOLDOWN_MS, [lastFetchedAt]);

  const inFlight = useRef(false);
  const abortRef = useRef(0);

  // -------- helpers
  const tryRead2 = async (fn: string, u: `0x${string}`, token: `0x${string}`) => {
    try {
      const val = await pc!.readContract({
        address: PROXY,
        abi: STAKING_ABI as any,
        functionName: fn as any,
        args: [u, token],
      });
      // viem returns bigint for uint256
      if (typeof val === "bigint") return val;
      if (Array.isArray(val) && typeof val[0] === "bigint") return val[0] as bigint;
    } catch {}
    return null;
  };

  const readAvailableForToken = async (userAddr: `0x${string}`, token?: string | null) => {
    if (!token) return 0n;
    for (const fn of FN_AVAIL_CANDIDATES_2ARGS) {
      const v = await tryRead2(fn, userAddr, token as `0x${string}`);
      if (v !== null) return v;
    }
    return null; // signal: no getter exists
  };

  const scanEventWindow = async (evName: string, fromBlock: bigint, toBlock: bigint, userAddr?: string | null) => {
    const ev = getAbiEvent(evName);
    if (!pc || !ev) return [] as any[];
    const filter = await pc.createEventFilter({
      address: PROXY,
      event: ev as any,
      args: isIndexed(ev, "user") && userAddr ? { user: userAddr as `0x${string}` } : undefined,
      fromBlock,
      toBlock,
    });
    const logs = await pc.getFilterLogs({ filter });

    // If user isn’t indexed, post-filter by the first address input name we can find.
    if (userAddr && !isIndexed(ev, "user")) {
      const addrInput = ev.inputs?.find((i: any) => i.type === "address")?.name || "user";
      return logs.filter((l: any) => (l.args?.[addrInput] ?? "").toLowerCase() === userAddr.toLowerCase());
    }
    return logs;
  };

  const scanEventPaged = async (evName: string, fromBlock: bigint, toBlock: bigint, userAddr?: string | null) => {
    const all: any[] = [];
    for (let start = fromBlock; start <= toBlock; start += BLOCK_SPAN) {
      const end = start + BLOCK_SPAN - 1n > toBlock ? toBlock : start + BLOCK_SPAN - 1n;
      try {
        const chunk = await scanEventWindow(evName, start, end, userAddr);
        all.push(...chunk);
      } catch {}
    }
    all.sort((a: any, b: any) => (a.blockNumber > b.blockNumber ? 1 : -1));
    return all;
  };

  const fetchOnce = useCallback(async (force = false) => {
    if (!pc || !userHex) return;
    if (inFlight.current) return;
    if (!force && Date.now() - lastFetchedAt < COOLDOWN_MS) return;

    inFlight.current = true;
    setLoading(true);
    setError(null);
    const marker = ++abortRef.current;

    try {
      const latest = await pc.getBlockNumber();
      const user0x = userHex as `0x${string}`;

      // ---------- (A) First, try on-chain getters for AVAILABLE balances
      let yVal: bigint | null = await readAvailableForToken(user0x, Y_ENV);
      let sVal: bigint | null = await readAvailableForToken(user0x, S_ENV);
      let pVal: bigint | null = await readAvailableForToken(user0x, P_ENV);

      // ---------- (B) Compute lifetime claimed (for UI stats only)
      // NOTE: We purposely look only for claim events here.
      let lastClaimBlock = DEFAULT_FROM_BLOCK;
      let lifeY = 0n, lifeS = 0n, lifeP = 0n;

      for (const evName of CLAIM_EVENT_CANDIDATES) {
        const claimLogs = await scanEventPaged(evName, DEFAULT_FROM_BLOCK, latest, userHex);
        for (const c of claimLogs) {
          const a = c.args || {};
          const y = BigInt(a.yAmount ?? a.yyAmount ?? 0n);
          const s = BigInt(a.sAmount ?? 0n);
          const p = BigInt(a.pAmount ?? 0n);
          lifeY = add(lifeY, y);
          lifeS = add(lifeS, s);
          lifeP = add(lifeP, p);
          if (c.blockNumber && c.blockNumber > lastClaimBlock) lastClaimBlock = c.blockNumber;
        }
        if (claimLogs.length) break; // we found a working claim event, stop trying others
      }

      // ---------- (C) If any getter is missing (null), fall back to earnings logs
      if (yVal === null || sVal === null || pVal === null) {
        const startFrom = lastClaimBlock > 0n ? lastClaimBlock + 1n : DEFAULT_FROM_BLOCK;

        // pick the first earnings event that exists in ABI and yields logs
        let earningLogs: any[] = [];
        for (const name of EARNING_EVENT_CANDIDATES) {
          const ev = getAbiEvent(name);
          if (!ev) continue;
          const logs = await scanEventPaged(name, startFrom, latest, userHex);
          earningLogs = logs;
          if (earningLogs.length) break;
        }

        // group by token (address arg may be named token/rewardToken)
        let ySum = 0n, sSum = 0n, pSum = 0n;
        for (const e of earningLogs) {
          const a = e.args || {};
          const token = toLower(a.token ?? a.rewardToken ?? "");
          const amt = BigInt(a.amount ?? a.value ?? 0n);
          if (!token) continue;
          if (Y_ENV && token === Y_ENV) ySum = add(ySum, amt);
          else if (S_ENV && token === S_ENV) sSum = add(sSum, amt);
          else if (P_ENV && token === P_ENV) pSum = add(pSum, amt);
        }

        if (yVal === null) yVal = ySum;
        if (sVal === null) sVal = sSum;
        if (pVal === null) pVal = pSum;
      }

      if (abortRef.current !== marker) return;

      setLifeSum(lifeY + lifeS + lifeP);
      setAvailY(yVal ?? 0n);
      setAvailS(sVal ?? 0n);
      setAvailP(pVal ?? 0n);
      setLastFetchedAt(Date.now());
      setVersion((v) => v + 1);
    } catch (e: any) {
      if (abortRef.current !== marker) return;
      setError(e?.shortMessage || e?.message || "Failed to read earnings via RPC");
    } finally {
      if (abortRef.current === marker) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, [pc, userHex, lastFetchedAt]);

  const refetch = useCallback(() => { void fetchOnce(true); }, [fetchOnce]);

  const refetchAfterMutation = useCallback(async () => {
    for (const d of POST_CLAIM_STEPS_MS) {
      await new Promise((r) => setTimeout(r, d));
      await fetchOnce(true);
      if (availSum === 0n) break;
    }
  }, [fetchOnce, availSum]);

  useEffect(() => { void fetchOnce(true); /* eslint-disable-next-line */ }, [userHex, pc]);

  const totals: Totals = useMemo(
    () => ({ lifeSum, availY, availS, availP, availSum: availY + availS + availP }),
    [lifeSum, availY, availS, availP]
  );

  return {
    loading,
    error,
    totals,
    refetch,
    refetchAfterMutation,
    lastFetchedAt,
    coolingDown,
    version,
  };
}
