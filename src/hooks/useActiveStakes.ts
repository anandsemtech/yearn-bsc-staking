// src/hooks/useActiveStakes.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { bsc } from "viem/chains";
import { usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { STAKING_ABI } from "@/web3/abi/stakingAbi";
import type { ActivePackageRow } from "@/components/ActivePackages";

/* ----------------------------------------------------------------------------------
   ENV
---------------------------------------------------------------------------------- */
const PROXY =
  (import.meta.env.VITE_BASE_CONTRACT_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as const);

/* ----------------------------------------------------------------------------------
   Local cache (mem + localStorage)
---------------------------------------------------------------------------------- */
type CacheValue<T> = { t: number; data: T };
const MEM = new Map<string, CacheValue<any>>();

const DEFAULT_TTL_MS = 60_000;

function readCache<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const now = Date.now();
  const m = MEM.get(key);
  if (m && now - m.t < ttlMs) return m.data as T;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as CacheValue<T>;
    if (now - v.t < ttlMs) {
      MEM.set(key, v);
      return v.data;
    }
  } catch {}
  return null;
}

function writeCache<T>(key: string, data: T) {
  const entry: CacheValue<T> = { t: Date.now(), data };
  MEM.set(key, entry);
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

/* ----------------------------------------------------------------------------------
   Helpers
---------------------------------------------------------------------------------- */
function withTimeout<T>(p: Promise<T>, ms = 15_000): Promise<T> {
  let id: number | undefined;
  const to = new Promise<never>((_, rej) => {
    id = window.setTimeout(() => rej(new Error("Network timeout")), ms);
  });
  return Promise.race([p, to]).finally(() => id && clearTimeout(id)) as Promise<T>;
}

/** viem multicall result can be { result: ... } or raw ... depending on version/config */
function unwrap(entry: any) {
  if (entry == null) return undefined;
  if (Array.isArray(entry?.result)) return entry.result;
  if (typeof entry?.result !== "undefined") return entry.result; // can be bigint/bool/tuple
  if (Array.isArray(entry)) return entry;
  return entry;
}

/** Convert bigint wei → human string with small rounding */
function fmtAmount(wei: bigint): string {
  try {
    const n = Number(formatEther(wei));
    return Number.isFinite(n) ? n.toLocaleString() : "0";
  } catch {
    return "0";
  }
}

/* ----------------------------------------------------------------------------------
   On-chain shapes we read
---------------------------------------------------------------------------------- */
type StakeData = {
  totalStaked: bigint;
  claimedAPR: bigint;
  withdrawnPrincipal: bigint;
  startTime: bigint;       // uint40
  lastClaimedAt: bigint;   // uint40
  lastUnstakedAt: bigint;  // uint40
  packageId: bigint;       // uint16
  isFullyUnstaked: boolean;
};

type Pkg = {
  id: bigint;                              // uint16
  durationInDays: bigint;                  // uint16
  apr: bigint;                             // uint16 (basis points)
  monthlyUnstake: boolean;
  isActive: boolean;
  minStakeAmount: bigint;
  monthlyPrincipalReturnPercent: bigint;   // uint16 bps/month
  monthlyAPRClaimable: boolean;
  claimableInterval: bigint;               // seconds
  stakeMultiple: bigint;
  principalLocked: boolean;
};

type RpcPayload = {
  stakes: Array<StakeData & { idx: number; nextClaim: bigint; fullyUnstaked: boolean }>;
  pkgs: Map<number, Pkg>;
};

/* ----------------------------------------------------------------------------------
   Core hook (RPC-first)
---------------------------------------------------------------------------------- */
export function useActiveStakes(opts: {
  address?: `0x${string}` | null;
  requireDirtyOrStale?: boolean;
  softMaxAgeMs?: number;
  ttlMs?: number;
}) {
  const {
    address,
    requireDirtyOrStale = true,
    softMaxAgeMs = 120_000,
    ttlMs = 60_000,
  } = opts;

  const user = (address ?? "").toLowerCase() as Address | "";
  const publicClient = usePublicClient({ chainId: bsc.id });

  const [rows, setRows] = useState<ActivePackageRow[]>([]);
  const [loading, setLoading] = useState<boolean>(!!user);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef(false);

  /* --------------------------- Per-user "dirty" tracking --------------------------- */
  const DIRTY = useMemo(() => new Map<string, boolean>(), []);
  const isDirty = (id: string) => DIRTY.get(id) === true;
  const setDirty = (id: string, v: boolean) => DIRTY.set(id, v);

  /* --------------------------- Meta to control refetching -------------------------- */
  type Meta = { lastFetchedAt: number; lastRowCount: number };
  const META_KEY = (id: string) => `activeview:rpc:meta:${id}`;
  const readMeta = (id: string): Meta => {
    try {
      const raw = localStorage.getItem(META_KEY(id));
      return raw ? (JSON.parse(raw) as Meta) : { lastFetchedAt: 0, lastRowCount: -1 };
    } catch {
      return { lastFetchedAt: 0, lastRowCount: -1 };
    }
  };
  const writeMeta = (id: string, patch: Partial<Meta>) => {
    const prev = readMeta(id);
    const next = { ...prev, ...patch };
    try {
      localStorage.setItem(META_KEY(id), JSON.stringify(next));
    } catch {}
  };

  /* --------------------------------- RPC loader ----------------------------------- */
  const loadRpc = useCallback(async (): Promise<RpcPayload> => {
    if (!publicClient || !user) return { stakes: [], pkgs: new Map() };

    // 1) userStakeCounts
    const count = (await withTimeout(
      publicClient.readContract({
        address: PROXY,
        abi: STAKING_ABI as any,
        functionName: "userStakeCounts",
        args: [user],
      }) as Promise<bigint>,
      12_000
    )) as bigint;

    const n = Number(count ?? 0n);
    if (n <= 0) return { stakes: [], pkgs: new Map() };

    // 2) multicall stakes + helpers
    const stakeCalls = Array.from({ length: n }, (_, i) => ({
      address: PROXY,
      abi: STAKING_ABI as any,
      functionName: "getStake",
      args: [user, BigInt(i)],
    }));

    const nextCalls = Array.from({ length: n }, (_, i) => ({
      address: PROXY,
      abi: STAKING_ABI as any,
      functionName: "getNextClaimTime",
      args: [user, BigInt(i)],
    }));

    const fullCalls = Array.from({ length: n }, (_, i) => ({
      address: PROXY,
      abi: STAKING_ABI as any,
      functionName: "isFullyUnstaked",
      args: [user, BigInt(i)],
    }));

    const [stakeResRaw, nextResRaw, fullResRaw] = await withTimeout(
      Promise.all([
        publicClient.multicall({ contracts: stakeCalls, allowFailure: false }) as any,
        publicClient.multicall({ contracts: nextCalls, allowFailure: false }) as any,
        publicClient.multicall({ contracts: fullCalls, allowFailure: false }) as any,
      ]),
      15_000
    );

    const stakes: Array<StakeData & { idx: number; nextClaim: bigint; fullyUnstaked: boolean }> =
      (stakeResRaw as any[]).map((entry: any, i: number) => {
        const s = unwrap(entry) as StakeData | undefined;
        const next = unwrap(nextResRaw[i]);
        const full = unwrap(fullResRaw[i]);
        if (!s) {
          return {
            // fallback empty; will be filtered out below
            totalStaked: 0n,
            claimedAPR: 0n,
            withdrawnPrincipal: 0n,
            startTime: 0n,
            lastClaimedAt: 0n,
            lastUnstakedAt: 0n,
            packageId: 0n,
            isFullyUnstaked: false,
            idx: i,
            nextClaim: 0n,
            fullyUnstaked: false,
          };
        }
        return {
          ...(s as any),
          idx: i,
          nextClaim: (next ?? 0n) as bigint,
          fullyUnstaked: Boolean(full),
        };
      }).filter((s) => s.totalStaked !== 0n || s.startTime !== 0n);

    // 3) fetch distinct packages referenced by stakes
    const pkgIds = Array.from(new Set(stakes.map((s) => Number(s.packageId))));
    const pkgCalls = pkgIds.map((pid) => ({
      address: PROXY,
      abi: STAKING_ABI as any,
      functionName: "packages",          // ← mapping getter (stable)
      args: [BigInt(pid)],
    }));

    const pkgResultsRaw: any[] =
      pkgCalls.length > 0
        ? ((await publicClient.multicall({
            contracts: pkgCalls,
            allowFailure: true,          // tolerate bad/out-of-range ids
          })) as any[])
        : [];

    const pkgs = new Map<number, Pkg>();
    pkgResultsRaw.forEach((entry, i) => {
      // entry could be { status, result } or raw tuple; skip failures/empties
      if (entry?.status === "failure") return;
      const p = unwrap(entry);
      if (!Array.isArray(p) || p.length < 11) return;

      const pid = pkgIds[i]!;
      const pkg: Pkg = {
        id: p[0],
        durationInDays: p[1],
        apr: p[2],
        monthlyUnstake: p[3],
        isActive: p[4],
        minStakeAmount: p[5],
        monthlyPrincipalReturnPercent: p[6],
        monthlyAPRClaimable: p[7],
        claimableInterval: p[8],
        stakeMultiple: p[9],
        principalLocked: p[10],
      };
      pkgs.set(pid, pkg);
    });

    return { stakes, pkgs };
  }, [publicClient, user]);

  /* ------------------------------ Build UI rows ----------------------------------- */
  const buildRows = useCallback((data: RpcPayload): ActivePackageRow[] => {
    const out: ActivePackageRow[] = [];

    for (const s of data.stakes) {
      const pid = Number(s.packageId);
      const pkg = data.pkgs.get(pid);

      const startSec = Number(s.startTime ?? 0n);
      const nextClaimSec = Number(s.nextClaim ?? 0n);

      const aprBps = Number(pkg?.apr ?? 0n);
      const aprPct = aprBps > 0 ? aprBps / 100 : undefined;

      const fullyUnstaked =
        s.isFullyUnstaked ||
        s.withdrawnPrincipal >= s.totalStaked ||
        s.fullyUnstaked;

      const amount = fmtAmount(s.totalStaked);

      const row: ActivePackageRow = {
        id: `${user}-${pid}-${s.idx}`,
        packageName: `Package #${pid}`,
        amount,
        startDate: startSec ? new Date(startSec * 1000) : new Date(0),
        nextClaimWindow: nextClaimSec ? new Date(nextClaimSec * 1000) : undefined,
        status: pkg?.isActive ? "Active" : "Inactive",
        stakeIndex: String(s.idx),
        packageId: pid,
        aprPct,

        // Extended fields your mobile cards use
        isFullyUnstaked: fullyUnstaked,
        totalStakedWei: s.totalStaked,
        claimedAprWei: s.claimedAPR,
        aprBps: aprBps,
        startTs: startSec || undefined,
        nextClaimAt: nextClaimSec || undefined,
        principalWithdrawnWei: s.withdrawnPrincipal,

        pkgRules: pkg
          ? {
              durationInDays: Number(pkg.durationInDays ?? 0n),
              aprBps: aprBps,
              monthlyUnstake: Boolean(pkg.monthlyUnstake),
              isActive: Boolean(pkg.isActive),
              monthlyAPRClaimable: Boolean(pkg.monthlyAPRClaimable),
              claimableIntervalSec: Number(pkg.claimableInterval ?? 0n),
              principalLocked: Boolean(pkg.principalLocked),
            }
          : undefined,
      };

      out.push(row);
    }

    // Sort newest start first (matches your table sort)
    out.sort((a, b) => (b.startDate?.getTime?.() ?? 0) - (a.startDate?.getTime?.() ?? 0));
    return out;
  }, [user]);

  /* --------------------------------- Refresh -------------------------------------- */
  const refresh = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!publicClient) {
      setError("RPC client not ready");
      setLoading(false);
      return;
    }

    setError(null);

    const meta = readMeta(user);
    const now = Date.now();
    const isStale = now - (meta.lastFetchedAt || 0) > softMaxAgeMs;
    const shouldFetch = !requireDirtyOrStale || isDirty(user) || isStale;

    const CK = `activeview:rpc:${user}`;
    const cached = readCache<RpcPayload>(CK, ttlMs);

    if (cached) {
      setRows(buildRows(cached));
      setLoading(false);
      if (!shouldFetch) return;
    } else {
      setLoading(true);
    }

    try {
      const payload = await loadRpc();
      if (abortRef.current) return;

      writeCache(CK, payload);
      writeMeta(user, { lastFetchedAt: Date.now(), lastRowCount: payload.stakes.length });

      setRows(buildRows(payload));
      setDirty(user, false);
    } catch (e: any) {
      if (!abortRef.current) setError(e?.message || "Failed to load");
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [user, ttlMs, buildRows, loadRpc, publicClient, requireDirtyOrStale, softMaxAgeMs]);

  /* ---------------------------------- Effects ------------------------------------- */
  useEffect(() => {
    abortRef.current = false;
    refresh();
    return () => {
      abortRef.current = true;
    };
  }, [refresh]);

  // Invalidate & refresh on local app events (same as your existing version)
  useEffect(() => {
    let timer: number | null = null;

    const invalidate: EventListener = () => {
      if (!user) return;
      setDirty(user, true);
      if (timer != null) return;
      timer = window.setTimeout(() => {
        timer = null;
        const CK = `activeview:rpc:${user}`;
        MEM.delete(CK);
        try {
          localStorage.removeItem(CK);
        } catch {}
        refresh();
      }, 250);
    };

    const names = [
      "staking:updated",
      "active-packages:refresh",
      "stakes:changed",
      "apr:claimed",
      "unstaked",
      "staked",
    ];
    names.forEach((n) => window.addEventListener(n, invalidate));
    return () => {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      names.forEach((n) => window.removeEventListener(n, invalidate));
    };
  }, [refresh, user]);

  return { rows, loading, error, refresh };
}
