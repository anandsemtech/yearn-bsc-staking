// src/components/ReferralClaimsSheetContent.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Award, Star, TrendingUp, Zap, RefreshCcw, Clock } from "lucide-react";
import type { Address, Hex } from "viem";

import { formatUnits } from "viem";
import { bsc } from "viem/chains";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

import { useEarningsStable } from "@/hooks/useEarningsStable";
import { STAKING_ABI } from "@/web3/abi/stakingAbi";
import { openTxOverlay } from "@/lib/txOverlay";

const PROXY =
  (import.meta.env.VITE_BASE_CONTRACT_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as const);

type Variant = "sheet" | "web";

type Props = {
  currentStarLevelEarnings?: number;
  pendingGoldenStarRewards?: number;
  variant?: Variant; // default "sheet"
};

type TabKey = "referral" | "star" | "golden";

const TabBtn = ({
  active,
  onClick,
  children,
  dense,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dense: boolean;
  ariaLabel?: string;
}) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    className={[
      dense ? "px-3 py-2" : "px-4 py-2.5",
      "rounded-xl text-[12px] font-semibold inline-flex items-center gap-2 transition-colors",
      active ? "bg-white/15 text-white" : "bg-white/8 text-gray-200 hover:bg-white/12",
    ].join(" ")}
  >
    {children}
  </button>
);

const StatChip = ({
  label,
  value,
  dense,
}: {
  label: string;
  value: string;
  dense: boolean;
}) => (
  <span
    className={[
      "inline-flex items-center gap-2 rounded-full bg-white/8 ring-1 ring-white/10 text-gray-200",
      dense ? "px-3 py-1 text-[11px]" : "px-3.5 py-1.5 text-[12px]",
    ].join(" ")}
  >
    <span className={dense ? "text-[10px] text-gray-400" : "text-[11px] text-gray-400"}>
      {label}
    </span>
    <span className="font-semibold">{value}</span>
  </span>
);

export default function ReferralClaimsSheetContent({
  currentStarLevelEarnings = 0,
  pendingGoldenStarRewards = 0,
  variant = "sheet",
}: Props) {
  const dense = variant === "sheet";
  const padBlock = dense ? "space-y-5" : "space-y-6";

  const { address } = useAccount();
  const chainId = useChainId();
  const REQUIRED = bsc.id;

  const pc = usePublicClient({ chainId: bsc.id });
  const { writeContractAsync, data: txHash, isPending: writing } = useWriteContract();
  const { isLoading: confirming, isSuccess: okTx } = useWaitForTransactionReceipt({ hash: txHash });

  const { totals, loading: rpcLoading, coolingDown, refetch, refetchAfterMutation } =
    useEarningsStable(address);

  const referralAvailable = useMemo(
    () => Number(formatUnits(totals.availSum ?? 0n, 18)),
    [totals.availSum]
  );
  const referralLifetime = useMemo(
    () => Number(formatUnits(totals.lifeSum ?? 0n, 18)),
    [totals.lifeSum]
  );
  const yy = useMemo(() => Number(formatUnits(totals.availY ?? 0n, 18)), [totals.availY]);
  const sy = useMemo(() => Number(formatUnits(totals.availS ?? 0n, 18)), [totals.availS]);
  const py = useMemo(() => Number(formatUnits(totals.availP ?? 0n, 18)), [totals.availP]);

  const [tab, setTab] = useState<TabKey>("referral");
  const [err, setErr] = useState<string | null>(null);

  // --- Optimistic locks (per section) ---
  const [lockReferral, setLockReferral] = useState(false);
  const [lockStar, setLockStar] = useState(false);
  const [lockGolden, setLockGolden] = useState(false);
  const [lastAction, setLastAction] = useState<TabKey | null>(null);

  const txBusy = writing || confirming;
  const busy = rpcLoading || coolingDown;

  const canReferral =
    !!address &&
    chainId === REQUIRED &&
    (totals.availSum ?? 0n) > 0n &&
    !txBusy &&
    !lockReferral;
  const canStar =
    !!address &&
    chainId === REQUIRED &&
    currentStarLevelEarnings > 0 &&
    !txBusy &&
    !lockStar;
  const canGolden =
    !!address &&
    chainId === REQUIRED &&
    pendingGoldenStarRewards > 0 &&
    !txBusy &&
    !lockGolden;

  const isUserRejected = (e: any) => {
    const msg = (e?.shortMessage || e?.message || "").toLowerCase();
    return e?.code === 4001 || /user rejected/i.test(msg) || /rejected the request/i.test(msg);
  };

  // on-chain claims
  const onClaimReferral = async () => {
    setErr(null);
    setLockReferral(true);
    setLastAction("referral");
    try {
      if (!pc) throw new Error("No public client");
      await pc.simulateContract({
        address: PROXY,
        abi: STAKING_ABI,
        functionName: "claimReferralRewards",
        account: address as Address,
        chain: bsc,
        args: [],
      });
      const hash = (await writeContractAsync({
        address: PROXY,
        abi: STAKING_ABI,
        functionName: "claimReferralRewards",
        chainId: bsc.id,
        args: [],
      })) as Hex;

      openTxOverlay(hash, "Claiming referral rewards…", {
        doneEvent: "referral:claimed",
        successText: "Referral rewards claimed!",
        celebrateMs: 1800,
      });
    } catch (e: any) {
      if (isUserRejected(e)) {
        setLockReferral(false); // unlock on cancel
      } else {
        setLockReferral(false); // unlock on failure (so user can retry)
        setErr(e?.shortMessage || e?.message || "Claim failed");
      }
    }
  };

  const onClaimStar = async () => {
    setErr(null);
    setLockStar(true);
    setLastAction("star");
    try {
      if (!pc) throw new Error("No public client");
      await pc.simulateContract({
        address: PROXY,
        abi: STAKING_ABI,
        functionName: "claimStarLevelRewards",
        account: address as Address,
        chain: bsc,
        args: [],
      });
      const hash = (await writeContractAsync({
        address: PROXY,
        abi: STAKING_ABI,
        functionName: "claimStarLevelRewards",
        chainId: bsc.id,
        args: [],
      })) as Hex;

      openTxOverlay(hash, "Claiming star rewards…", {
        doneEvent: "star:claimed",
        successText: "Star rewards claimed!",
        celebrateMs: 1800,
      });
    } catch (e: any) {
      if (isUserRejected(e)) {
        setLockStar(false);
      } else {
        setLockStar(false);
        setErr(e?.shortMessage || e?.message || "Claim failed");
      }
    }
  };

  const onClaimGolden = async () => {
    setErr(null);
    setLockGolden(true);
    setLastAction("golden");
    try {
      if (!pc) throw new Error("No public client");
      await pc.simulateContract({
        address: PROXY,
        abi: STAKING_ABI,
        functionName: "claimGoldenStarRewards",
        account: address as Address,
        chain: bsc,
        args: [],
      });
      const hash = (await writeContractAsync({
        address: PROXY,
        abi: STAKING_ABI,
        functionName: "claimGoldenStarRewards",
        chainId: bsc.id,
        args: [],
      })) as Hex;

      openTxOverlay(hash, "Claiming golden rewards…", {
        doneEvent: "golden:claimed",
        successText: "Golden rewards claimed!",
        celebrateMs: 1800,
      });
    } catch (e: any) {
      if (isUserRejected(e)) {
        setLockGolden(false);
      } else {
        setLockGolden(false);
        setErr(e?.shortMessage || e?.message || "Claim failed");
      }
    }
  };

  // After tx success, keep the lock until refetchAfterMutation finishes.
  useEffect(() => {
    if (!okTx || !lastAction) return;
    let cancelled = false;
    (async () => {
      try {
        await refetchAfterMutation();
      } finally {
        if (cancelled) return;
        if (lastAction === "referral") setLockReferral(false);
        if (lastAction === "star") setLockStar(false);
        if (lastAction === "golden") setLockGolden(false);
        setLastAction(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [okTx, lastAction, refetchAfterMutation]);

  return (
    <div className={padBlock}>
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={busy}
            aria-label={busy ? "Cooling down…" : "Refresh"}
            title={busy ? "Cooling down…" : "Refresh"}
            className={[
              "inline-flex items-center rounded-lg border transition",
              "gap-0 sm:gap-2",
              dense ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-[12px]",
              busy
                ? "opacity-60 cursor-not-allowed border-white/10 text-gray-400"
                : "border-white/15 hover:bg-white/5 text-white",
            ].join(" ")}
          >
            <RefreshCcw className={"h-4 w-4 " + (rpcLoading ? "animate-spin" : "")} />
            <span className="hidden sm:inline">{busy ? "Cooling down…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabBtn
          active={tab === "referral"}
          onClick={() => setTab("referral")}
          dense={dense}
          ariaLabel="Referral"
        >
          <TrendingUp className="w-4.5 h-4.5 text-blue-300" />
          <span>Referral</span>
        </TabBtn>
        <TabBtn
          active={tab === "star"}
          onClick={() => setTab("star")}
          dense={dense}
          ariaLabel="Star"
        >
          <Star className="w-4.5 h-4.5 text-purple-300" />
          <span>Star</span>
        </TabBtn>
        <TabBtn
          active={tab === "golden"}
          onClick={() => setTab("golden")}
          dense={dense}
          ariaLabel="Golden"
        >
          <Award className="w-4.5 h-4.5 text-amber-300" />
          <span>Golden</span>
        </TabBtn>
      </div>

      {/* Referral */}
      {tab === "referral" && (
        <section className={dense ? "space-y-4" : "space-y-5"}>
          {/* New layout: left group + big Lifetime on right */}
          <div className="grid grid-cols-12 gap-3">
            {/* Left group */}
            <div className="col-span-12 sm:col-span-8 rounded-2xl bg-white/8 ring-1 ring-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-300">
                  <Clock className="w-3.5 h-3.5 text-gray-400" /> Available now
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatChip label="YY" value={yy.toLocaleString()} dense={dense} />
                <StatChip label="SY" value={sy.toLocaleString()} dense={dense} />
                <StatChip label="PY" value={py.toLocaleString()} dense={dense} />
                <StatChip
                  label="Total Available"
                  value={referralAvailable.toLocaleString()}
                  dense={dense}
                />
              </div>
            </div>

            {/* Right: Lifetime prominent */}
            <div className="col-span-12 sm:col-span-4 rounded-2xl bg-white/8 ring-1 ring-white/10 px-4 py-3">
              <div className="text-[12px] text-gray-300/90">Lifetime (Referral)</div>
              <div className="mt-1 text-[22px] sm:text-[26px] leading-tight font-extrabold text-white tabular-nums">
                {referralLifetime.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          <button
            onClick={onClaimReferral}
            disabled={!canReferral}
            className={[
              "w-full inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
              dense ? "px-4 py-2.75 text-[13px]" : "px-5 py-3 text-[14px]",
              canReferral ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                          : "bg-gray-700 text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            {txBusy || lockReferral ? (
              <>
                <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Claim {referralAvailable.toLocaleString()}
              </>
            )}
          </button>
        </section>
      )}

      {/* Star */}
      {tab === "star" && (
        <section className={dense ? "space-y-4" : "space-y-5"}>
          <div className="flex items-center gap-2">
            <StatChip label="Available (Star)" value={currentStarLevelEarnings.toLocaleString()} dense={dense} />
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-300">
              <Clock className="w-3.5 h-3.5 text-gray-400" /> {currentStarLevelEarnings > 0 ? "Available now" : "No earnings"}
            </span>
          </div>

          <div className="h-px bg-white/10" />

          <button
            onClick={onClaimStar}
            disabled={!canStar}
            className={[
              "w-full inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
              dense ? "px-4 py-2.75 text-[13px]" : "px-5 py-3 text-[14px]",
              canStar ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            {txBusy || lockStar ? (
              <>
                <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Claim {currentStarLevelEarnings.toLocaleString()}
              </>
            )}
          </button>
        </section>
      )}

      {/* Golden */}
      {tab === "golden" && (
        <section className={dense ? "space-y-4" : "space-y-5"}>
          <div className="flex items-center gap-2">
            <StatChip label="Available (Golden)" value={pendingGoldenStarRewards.toLocaleString()} dense={dense} />
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-300">
              <Clock className="w-3.5 h-3.5 text-gray-400" /> {pendingGoldenStarRewards > 0 ? "Available now" : "No earnings"}
            </span>
          </div>

          <div className="h-px bg-white/10" />

          <button
            onClick={onClaimGolden}
            disabled={!canGolden}
            className={[
              "w-full inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
              dense ? "px-4 py-2.75 text-[13px]" : "px-5 py-3 text-[14px]",
              canGolden ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-gray-700 text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            {txBusy || lockGolden ? (
              <>
                <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Claim {pendingGoldenStarRewards.toLocaleString()}
              </>
            )}
          </button>
        </section>
      )}

      {err && (
        <div className="rounded-xl bg-rose-900/10 border border-rose-700/40 px-3 py-2 text-sm text-rose-300">
          {err}
        </div>
      )}
    </div>
  );
}
