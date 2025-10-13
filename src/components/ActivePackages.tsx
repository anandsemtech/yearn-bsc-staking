// src/components/ActivePackages.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { bsc } from "viem/chains";
import { formatEther } from "viem";
import LoadingActiveStakes from "./LoadingActiveStakes";
import { STAKING_ABI } from "@/web3/abi/stakingAbi";
import { explainTxError, normalizeEvmError, showUserSuccess } from "@/lib/errors";
import { motion, AnimatePresence } from "framer-motion";
import { useOnline } from "@/hooks/useOnline";
import { openTxOverlay } from "@/lib/txOverlay";
import yyCoin from "../assets/yy-coin.png"; // make sure this path exists


/* ----------------------------------------------------------------------------------
   Types (public row shape)
---------------------------------------------------------------------------------- */
export interface ActivePackageRow {
  id: string;
  packageName: string;
  amount: string;
  startDate: Date;
  nextClaimWindow?: Date;
  status: "Active" | "Inactive" | "Pending";
  stakeIndex: string;
  packageId: number;
  aprPct?: number;

  // Optional fields (if your hook provides them)
  startTs?: number;
  nextClaimAt?: number;
  pkgRules?: {
    durationInDays: number;
    aprBps: number;
    monthlyUnstake: boolean;
    isActive: boolean;
    monthlyAPRClaimable: boolean;
    claimableIntervalSec: number;
    principalLocked: boolean;
  };
  isFullyUnstaked?: boolean;
  totalStakedWei?: bigint;
  principalWithdrawnWei?: bigint;
  claimedAprWei?: bigint;
  aprBps?: number;

  // Optimistic helpers
  optimistic?: boolean;
  txHash?: string;
}

/* ----------------------------------------------------------------------------------
   ENV
---------------------------------------------------------------------------------- */
const PROXY =
  (import.meta.env.VITE_BASE_CONTRACT_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as const);

const CLAIM_FN_NAME = "claimAPR" as const;

/* ----------------------------------------------------------------------------------
   Time helpers
---------------------------------------------------------------------------------- */
const fmtDateTime = (d?: Date) =>
  d
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(d)
    : "—";

const fmtDateTimeSeconds = (d?: Date) =>
  d
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Kolkata",
      }).format(d)
    : "—";

/* ----------------------------------------------------------------------------------
   APR/Accrual helpers
---------------------------------------------------------------------------------- */
const SECS_PER_YEAR = 365 * 24 * 60 * 60;

function toEther(wei?: bigint): number {
  if (!wei) return 0;
  try {
    return Number(formatEther(wei));
  } catch {
    return 0;
  }
}

/** Derive APR % reliably from available fields */
function deriveAprPct(row: ActivePackageRow): number | undefined {
  if (typeof row.aprPct === "number") return row.aprPct;
  const bps = row.aprBps ?? row.pkgRules?.aprBps;
  if (bps == null) return undefined;
  return bps / 100;
}

/** Continuous accrual rate (YY tokens per second) based on principal × APR */
function ratePerSecondYY(row: ActivePackageRow): number {
  const aprPct = deriveAprPct(row) ?? 0;
  const principalYY = toEther(row.totalStakedWei ?? 0n);
  if (aprPct <= 0 || principalYY <= 0) return 0;
  return (principalYY * (aprPct / 100)) / SECS_PER_YEAR;
}

/** Default anchor for “since last window”:
 *  - If monthly APR claimable & we know the next window, anchor = nextWindow - interval
 *  - Otherwise, anchor = startDate
 */
function defaultAccrualAnchorMs(row: ActivePackageRow): number {
  const rules = row.pkgRules;
  const next = row.nextClaimWindow?.getTime?.();
  if (rules?.monthlyAPRClaimable && (rules?.claimableIntervalSec ?? 0) > 0 && next) {
    const intervalMs = Number(rules.claimableIntervalSec) * 1000;
    return Math.max(0, next - intervalMs);
  }
  return row.startDate?.getTime?.() ?? Date.now();
}

/* ----------------------------------------------------------------------------------
   Completion helpers
---------------------------------------------------------------------------------- */

/** Treat anything under 0.00001 YY as fully claimed to avoid float tails (18 decimals) */
const EPS_WEI = 10_000_000_000_000n; // 1e-5 YY

/** Compute cap, claimed, remaining and progress pct for the APR cap progress bar */
function capSummary(row: ActivePackageRow) {
  const aprBps = row.aprBps ?? row.pkgRules?.aprBps ?? 0;
  const total = row.totalStakedWei ?? 0n;
  const capWei = aprBps > 0 ? (total * BigInt(aprBps)) / 10000n : 0n;
  const claimed = row.claimedAprWei ?? 0n;
  const remaining = capWei > claimed ? capWei - claimed : 0n;
  const pct =
    capWei > 0n ? Math.min(100, Number((claimed * 10000n) / capWei) / 100) : 0;
  return { capWei, claimed, remaining, pct };
}

/** Completed only when principal is fully unstaked AND APR cap is fully claimed */
function isCompleted(row: ActivePackageRow): boolean {
  const { remaining } = capSummary(row);
  const aprClosed = remaining <= EPS_WEI;
  const principalClosed = !!row.isFullyUnstaked;
  return principalClosed && aprClosed;
}

/** Whether there is meaningful APR remaining to claim */
function aprRemaining(row: ActivePackageRow): boolean {
  const { remaining } = capSummary(row);
  return remaining > EPS_WEI;
}

/* ----------------------------------------------------------------------------------
   Props
---------------------------------------------------------------------------------- */
type Props = {
  rows: ActivePackageRow[];
  loading: boolean;
  error?: string | null;
  onClaim?: () => Promise<void> | void;
  onUnstake?: () => Promise<void> | void;
  onRefresh?: () => Promise<void> | void; // ✅ add this

};

/* Small helpers */
function fmtYY(wei?: bigint, maxFrac = 4) {
  if (wei == null) return "0";
  let n = "0";
  try {
    n = formatEther(wei);
  } catch {
    return "0";
  }
  if (!n.includes(".")) return Number(n).toLocaleString();
  const [w, f] = n.split(".");
  const fTrim = f.slice(0, maxFrac).replace(/0+$/, "");
  const wNum = Number(w);
  const wDisp = Number.isFinite(wNum) ? wNum.toLocaleString() : w;
  return fTrim ? `${wDisp}.${fTrim}` : wDisp;
}

/* Flip number micro-component (for the live counter) */
const FlipNumber: React.FC<{ value: string | number }> = ({ value }) => (
  <motion.span
    key={String(value)}
    initial={{ rotateX: 90, opacity: 0, transformOrigin: "top center" }}
    animate={{ rotateX: 0, opacity: 1 }}
    exit={{ rotateX: -90, opacity: 0 }}
    transition={{ duration: 0.25 }}
    className="inline-block"
  >
    {value}
  </motion.span>
);

/* ================================================================================ */
/*                                  Component                                       */
/* ================================================================================ */

// Friendlier empty state (with piggy bank + animated yy-coin)


// Friendlier empty state with piggy bank + multiple tiny YY coins pouring in


const EmptyState: React.FC<{ offline?: boolean; pending?: boolean }> = ({ offline, pending }) => {
  const onRetry = () => {
    window.dispatchEvent(new Event("active-packages:refresh"));
    window.dispatchEvent(new Event("staking:updated"));
  };

  // Tiny coins (size/position/delay) — tweak freely
  const coins = [
    { size: 22, left: "24%", delay: 0.0 },
    { size: 18, left: "38%", delay: 0.45 },
    { size: 20, left: "52%", delay: 0.9 },
    { size: 16, left: "34%", delay: 1.35 },
    { size: 19, left: "46%", delay: 1.8 },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] p-8 text-center">
      {/* soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-24 blur-3xl opacity-50"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, rgba(108,92,231,.18), transparent 25%, rgba(34,197,94,.16), transparent 60%)",
          animation: "spinGlow 14s linear infinite",
        }}
      />
      <style>{`
        @keyframes spinGlow { to { transform: rotate(360deg) } }
        @keyframes coinPour {
          0%   { transform: translateY(-56px) scale(0.95) rotate(0deg);   opacity: 0; }
          18%  { opacity: 1; }
          68%  { transform: translateY(26px)  scale(0.92) rotate(180deg); opacity: 1; }
          100% { transform: translateY(0px)   scale(1.0)  rotate(360deg); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="spinGlow"] { animation: none !important; }
          .coin { animation: none !important; }
        }
      `}</style>

      {/* Piggy bank area */}
      <div className="relative mx-auto mb-5 h-24 w-24">
        {/* pouring coins (staggered) */}
        {coins.map((c, i) => (
          <img
            key={i}
            src={yyCoin}
            alt=""
            className="coin absolute top-1/2 -translate-y-1/2 drop-shadow"
            style={{
              left: c.left,
              width: `${c.size}px`,
              height: `${c.size}px`,
              animation: `coinPour 2.6s ease-in-out ${c.delay}s infinite`,
              // tiny horizontal wiggle to feel organic
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
            }}
          />
        ))}

        {/* piggy bank (slot roughly under 42–48%) */}
        <svg
          viewBox="0 0 64 64"
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-24 text-white/75"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            d="M46 26c-2.5-6.5-9.5-11-18-11-10.5 0-19 7.2-19 16 0 6.2 4 11.5 9.8 14.1l-.3 4.9c-.1 1.4 1.3 2.3 2.5 1.6l6.6-3.6c1.6.3 3.2.5 4.9.5 10.5 0 19-7.2 19-16 0-1.5-.2-3-.6-4.5l4.3-2.4c1.2-.7 1.1-2.5-.1-3.1l-5.7-2.8c-1.1-.5-2.4 0-2.9 1z"
            fill="rgba(255,255,255,0.08)"
          />
          <circle cx="44" cy="30" r="2" fill="currentColor" />
          {/* slot hint */}
          <rect x="26" y="18" width="12" height="2" rx="1" fill="currentColor" opacity="0.6" />
        </svg>
      </div>

      {/* friendly copy */}
      <div className="relative z-10 space-y-2">
        <h3 className="text-lg font-semibold text-white">
          {pending ? "We’re wrapping things up…" : offline ? "You’re offline" : "Start your first stake"}
        </h3>
        <p className="mx-auto max-w-md text-sm text-white/75">
          {pending
            ? "Your last action is finishing. This page will refresh soon."
            : offline
            ? "Please reconnect to view your positions."
            : "Let your coins drip into savings — even small amounts grow over time."}
        </p>
      </div>

      {/* actions */}
      <div className="relative z-10 mt-5 flex flex-wrap items-center justify-center gap-3">
        {!offline && !pending && (
          <a
            href="#available-packages"
            className="inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition"
          >
            Explore Packages
          </a>
        )}
        <button
          onClick={onRetry}
          className="inline-flex items-center rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/15 ring-1 ring-white/15 transition"
        >
          Retry
        </button>
      </div>

      {!offline && !pending && (
        <p className="relative z-10 mt-4 text-[11px] text-white/60">
          A little today. A lot tomorrow. 🪙
        </p>
      )}
    </div>
  );
};





const ActivePackages: React.FC<Props> = ({ rows, loading, error, onClaim, onUnstake }) => {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: bsc.id });
  const { data: walletClient } = useWalletClient();

  /* ----------------------------- Grace-delay loader ------------------------------ */
  // Mirrors `loading` but holds the loader for a short grace period when loading flips to false.
  const [showLoading, setShowLoading] = useState<boolean>(loading);
  useEffect(() => {
    if (loading) {
      setShowLoading(true);
      return;
    }
    const t = window.setTimeout(() => setShowLoading(false), 10200); // 👈 1.2s grace delay
    return () => window.clearTimeout(t);
  }, [loading]);

  /* ----------------------------- Local optimistic rows ----------------------------- */
  const [optimisticRows, setOptimisticRows] = useState<ActivePackageRow[]>([]);
  // When each optimistic row was created (for elapsed timer)
  const [startedAtByTx, setStartedAtByTx] = useState<Record<string, number>>({});
  // 1s ticker so elapsed timer & accrual counters update
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // “since last window” manual anchors (reset on successful Claim)
  const [accrualAnchorByRow, setAccrualAnchorByRow] = useState<Record<string, number | undefined>>({});

  // Helper: merge optimistic with real props (dedupe by txHash or by packageId+startTs)
  const mergedRows = useMemo(() => {
    if (!optimisticRows.length) return rows;
    const out: ActivePackageRow[] = [];

    const propKeys = new Set<string>();
    rows.forEach((r) => {
      const key = r.txHash
        ? `tx:${r.txHash}`
        : `pkg:${r.packageId}:start:${r.startDate?.getTime?.() ?? 0}`;
      propKeys.add(key);
      out.push(r);
    });

    optimisticRows.forEach((o) => {
      const key = o.txHash
        ? `tx:${o.txHash}`
        : `pkg:${o.packageId}:start:${o.startTs ?? o.startDate?.getTime?.() ?? 0}`;
      if (!propKeys.has(key)) out.unshift(o);
    });

    out.sort((a, b) => (b.startDate?.getTime?.() ?? 0) - (a.startDate?.getTime?.() ?? 0));
    return out;
  }, [rows, optimisticRows]);

  // Convenience alias used by both desktop & mobile renderers
  const tableRows = mergedRows;

  // Listen for optimistic events published elsewhere
  useEffect(() => {
    function addFromPayload(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      const txHash: string | undefined = detail.txHash;

      const pkgName: string = detail.packageName ?? "Stake";
      const packageId: number = Number(detail.packageId ?? 0);
      const startTs = Number(detail.startTs ?? Math.floor(Date.now() / 1000));
      const amountLabel: string = detail.totalAmountLabel ?? "—";

      // Enriched optimistic fields
      const aprPct: number | undefined =
        typeof detail.aprPct === "number" ? detail.aprPct : undefined;
      const pkgRules: ActivePackageRow["pkgRules"] | undefined = detail.pkgRules;
      const nextClaimAt: number | undefined =
        typeof detail.nextClaimAt === "number" ? detail.nextClaimAt : undefined;

      const row: ActivePackageRow = {
        id: txHash ? `opt:${txHash}` : `opt:${packageId}:${startTs}`,
        packageName: pkgName,
        amount: amountLabel,
        startDate: new Date(startTs * 1000),
        status: "Pending",
        stakeIndex: txHash ?? `opt:${packageId}:${startTs}`,
        packageId,
        aprPct,
        startTs,
        optimistic: true,
        txHash,
        pkgRules,
        nextClaimWindow: nextClaimAt ? new Date(nextClaimAt * 1000) : undefined,
      };

      setOptimisticRows((prev) => {
        const key = row.txHash
          ? `tx:${row.txHash}`
          : `pkg:${row.packageId}:start:${row.startTs}`;
        const exists = prev.some(
          (r) =>
            (r.txHash
              ? `tx:${r.txHash}`
              : `pkg:${r.packageId}:start:${r.startTs}`) === key
        );
        return exists ? prev : [row, ...prev];
      });

      if (txHash) {
        setStartedAtByTx((m) => ({
          ...m,
          [txHash]: startTs * 1000 || Date.now(),
        }));
      }
    }

    const names = ["active-packages:add-optimistic", "stake:optimistic"];
    names.forEach((n) => window.addEventListener(n, addFromPayload as EventListener));

    // prune when props update
    function prune() {
      setOptimisticRows((prev) => {
        if (!prev.length) return prev;

        // exact matches (old behavior)
        const propKeys = new Set(
          rows.map((r) =>
            r.txHash ? `tx:${r.txHash}` : `pkg:${r.packageId}:start:${r.startDate?.getTime?.() ?? 0}`
          )
        );

        // fuzzy map (same package, start within ±2h)
        const propSimple = rows.map((r) => ({
          pid: r.packageId,
          t: r.startDate?.getTime?.() ?? 0,
        }));
        const FUZZ = 2 * 60 * 60 * 1000;

        return prev.filter((o) => {
          const key = o.txHash
            ? `tx:${o.txHash}`
            : `pkg:${o.packageId}:start:${o.startTs}`;

          if (propKeys.has(key)) return false;

          const oStart = (o.startTs ? o.startTs * 1000 : o.startDate?.getTime?.() ?? 0);
          const fuzzyHit = propSimple.some((p) => p.pid === o.packageId && Math.abs(p.t - oStart) <= FUZZ);
          if (fuzzyHit) return false;

          return true;
        });
      });
    }

    const refreshNames = ["staking:updated", "active-packages:refresh", "stakes:changed", "staked"];
    refreshNames.forEach((n) => window.addEventListener(n, prune as EventListener));

    return () => {
      names.forEach((n) => window.removeEventListener(n, addFromPayload as EventListener));
      refreshNames.forEach((n) => window.removeEventListener(n, prune as EventListener));
    };
  }, [rows]);

  // Promote optimistic row from Pending → Active on stake:confirmed
  useEffect(() => {
    function onStakedConfirmed(e: Event) {
      const { txHash } = (e as CustomEvent).detail || {};
      if (!txHash) return;
      setOptimisticRows((prev) =>
        prev.map((r) => (r.txHash === txHash && r.status === "Pending" ? { ...r, status: "Active" } : r))
      );
    }
    window.addEventListener("stake:confirmed", onStakedConfirmed as EventListener);
    return () => window.removeEventListener("stake:confirmed", onStakedConfirmed as EventListener);
  }, []);

  // Auto-promote Pending → Active after 120s if RPC view hasn't reflected yet
  useEffect(() => {
    const id = window.setInterval(() => {
      setOptimisticRows((prev) =>
        prev.map((r) => {
          if (r.status !== "Pending" || !r.txHash) return r;
          const started = startedAtByTx[r.txHash];
          if (!started) return r;
          const elapsed = Date.now() - started;
          if (elapsed > 120_000) {
            return { ...r, status: "Active" };
          }
          return r;
        })
      );
    }, 5000);
    return () => window.clearInterval(id);
  }, [startedAtByTx]);

  /* ----------------------------- Per-row UI state ------------------------------ */
  const [busyByRow, setBusyByRow] = useState<Record<string, "claim" | "unstake" | undefined>>({});
  const [errByRow, setErrByRow] = useState<Record<string, string | undefined>>({});
  const [optNextByRow, setOptNextByRow] = useState<Record<string, number | undefined>>({});
  const [optUnstakedByRow, setOptUnstakedByRow] = useState<Record<string, boolean | undefined>>({});
  const [flashByRow, setFlashByRow] = useState<Record<string, "claim" | "unstake" | undefined>>({});

  const online = useOnline();
  const anyPending = mergedRows.some((r) => r.status === "Pending");

  const setBusy = (stakeIndex: string, mode?: "claim" | "unstake") =>
    setBusyByRow((m) => ({ ...m, [stakeIndex]: mode }));
  const setErr = (stakeIndex: string, msg?: string) =>
    setErrByRow((m) => ({ ...m, [stakeIndex]: msg }));

  function triggerFlash(stakeIndex: string, kind: "claim" | "unstake") {
    setFlashByRow((m) => ({ ...m, [stakeIndex]: kind }));
    window.setTimeout(() => {
      setFlashByRow((m) => ({ ...m, [stakeIndex]: undefined }));
    }, 1200);
  }

  /* --------------------------------- Actions ---------------------------------- */
  async function claim(stakeIndex: string, pkg?: ActivePackageRow["pkgRules"]) {
    if (busyByRow[stakeIndex]) return;

    // Early guards
    if (anyPending) {
      setErr(
        stakeIndex,
        "Your latest stake is being processed on-chain. Actions are temporarily disabled until it confirms."
      );
      setTimeout(() => setErr(stakeIndex, undefined), 6000);
      return;
    }
    if (!online) {
      setErr(stakeIndex, "You're offline. Reconnect and retry.");
      setTimeout(() => setErr(stakeIndex, undefined), 6000);
      return;
    }
    if (!walletClient || !publicClient || !address) {
      setErr(stakeIndex, "Connect wallet");
      setTimeout(() => setErr(stakeIndex, undefined), 5000);
      return;
    }

    try {
      setErr(stakeIndex, undefined);
      setBusy(stakeIndex, "claim");

      const args = [BigInt(stakeIndex)];
      const sim = await publicClient.simulateContract({
        abi: STAKING_ABI as any,
        address: PROXY,
        functionName: CLAIM_FN_NAME,
        args,
        account: address,
        chain: bsc,
      });

      const hash = await walletClient.writeContract(sim.request);

      // Show global spinner → auto-confetti → auto-refresh events
      openTxOverlay(hash as any, "Claiming rewards…", {
        doneEvent: "apr:claimed",
        successText: "Claim confirmed!",
        celebrateMs: 1800,
      });

      // Locally set next-claim estimate and reset the accrual counter
      if (pkg?.monthlyAPRClaimable && pkg?.claimableIntervalSec) {
        const next = Math.floor(Date.now() / 1000) + Number(pkg.claimableIntervalSec);
        setOptNextByRow((m) => ({ ...m, [stakeIndex]: next }));
      }
      setAccrualAnchorByRow((m) => ({ ...m, [stakeIndex]: Date.now() }));

      triggerFlash(stakeIndex, "claim");
      showUserSuccess("Claim transaction sent");
      setBusy(stakeIndex, undefined);
      if (onClaim) await onClaim();
    } catch (e: any) {
      setBusy(stakeIndex, undefined);
      setErr(stakeIndex, normalizeEvmError(e).message);
      setTimeout(() => setErr(stakeIndex, undefined), 6000);
    }
  }

  async function unstake(stakeIndex: string) {
    if (busyByRow[stakeIndex]) return;

    // Early guards
    if (anyPending) {
      setErr(
        stakeIndex,
        "Your latest stake is being processed on-chain. Actions are temporarily disabled until it confirms."
      );
      setTimeout(() => setErr(stakeIndex, undefined), 6000);
      return;
    }
    if (!online) {
      setErr(stakeIndex, "You're offline. Reconnect and retry.");
      setTimeout(() => setErr(stakeIndex, undefined), 6000);
      return;
    }
    if (!walletClient || !publicClient || !address) {
      setErr(stakeIndex, "Connect wallet");
      setTimeout(() => setErr(stakeIndex, undefined), 5000);
      return;
    }

    try {
      setErr(stakeIndex, undefined);
      setBusy(stakeIndex, "unstake");

      const args = [BigInt(stakeIndex)];
      const sim = await publicClient.simulateContract({
        abi: STAKING_ABI as any,
        address: PROXY,
        functionName: "unstake",
        args,
        account: address,
        chain: bsc,
      });

      const hash = await walletClient.writeContract(sim.request);

      // Show global spinner → auto-confetti → auto-refresh events
      openTxOverlay(hash as any, "Unstaking…", {
        doneEvent: "unstaked",
        successText: "Unstake confirmed!",
        celebrateMs: 1800,
      });

      setOptUnstakedByRow((m) => ({ ...m, [stakeIndex]: true }));
      triggerFlash(stakeIndex, "unstake");
      showUserSuccess("Unstake transaction sent");
      setBusy(stakeIndex, undefined);
      if (onUnstake) await onUnstake();
    } catch (e: any) {
      setBusy(stakeIndex, undefined);
      setErr(stakeIndex, normalizeEvmError(e).message);
      setTimeout(() => setErr(stakeIndex, undefined), 6000);
    }
  }

  /* --------------------------------- Render ----------------------------------- */
  const columns = [
    { key: "pkg", header: "PACKAGE NAME" },
    { key: "amount", header: "AMOUNT" },
    { key: "apr", header: "APR" },
    { key: "start", header: "START DATE" },
    { key: "next", header: "NEXT CLAIM" },
    { key: "status", header: "STATUS" },
    { key: "actions", header: "ACTIONS" },
  ] as const;

  // Use showLoading (grace-delayed) instead of raw `loading`
  if (showLoading && tableRows.length === 0) return <LoadingActiveStakes />;

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-rose-500/30 p-6 text-rose-300">
        {error}
      </div>
    );
  }

  if (!tableRows.length) {
    const hasPending = mergedRows.some((r) => r.status === "Pending");
    return <EmptyState pending={hasPending} offline={!online} />;
  }


  // tiny UI atoms for mobile
  const PulseDot: React.FC<{ color?: string }> = ({ color = "bg-emerald-400" }) => (
    <span className="relative inline-block h-2.5 w-2.5">
      <span className={`absolute inset-0 rounded-full ${color}`} />
      <motion.span
        className={`absolute inset-0 rounded-full ${color}`}
        initial={{ scale: 0.8, opacity: 0.9 }}
        animate={{ scale: [0.8, 1.6, 0.8], opacity: [0.9, 0, 0.9] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </span>
  );

  const renderPendingInfo = (r: ActivePackageRow) => {
    if (r.status !== "Pending") return null;
    const started = r.txHash ? startedAtByTx[r.txHash] : undefined;
    const elapsed = started ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0;
    return (
      <div className="flex items-center gap-2 text-white/70">
        <span>●</span>
        <span>Processing on-chain…</span>
        <span className="text-white/50 text-xs">Elapsed: {elapsed}s</span>
      </div>
    );
  };

  // Earning sub-block used in both desktop + mobile amount cells
  const EarningBlock: React.FC<{ row: ActivePackageRow }> = ({ row }) => {
    const perSec = ratePerSecondYY(row);
    const perDay = perSec * 86400;
    // choose anchor: manual reset (after claim) > optimistic override > default
    const manual = accrualAnchorByRow[row.stakeIndex];
    const optNext = optNextByRow[row.stakeIndex]; // in seconds
    const defaultAnchor = defaultAccrualAnchorMs(row);
    const anchorMs =
      manual ??
      (optNext != null && row.pkgRules?.claimableIntervalSec
        ? Math.max(0, optNext * 1000 - Number(row.pkgRules.claimableIntervalSec) * 1000)
        : defaultAnchor);

    const elapsedSec = Math.max(0, (Date.now() - anchorMs) / 1000);
    const accrued = Math.max(0, perSec * elapsedSec);
    const accruedDisp = accrued.toLocaleString(undefined, { maximumFractionDigits: 6 });
    const perDayDisp = perDay.toLocaleString(undefined, { maximumFractionDigits: 6 });

    return (
      <div className="mt-1 min-w-[220px]">
        <motion.div
          className="text-white/80 text-xs"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          ~ <span className="font-semibold text-emerald-300">{perDayDisp}</span> YY / day
        </motion.div>
        <div className="text-[11px] text-white/60">
          +<FlipNumber value={accruedDisp} /> YY since last window
        </div>
      </div>
    );
  };

  return (
    <section className="mt-8">
      {mergedRows.some((r) => r.status === "Pending") && (
        <div className="mb-3 rounded-xl bg-white/10 ring-1 ring-white/15 px-3 py-2 text-sm text-white/80">
          We’re processing your latest transaction on-chain. Your view will update automatically.
        </div>
      )}

      {/* Desktop table */}
      <div className="relative rounded-2xl overflow-hidden bg-white/[0.04] ring-1 ring-white/10 shadow-2xl hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white/5 backdrop-blur">
              <tr className="[&>th]:px-5 [&>th]:py-3 [&>th]:text-left [&>th]:text-[11px] [&>th]:uppercase [&>th]:text-white/60">
                {columns.map((c) => (
                  <th key={c.key} className="font-medium">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/90">
              {tableRows.map((r) => {
                const pkg = r.pkgRules;
                const isOpt = !!r.optimistic;
                const nowMs = Date.now();

                // Optimistic rows should always look locked
                const optNext = optNextByRow[r.stakeIndex]; // unix seconds (from optimistic post-claim)
                const effectiveNextMs =
                  optNext != null ? optNext * 1000 : r.nextClaimWindow?.getTime?.();

                // Completion
                const completed = isCompleted(r);
                const { capWei, claimed, remaining, pct } = capSummary(r);

                const availableBase = !completed && (isOpt
                  ? false
                  : effectiveNextMs != null
                  ? effectiveNextMs <= nowMs
                  : true);

                const canClaim =
                  !completed &&
                  (pkg?.isActive ?? r.status === "Active") &&
                  r.status !== "Pending" &&
                  (pkg?.monthlyAPRClaimable
                    ? (pkg?.claimableIntervalSec ?? 0) > 0 && availableBase
                    : (pkg?.durationInDays ?? 0) > 0 &&
                      (r.startDate?.getTime?.() ?? 0) + (pkg?.durationInDays ?? 0) * 86400 * 1000 <= nowMs);

                const canUnstake =
                  !completed &&
                  (pkg?.isActive ?? r.status === "Active") &&
                  r.status !== "Pending" &&
                  !r.isFullyUnstaked &&
                  !pkg?.principalLocked &&
                  (pkg?.monthlyUnstake
                    ? (pkg?.claimableIntervalSec ?? 0) > 0 &&
                      (r.startDate?.getTime?.() ?? 0) + (pkg?.claimableIntervalSec ?? 0) * 1000 <= nowMs
                    : (pkg?.durationInDays ?? 0) > 0 &&
                      (r.startDate?.getTime?.() ?? 0) + (pkg?.durationInDays ?? 0) * 86400 * 1000 <= nowMs);

                const aprPct = deriveAprPct(r);

                return (
                  <tr key={r.id} className={`transition-colors ${r.optimistic ? "bg-white/5" : "hover:bg-white/[0.03]"}`}>
                    <td className="px-5 py-4">
                      {r.packageName}
                      {r.optimistic ? " (pending)" : ""}
                    </td>

                    <td className="px-5 py-4 tabular-nums">
                      <div className="font-medium">{r.amount}</div>
                      {/* live accrual snippet (hide when completed) */}
                      {!completed && <EarningBlock row={r} />}
                    </td>

                    <td className="px-5 py-4 text-emerald-400">
                      {typeof aprPct === "number" ? `${aprPct.toFixed(2)}%` : "—"}
                    </td>

                    <td className="px-5 py-4" title={r.startDate?.toISOString?.()}>
                      {fmtDateTimeSeconds(r.startDate)}
                    </td>

                    <td className="px-5 py-4">
                      {isOpt ? (
                        renderPendingInfo(r)
                      ) : completed ? (
                        <div className="text-white/60">—</div>
                      ) : (
                        <div className="flex items-center gap-2 text-white/60">
                          <span>●</span>
                          <span>{fmtDateTime(effectiveNextMs ? new Date(effectiveNextMs) : undefined)}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 " +
                          (isOpt || r.status === "Pending"
                            ? "bg-white/10 text-white/70 ring-white/20"
                            : "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20")
                        }
                      >
                        <span
                          className={
                            "h-1.5 w-1.5 rounded-full " +
                            (isOpt || r.status === "Pending" ? "bg-white/50" : "bg-emerald-400")
                          }
                        />
                        {completed ? "completed" : r.status === "Active" ? "staked" : (isOpt ? "pending" : r.status.toLowerCase())}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          disabled={!canClaim || anyPending || !online || !!busyByRow[r.stakeIndex]}
                          onClick={() => claim(r.stakeIndex, r.pkgRules)}
                          className={
                            "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium " +
                            (canClaim
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                              : "bg-white/10 text-white/60 cursor-not-allowed")
                          }
                        >
                          Claim
                        </button>
                        <button
                          disabled={!canUnstake || anyPending || !online || !!busyByRow[r.stakeIndex]}
                          onClick={() => unstake(r.stakeIndex)}
                          className={
                            "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium " +
                            (canUnstake
                              ? "bg-red-500 hover:bg-red-600 text-white"
                              : "bg-white/10 text-white/60 cursor-not-allowed")
                          }
                        >
                          Unstake
                        </button>
                      </div>
                      {/* row error */}
                      {errByRow[r.stakeIndex] && (
                        <div className="mt-2 text-xs text-rose-400">{errByRow[r.stakeIndex]}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards — use tableRows (merged with optimistic) */}
      <div className="md:hidden -mx-4 px-4 mt-6 space-y-4">
        {tableRows.map((r) => {
          const pkg = r.pkgRules;
          const isOpt = !!r.optimistic;
          const nowMs = Date.now();

          // Optimistic rows should always look locked
          const optNext = optNextByRow[r.stakeIndex]; // unix seconds (from optimistic post-claim)
          const effectiveNextMs =
            optNext != null ? optNext * 1000 : r.nextClaimWindow?.getTime?.();

          // Completion
          const completed = isCompleted(r);
          const { capWei, claimed, remaining, pct } = capSummary(r);

          const availableBase = !completed && (isOpt
            ? false
            : effectiveNextMs != null
            ? effectiveNextMs <= nowMs
            : true);

          const canClaim =
            !completed &&
            (pkg?.isActive ?? r.status === "Active") &&
            r.status !== "Pending" &&
            (pkg?.monthlyAPRClaimable
              ? (pkg?.claimableIntervalSec ?? 0) > 0 && availableBase
              : (pkg?.durationInDays ?? 0) > 0 &&
                (r.startDate?.getTime?.() ?? 0) + (pkg?.durationInDays ?? 0) * 86400 * 1000 <= nowMs);

          const canUnstake =
            !completed &&
            (pkg?.isActive ?? r.status === "Active") &&
            r.status !== "Pending" &&
            !r.isFullyUnstaked &&
            !pkg?.principalLocked &&
            (pkg?.monthlyUnstake
              ? (pkg?.claimableIntervalSec ?? 0) > 0 &&
                (r.startDate?.getTime?.() ?? 0) + (pkg?.claimableIntervalSec ?? 0) * 1000 <= nowMs
              : (pkg?.durationInDays ?? 0) > 0 &&
                (r.startDate?.getTime?.() ?? 0) + (pkg?.durationInDays ?? 0) * 86400 * 1000 <= nowMs);

          const started = r.txHash ? startedAtByTx[r.txHash] : undefined;
          const elapsed =
            r.status === "Pending" && started
              ? Math.max(0, Math.floor((Date.now() - started) / 1000))
              : 0;

          const aprPct = deriveAprPct(r);

          return (
            <motion.div
              key={r.id}
              whileTap={{ scale: 0.98 }}
              className={`relative rounded-3xl p-5 border shadow-[0_6px_20px_-5px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden ${
                r.optimistic
                  ? "bg-gradient-to-br from-white/[0.09] to-white/[0.04] border-white/15"
                  : "bg-gradient-to-br from-white/[0.07] to-white/[0.02] border-white/10"
              }`}
            >
              {/* top accent */}
              <div
                className={`absolute inset-x-0 top-0 h-[3px] ${
                  r.status === "Pending"
                    ? "bg-gradient-to-r from-zinc-400 to-zinc-200"
                    : completed
                    ? "bg-gradient-to-r from-emerald-400 to-green-500"
                    : !isOpt && availableBase
                    ? "bg-gradient-to-r from-emerald-400 to-green-500"
                    : "bg-gradient-to-r from-sky-400 to-blue-500"
                }`}
              />

              <div className="flex justify-between items-center mb-2">
                <div className="text-white font-semibold">
                  {r.packageName}
                  {r.optimistic ? " (pending)" : ""}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {isOpt ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-white/50 inline-block" />
                      <span className="text-white/70">Processing…</span>
                      <span className="text-white/50">({elapsed}s)</span>
                    </>
                  ) : completed ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block" />
                      <span className="text-emerald-400">Completed</span>
                    </>
                  ) : availableBase ? (
                    <>
                      <PulseDot />
                      <span className="text-emerald-400">Available now</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-white/35 inline-block" />
                      <span className="text-white/50">Locked</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-white/80 text-sm space-y-1">
                <div>
                  Amount: <span className="font-medium text-white">{r.amount}</span>
                </div>
                <div>
                  APR:{" "}
                  <span className="font-medium text-emerald-400">
                    {typeof aprPct === "number" ? `${aprPct.toFixed(2)}%` : "—"}
                  </span>
                </div>

                {/* live accrual snippet (hide when completed) */}
                {!completed && <EarningBlock row={r} />}

                {r.status !== "Pending" ? (
                  // If optimistic → always show Next claim (locked)
                  isOpt ? (
                    <div className="text-xs text-white/60 mt-1">
                      ⏳ Next claim: {fmtDateTime(effectiveNextMs ? new Date(effectiveNextMs) : undefined)}
                    </div>
                  ) : completed ? (
                    <div className="mt-2 text-[13px] text-emerald-300">All done 🎉</div>
                  ) : availableBase ? (
                    <div className="mt-2 text-[13px] text-emerald-300">
                      Claimable now:{" "}
                      <span className="font-semibold text-emerald-200">up to {fmtYY(remaining)}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/60 mt-1">
                      ⏳ Next claim: {fmtDateTime(effectiveNextMs ? new Date(effectiveNextMs) : undefined)}
                    </div>
                  )
                ) : null}

                {/* Progress: Claimed vs Cap (hide bar when optimistic & no totals) */}
                {!isOpt && (
                  <div className="mt-2">
                    <div className="flex justify-between text-[11px] text-white/55 mb-1">
                      <span>Claimed</span>
                      <span>
                        {fmtYY(claimed)} / {fmtYY(capWei)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-green-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Hide action buttons when completed */}
              {!completed && (
                <div className="mt-4 flex gap-3">
                  <motion.button
                    whileTap={canClaim ? { scale: 0.98 } : {}}
                    disabled={!canClaim || anyPending || !online || !!busyByRow[r.stakeIndex]}
                    onClick={() => claim(r.stakeIndex, r.pkgRules)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      canClaim
                        ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:brightness-110 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                        : "bg-white/10 text-white/60 cursor-not-allowed"
                    }`}
                  >
                    Claim
                  </motion.button>

                  <motion.button
                    whileTap={canUnstake ? { scale: 0.98 } : {}}
                    disabled={!canUnstake || anyPending || !online || !!busyByRow[r.stakeIndex]}
                    onClick={() => unstake(r.stakeIndex)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      canUnstake
                        ? "bg-gradient-to-r from-red-500 to-rose-600 hover:brightness-110 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                        : "bg-white/10 text-white/60 cursor-not-allowed"
                    }`}
                  >
                    Unstake
                  </motion.button>
                </div>
              )}

              <AnimatePresence>{/* shimmer kept out for brevity */}</AnimatePresence>

              {/* row error (mobile) */}
              {errByRow[r.stakeIndex] && (
                <div className="mt-2 text-xs text-rose-400">{errByRow[r.stakeIndex]}</div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default ActivePackages;
