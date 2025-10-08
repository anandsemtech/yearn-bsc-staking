// src/components/ActivePackages.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { bsc } from "viem/chains";
import { formatEther } from "viem";
import LoadingActiveStakes from "./LoadingActiveStakes";
import { STAKING_ABI } from "@/web3/abi/stakingAbi";
import { explainTxError, normalizeEvmError, showUserSuccess } from "@/lib/errors";
import { motion, AnimatePresence } from "framer-motion";

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
   Props
---------------------------------------------------------------------------------- */
type Props = {
  rows: ActivePackageRow[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onClaim?: () => Promise<void> | void;
  onUnstake?: () => Promise<void> | void;
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

/* ================================================================================ */
/*                                  Component                                       */
/* ================================================================================ */
const ActivePackages: React.FC<Props> = ({
  rows,
  loading,
  error,
  onRefresh,
  onClaim,
  onUnstake,
}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: bsc.id });
  const { data: walletClient } = useWalletClient();

  /* ----------------------------- Local optimistic rows ----------------------------- */
  const [optimisticRows, setOptimisticRows] = useState<ActivePackageRow[]>([]);
  // When each optimistic row was created (for elapsed timer)
  const [startedAtByTx, setStartedAtByTx] = useState<Record<string, number>>({});
  // 1s ticker so elapsed timer updates
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  // Listen for optimistic events from the modal
  useEffect(() => {
    function addFromPayload(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      const txHash: string | undefined = detail.txHash;
      const pkgName: string = detail.packageName ?? "Stake";
      const packageId: number = Number(detail.packageId ?? 0);
      const startTs = Number(detail.startTs ?? Math.floor(Date.now() / 1000));
      const amountLabel: string = detail.totalAmountLabel ?? "—";

      const row: ActivePackageRow = {
        id: txHash ? `opt:${txHash}` : `opt:${packageId}:${startTs}`,
        packageName: pkgName,
        amount: amountLabel,
        startDate: new Date(startTs * 1000),
        status: "Pending",
        stakeIndex: txHash ?? `opt:${packageId}:${startTs}`,
        packageId,
        aprPct: undefined,
        startTs,
        optimistic: true,
        txHash,
      };

      setOptimisticRows((prev) => {
        const key = row.txHash ? `tx:${row.txHash}` : `pkg:${row.packageId}:start:${row.startTs}`;
        const exists = prev.some(
          (r) => (r.txHash ? `tx:${r.txHash}` : `pkg:${r.packageId}:start:${r.startTs}`) === key
        );
        return exists ? prev : [row, ...prev];
      });

      if (txHash) {
        setStartedAtByTx((m) => ({ ...m, [txHash]: startTs * 1000 || Date.now() }));
      }
    }

    const names = ["active-packages:add-optimistic", "stake:optimistic"];
    names.forEach((n) => window.addEventListener(n, addFromPayload as EventListener));

    // When data is updated, prune optimistic rows that have been materialized
    function prune() {
      setOptimisticRows((prev) => {
        if (!prev.length) return prev;
        const propKeys = new Set(
          rows.map((r) =>
            r.txHash ? `tx:${r.txHash}` : `pkg:${r.packageId}:start:${r.startDate?.getTime?.() ?? 0}`
          )
        );
        return prev.filter((o) => {
          const ok = o.txHash ? `tx:${o.txHash}` : `pkg:${o.packageId}:start:${o.startTs}`;
          return !propKeys.has(ok);
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

  // NEW: promote optimistic row from Pending → Active on stake:confirmed (modal fires this after receipt)
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

  // NEW: auto-promote Pending → Active after 120s if subgraph hasn't caught up
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

  /* ----------------------------- Debounced refresh ----------------------------- */
  const refreshTimer = useRef<number | null>(null);
  const debouncedRefresh = useMemo(
    () => () => {
      if (!onRefresh) return;
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        onRefresh();
        refreshTimer.current = null;
      }, 800);
    },
    [onRefresh]
  );

  useEffect(() => {
    if (!onRefresh) return;
    const h = () => debouncedRefresh();
    const names = [
      "staking:updated",
      "active-packages:refresh",
      "stakes:changed",
      "apr:claimed",
      "unstaked",
      "staked",
    ];
    names.forEach((n) => window.addEventListener(n, h as EventListener));
    return () =>
      names.forEach((n) => window.removeEventListener(n, h as EventListener));
  }, [debouncedRefresh, onRefresh]);

  useEffect(() => {
    if (!publicClient || !onRefresh) return;
    const unwatch = publicClient.watchContractEvent({
      address: PROXY,
      abi: STAKING_ABI as any,
      eventName: ["Staked", "AprClaimed", "Unstaked"] as any,
      onLogs: () => debouncedRefresh(),
      onError: () => {},
      poll: true,
    });
    return () => {
      try {
        unwatch?.();
      } catch {}
    };
  }, [publicClient, debouncedRefresh, onRefresh]);

  /* ----------------------------- Per-row UI state ------------------------------ */
  const [busyByRow, setBusyByRow] = useState<Record<string, "claim" | "unstake" | undefined>>({});
  const [errByRow, setErrByRow] = useState<Record<string, string | undefined>>({});
  const [optNextByRow, setOptNextByRow] = useState<Record<string, number | undefined>>({});
  const [optUnstakedByRow, setOptUnstakedByRow] = useState<Record<string, boolean | undefined>>({});
  const [flashByRow, setFlashByRow] = useState<Record<string, "claim" | "unstake" | undefined>>({});

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
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      setBusy(stakeIndex, undefined);
      if (receipt.status !== "success") {
        const appErr = explainTxError("claim", new Error("Transaction reverted"));
        setErr(stakeIndex, appErr.message);
        setTimeout(() => setErr(stakeIndex, undefined), 6000);
        return;
      }

      if (pkg?.monthlyAPRClaimable && pkg?.claimableIntervalSec) {
        const next = Math.floor(Date.now() / 1000) + Number(pkg.claimableIntervalSec);
        setOptNextByRow((m) => ({ ...m, [stakeIndex]: next }));
      }

      triggerFlash(stakeIndex, "claim");
      showUserSuccess("Claim confirmed");
      window.dispatchEvent(new Event("apr:claimed"));
      window.dispatchEvent(new Event("staking:updated"));
      if (onClaim) await onClaim();
      debouncedRefresh();
    } catch (e: any) {
      setBusy(stakeIndex, undefined);
      setErr(stakeIndex, normalizeEvmError(e).message);
      setTimeout(() => setErr(stakeIndex, undefined), 6000);
    }
  }

  async function unstake(stakeIndex: string) {
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      setBusy(stakeIndex, undefined);
      if (receipt.status !== "success") {
        const appErr = explainTxError("unstake", new Error("Transaction reverted"));
        setErr(stakeIndex, appErr.message);
        setTimeout(() => setErr(stakeIndex, undefined), 6000);
        return;
      }

      setOptUnstakedByRow((m) => ({ ...m, [stakeIndex]: true }));
      triggerFlash(stakeIndex, "unstake");

      showUserSuccess("Unstake confirmed");
      window.dispatchEvent(new Event("unstaked"));
      window.dispatchEvent(new Event("staking:updated"));
      if (onUnstake) await onUnstake();
      debouncedRefresh();
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

  // Use merged length in all guards to ensure optimistic rows show on mobile too
  if (loading && tableRows.length === 0) return <LoadingActiveStakes />;

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-rose-500/30 p-6 text-rose-300">
        {error}
      </div>
    );
  }

  if (!tableRows.length) {
    return (
      <div className="rounded-2xl border border-white/15 p-6 text-center text-white/70 bg-white/[0.04]">
        No active stakes.
      </div>
    );
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

  const SuccessShimmer: React.FC<{ kind: "claim" | "unstake" }> = ({ kind }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
    >
      <motion.div
        initial={{ x: "-120%" }}
        animate={{ x: "160%" }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className={`h-full w-1/3 rotate-[12deg] ${
          kind === "claim"
            ? "bg-gradient-to-br from-emerald-300/20 via-white/40 to-emerald-300/20"
            : "bg-gradient-to-br from-rose-300/20 via-white/40 to-rose-300/20"
        } blur-md`}
      />
    </motion.div>
  );

  const renderPendingInfo = (r: ActivePackageRow) => {
    if (r.status !== "Pending") return null;
    const started = r.txHash ? startedAtByTx[r.txHash] : undefined;
    const elapsed = started ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0;
    return (
      <div className="flex items-center gap-2 text-white/70">
        <span>●</span>
        <span>Indexing on subgraph…</span>
        <span className="text-white/50 text-xs">Elapsed: {elapsed}s</span>
      </div>
    );
  };

  return (
    <section className="mt-8">
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
                const nowMs = Date.now();

                const availableBase = r.nextClaimWindow ? r.nextClaimWindow.getTime() <= nowMs : true;

                const canClaim =
                  (pkg?.isActive ?? r.status === "Active") &&
                  r.status !== "Pending" &&
                  !r.isFullyUnstaked &&
                  (pkg?.monthlyAPRClaimable
                    ? (pkg?.claimableIntervalSec ?? 0) > 0 && availableBase
                    : (pkg?.durationInDays ?? 0) > 0 &&
                      (r.startDate?.getTime?.() ?? 0) + (pkg?.durationInDays ?? 0) * 86400 * 1000 <= nowMs);

                const canUnstake =
                  (pkg?.isActive ?? r.status === "Active") &&
                  r.status !== "Pending" &&
                  !r.isFullyUnstaked &&
                  !pkg?.principalLocked &&
                  (pkg?.monthlyUnstake
                    ? (pkg?.claimableIntervalSec ?? 0) > 0 &&
                      (r.startDate?.getTime?.() ?? 0) + (pkg?.claimableIntervalSec ?? 0) * 1000 <= nowMs
                    : (pkg?.durationInDays ?? 0) > 0 &&
                      (r.startDate?.getTime?.() ?? 0) + (pkg?.durationInDays ?? 0) * 86400 * 1000 <= nowMs);

                return (
                  <tr key={r.id} className={`transition-colors ${r.optimistic ? "bg-white/5" : "hover:bg-white/[0.03]"}`}>
                    <td className="px-5 py-4">{r.packageName}{r.optimistic ? " (pending)" : ""}</td>
                    <td className="px-5 py-4 tabular-nums">{r.amount}</td>
                    <td className="px-5 py-4 text-emerald-400">
                      {typeof r.aprPct === "number" ? `${r.aprPct.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-5 py-4" title={r.startDate?.toISOString?.()}>
                      {fmtDateTimeSeconds(r.startDate)}
                    </td>
                    <td className="px-5 py-4">
                      {r.status === "Pending"
                        ? renderPendingInfo(r)
                        : (
                          <div className="flex items-center gap-2 text-white/60">
                            <span>●</span>
                            <span>{fmtDateTime(r.nextClaimWindow)}</span>
                          </div>
                        )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 " +
                          (r.status === "Active"
                            ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20"
                            : r.status === "Pending"
                            ? "bg-white/10 text-white/70 ring-white/20"
                            : "bg-white/10 text-white/60 ring-white/15")
                        }
                      >
                        <span
                          className={
                            "h-1.5 w-1.5 rounded-full " +
                            (r.status === "Active"
                              ? "bg-emerald-400"
                              : r.status === "Pending"
                              ? "bg-white/50"
                              : "bg-white/30")
                          }
                        />
                        {r.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          disabled={!canClaim}
                          onClick={() => {}}
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
                          disabled={!canUnstake}
                          onClick={() => {}}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards — now also use tableRows (merged with optimistic) */}
      <div className="md:hidden -mx-4 px-4 mt-6 space-y-4">
        {tableRows.map((r) => {
          const pkg = r.pkgRules;
          const nowMs = Date.now();

          const availableBase = r.nextClaimWindow ? r.nextClaimWindow.getTime() <= nowMs : true;

          const canClaim =
            (pkg?.isActive ?? r.status === "Active") &&
            r.status !== "Pending" &&
            !r.isFullyUnstaked &&
            (pkg?.monthlyAPRClaimable
              ? (pkg?.claimableIntervalSec ?? 0) > 0 && availableBase
              : (pkg?.durationInDays ?? 0) > 0 &&
                (r.startDate?.getTime?.() ?? 0) + (pkg?.durationInDays ?? 0) * 86400 * 1000 <= nowMs);

          const canUnstake =
            (pkg?.isActive ?? r.status === "Active") &&
            r.status !== "Pending" &&
            !r.isFullyUnstaked &&
            !pkg?.principalLocked &&
            (pkg?.monthlyUnstake
              ? (pkg?.claimableIntervalSec ?? 0) > 0 &&
                (r.startDate?.getTime?.() ?? 0) + (pkg?.claimableIntervalSec ?? 0) * 1000 <= nowMs
              : (pkg?.durationInDays ?? 0) > 0 &&
                (r.startDate?.getTime?.() ?? 0) + (pkg?.durationInDays ?? 0) * 86400 * 1000 <= nowMs);

          // ---- Claimed vs Cap (display only) ----
          const aprBps = r.aprBps ?? r.pkgRules?.aprBps ?? 0;
          const total = r.totalStakedWei ?? 0n;
          const capWei = aprBps > 0 ? (total * BigInt(aprBps)) / 10000n : 0n;
          const claimed = r.claimedAprWei ?? 0n;
          const remaining = capWei > claimed ? capWei - claimed : 0n;
          const pct =
            capWei > 0n ? Math.min(100, Number((claimed * 10000n) / capWei) / 100) : 0;

          const started = r.txHash ? startedAtByTx[r.txHash] : undefined;
          const elapsed = r.status === "Pending" && started
            ? Math.max(0, Math.floor((Date.now() - started) / 1000))
            : 0;

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
                    : availableBase
                    ? "bg-gradient-to-r from-emerald-400 to-green-500"
                    : "bg-gradient-to-r from-sky-400 to-blue-500"
                }`}
              />

              <div className="flex justify-between items-center mb-2">
                <div className="text-white font-semibold">
                  {r.packageName}{r.optimistic ? " (pending)" : ""}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {r.status === "Pending" ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-white/50 inline-block" />
                      <span className="text-white/70">Indexing…</span>
                      <span className="text-white/50">({elapsed}s)</span>
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
                    {typeof r.aprPct === "number" ? `${r.aprPct.toFixed(2)}%` : "—"}
                  </span>
                </div>

                {r.status !== "Pending" ? (
                  availableBase ? (
                    <div className="mt-2 text-[13px] text-emerald-300">
                      Claimable now:{" "}
                      <span className="font-semibold text-emerald-200">up to {fmtYY(remaining)}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/60 mt-1">
                      ⏳ Next claim: {fmtDateTime(r.nextClaimWindow)}
                    </div>
                  )
                ) : null}

                {/* Progress: Claimed vs Cap */}
                {r.status !== "Pending" && (
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

              <div className="mt-4 flex gap-3">
                <motion.button
                  whileTap={canClaim ? { scale: 0.98 } : {}}
                  disabled={!canClaim}
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
                  disabled={!canUnstake}
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

              {/* success shimmer (only for claim/unstake, not pending) */}
              <AnimatePresence>{/* left intentionally empty here */}</AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default ActivePackages;
