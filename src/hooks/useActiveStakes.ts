import { useEffect, useRef, useState, useCallback } from "react";
import { formatEther } from "viem";
import { gql } from "graphql-request";
import { subgraph } from "@/lib/subgraph";
import type { ActivePackageRow } from "@/components/ActivePackages";

/* ---------------- Local cache ---------------- */
type CacheValue = { t: number; data: any };
const MEM = new Map<string, CacheValue>();
const TTL_MS_DEFAULT = 60_000;

function readCache(key: string, ttlMs = TTL_MS_DEFAULT) {
  const now = Date.now();
  const m = MEM.get(key);
  if (m && now - m.t < ttlMs) return m.data;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v: CacheValue = JSON.parse(raw);
    if (now - v.t < ttlMs) {
      MEM.set(key, v);
      return v.data;
    }
  } catch {}
  return null;
}
function writeCache(key: string, data: any) {
  const entry: CacheValue = { t: Date.now(), data };
  MEM.set(key, entry);
  try { localStorage.setItem(key, JSON.stringify(entry)); } catch {}
}

/* ---------------- GraphQL (single call) ---------------- */
const Q_ACTIVE_VIEW = gql/* GraphQL */ `
  query ActiveView($id: ID!) {
    packages(orderBy: packageId, orderDirection: asc) {
      packageId
      durationInDays
      aprBps
      monthlyUnstake
      isActive
      monthlyAPRClaimable
      claimableInterval
      principalLocked
    }
    stakes(where:{ user: $id }, orderBy: startTime, orderDirection: desc) {
      id
      packageId
      totalStaked
      claimedAPR
      withdrawnPrincipal
      startTime
      lastClaimedAt
      lastUnstakedAt
      isFullyUnstaked
    }
  }
`;

type RawPkg = {
  packageId: number | string;
  durationInDays: number | string;
  aprBps: number | string;
  monthlyUnstake: boolean;
  isActive: boolean;
  monthlyAPRClaimable: boolean;
  claimableInterval: string;
  principalLocked: boolean;
};
type RawStake = {
  id: string;
  packageId: number | string;
  totalStaked: string;
  claimedAPR: string;
  withdrawnPrincipal: string;
  startTime: string;
  lastClaimedAt: string;
  lastUnstakedAt: string;
  isFullyUnstaked: boolean;
};

/* ---------------- New: fetch control ---------------- */
let STAKES_DIRTY = true;
let LAST_FETCH_AT = 0;

type Meta = { lastFetchedAt: number; lastNonEmptyAt: number; lastRowCount: number };
const META_KEY = (id: string) => `activeview:meta:${id}`;
const EMPTY_COOLDOWN_MS = 5 * 60_000; // 5 min: skip refetch if empty recently

function readMeta(id: string): Meta {
  try {
    const raw = localStorage.getItem(META_KEY(id));
    if (!raw) return { lastFetchedAt: 0, lastNonEmptyAt: 0, lastRowCount: -1 };
    return JSON.parse(raw) as Meta;
  } catch {
    return { lastFetchedAt: 0, lastNonEmptyAt: 0, lastRowCount: -1 };
  }
}
function writeMeta(id: string, patch: Partial<Meta>) {
  const prev = readMeta(id);
  const next = { ...prev, ...patch };
  try { localStorage.setItem(META_KEY(id), JSON.stringify(next)); } catch {}
}

/* ---------------- Hook ---------------- */
export function useActiveStakes(opts: {
  address?: `0x${string}` | null;
  requireDirtyOrStale?: boolean;
  softMaxAgeMs?: number;
  ttlMs?: number;
}) {
  const { address, requireDirtyOrStale = true, softMaxAgeMs = 120_000, ttlMs = 60_000 } = opts;
  const userId = (address ?? "").toLowerCase();

  const [rows, setRows] = useState<ActivePackageRow[]>([]);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const buildRows = useCallback((pkgs: RawPkg[], stakes: RawStake[]): ActivePackageRow[] => {
    const pkgMap = new Map<number, {
      durationInDays: number;
      aprBps: number;
      monthlyUnstake: boolean;
      isActive: boolean;
      monthlyAPRClaimable: boolean;
      claimableIntervalSec: number;
      principalLocked: boolean;
    }>();
    for (const p of pkgs) {
      const idNum = typeof p.packageId === "string" ? Number(p.packageId) : p.packageId;
      pkgMap.set(idNum, {
        durationInDays: Number(p.durationInDays || 0),
        aprBps: Number(p.aprBps || 0),
        monthlyUnstake: Boolean(p.monthlyUnstake),
        isActive: Boolean(p.isActive),
        monthlyAPRClaimable: Boolean(p.monthlyAPRClaimable),
        claimableIntervalSec: Number(p.claimableInterval || 0),
        principalLocked: Boolean(p.principalLocked),
      });
    }

    return stakes.map((s) => {
      const pkgId = typeof s.packageId === "string" ? Number(s.packageId) : s.packageId;
      const pkg = pkgMap.get(pkgId);

      const stakeIndexStr = (s.id.split("-").pop() || "0");
      const startSec = Number(s.startTime || 0);
      const lastClaimSec = Number(s.lastClaimedAt || 0);

      const nextClaimAt =
        pkg?.monthlyAPRClaimable && pkg.claimableIntervalSec
          ? (lastClaimSec > 0 ? lastClaimSec + pkg.claimableIntervalSec
                              : startSec > 0 ? startSec + pkg.claimableIntervalSec : 0)
          : 0;

      const totalStakedWei = BigInt(s.totalStaked || "0");
      const claimedAprWei = BigInt(s.claimedAPR || "0");
      const principalWithdrawnWei = BigInt(s.withdrawnPrincipal || "0");

      let amountHuman = "0";
      try { amountHuman = Number(formatEther(totalStakedWei)).toLocaleString(); } catch {}

      const packageActive = Boolean(pkg?.isActive);
      const fullyUnstaked = Boolean(s.isFullyUnstaked) || principalWithdrawnWei >= totalStakedWei;

      return {
        id: s.id,
        packageName: `Package #${pkgId}`,
        amount: amountHuman,
        startDate: startSec ? new Date(startSec * 1000) : new Date(0),
        nextClaimWindow: nextClaimAt ? new Date(nextClaimAt * 1000) : undefined,
        status: packageActive ? "Active" : "Inactive",
        stakeIndex: stakeIndexStr,
        packageId: pkgId,
        aprPct: pkg ? pkg.aprBps / 100 : undefined,

        isFullyUnstaked: fullyUnstaked,
        totalStakedWei,
        claimedAprWei,
        aprBps: pkg?.aprBps,
        startTs: startSec || undefined,
        nextClaimAt: nextClaimAt || undefined,
        principalWithdrawnWei,

        pkgRules: pkg ? {
          durationInDays: pkg.durationInDays,
          aprBps: pkg.aprBps,
          monthlyUnstake: pkg.monthlyUnstake,
          isActive: pkg.isActive,
          monthlyAPRClaimable: pkg.monthlyAPRClaimable,
          claimableIntervalSec: pkg.claimableIntervalSec,
          principalLocked: pkg.principalLocked,
        } : undefined,
      } as ActivePackageRow;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) { setRows([]); setLoading(false); setError(null); return; }

    const now = Date.now();
    const meta = readMeta(userId);

    const isStale = now - LAST_FETCH_AT > softMaxAgeMs;
    const shouldFetchBase = !requireDirtyOrStale || STAKES_DIRTY || isStale;

    const recentlyEmpty = meta.lastRowCount === 0 && (now - meta.lastFetchedAt) < EMPTY_COOLDOWN_MS;
    const shouldFetch = shouldFetchBase && !recentlyEmpty;

    setError(null);

    const CK = `activeview:v3:${userId}`;
    const cached = readCache(CK, ttlMs);
    if (cached) {
      setRows(buildRows(cached.packages, cached.stakes));
      setLoading(false);
      if (!shouldFetch) return; // ✅ skip network
    } else {
      setLoading(true);
    }

    if (!shouldFetch) return; // ✅ guard again

    try {
      const data = await subgraph.request<any>(Q_ACTIVE_VIEW, { id: userId });
      if (abortRef.current) return;

      LAST_FETCH_AT = Date.now();
      STAKES_DIRTY = false;

      const payload = {
        packages: (data?.packages || []) as RawPkg[],
        stakes: (data?.stakes || []) as RawStake[],
      };

      const rowCount = payload.stakes.length;
      writeMeta(userId, {
        lastFetchedAt: LAST_FETCH_AT,
        lastRowCount: rowCount,
        ...(rowCount > 0 ? { lastNonEmptyAt: LAST_FETCH_AT } : {}),
      });

      writeCache(CK, payload);
      setRows(buildRows(payload.packages, payload.stakes));
    } catch (e: any) {
      if (!abortRef.current) setError(e?.message || "Failed to load");
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [userId, ttlMs, buildRows, requireDirtyOrStale, softMaxAgeMs]);

  useEffect(() => { abortRef.current = false; refresh(); return () => { abortRef.current = true; }; }, [refresh]);

  // Refresh on relevant local events
  useEffect(() => {
    let timer: number | null = null;

    const invalidate: EventListener = () => {
      STAKES_DIRTY = true;
      if (timer != null) return;
      timer = window.setTimeout(() => {
        timer = null;
        const CK = `activeview:v3:${userId}`;
        MEM.delete(CK);
        try { localStorage.removeItem(CK); } catch {}
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
      if (timer != null) { clearTimeout(timer); timer = null; }
      names.forEach((n) => window.removeEventListener(n, invalidate));
    };
  }, [refresh, userId]);

  return { rows, loading, error, refresh };
}
