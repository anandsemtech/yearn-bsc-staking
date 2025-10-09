// src/components/ReferralClaimsSheetContent.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Award, Star, TrendingUp, Zap, RefreshCcw, Clock } from "lucide-react";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { bsc } from "viem/chains";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

import { useEarningsSG } from "@/hooks/useEarningsSG";
import { STAKING_ABI } from "@/web3/abi/stakingAbi";

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
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dense: boolean;
}) => (
  <button
    onClick={onClick}
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
  const dense = variant === "sheet"; // sheet = tighter font, taller hit targets, bigger gaps
  const padBlock = dense ? "space-y-5" : "space-y-6";

  const { address } = useAccount();
  const chainId = useChainId();
  const REQUIRED = bsc.id;

  const pc = usePublicClient({ chainId: bsc.id });
  const { writeContractAsync, data: txHash, isPending: writing } = useWriteContract();
  const { isLoading: confirming, isSuccess: okTx } = useWaitForTransactionReceipt({ hash: txHash });

  const { totals, loading: sgLoading, coolingDown, refetch, refetchAfterMutation } = useEarningsSG(address);

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

  const txBusy = writing || confirming;
  const busy = sgLoading || coolingDown;

  const canReferral =
    !!address && chainId === REQUIRED && (totals.availSum ?? 0n) > 0n && !txBusy;
  const canStar = !!address && chainId === REQUIRED && currentStarLevelEarnings > 0 && !txBusy;
  const canGolden = !!address && chainId === REQUIRED && pendingGoldenStarRewards > 0 && !txBusy;

  // on-chain claims
  const onClaimReferral = async () => {
    setErr(null);
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
      await writeContractAsync({
        address: PROXY,
        abi: STAKING_ABI,
        functionName: "claimReferralRewards",
        chainId: bsc.id,
        args: [],
      });
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || "Claim failed");
    }
  };

  const onClaimStar = async () => {
    setErr(null);
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
      await writeContractAsync({
        address: PROXY,
        abi: STAKING_ABI,
        functionName: "claimStarLevelRewards",
        chainId: bsc.id,
        args: [],
      });
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || "Claim failed");
    }
  };

  const onClaimGolden = async () => {
    setErr(null);
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
      await writeContractAsync({
        address: PROXY,
        abi: STAKING_ABI,
        functionName: "claimGoldenStarRewards",
        chainId: bsc.id,
        args: [],
      });
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || "Claim failed");
    }
  };

  useEffect(() => {
    if (okTx) void refetchAfterMutation();
  }, [okTx, refetchAfterMutation]);

  return (
    <div className={padBlock}>
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className={dense ? "text-sm font-semibold text-white" : "text-base font-semibold text-white"}>
          My Claims
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={busy}
            className={[
              "inline-flex items-center gap-2 rounded-lg border transition",
              dense ? "px-3 py-1.5 text-[11px]" : "px-3.5 py-2 text-[12px]",
              busy ? "opacity-60 cursor-not-allowed border-white/10 text-gray-400"
                   : "border-white/15 hover:bg-white/5 text-white",
            ].join(" ")}
          >
            <RefreshCcw className={"h-4 w-4 " + (sgLoading ? "animate-spin" : "")} />
            {busy ? "Cooling down…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <TabBtn active={tab === "referral"} onClick={() => setTab("referral")} dense={dense}>
          <TrendingUp className="w-4.5 h-4.5 text-blue-300" /> Referral
        </TabBtn>
        <TabBtn active={tab === "star"} onClick={() => setTab("star")} dense={dense}>
          <Star className="w-4.5 h-4.5 text-purple-300" /> Star
        </TabBtn>
        <TabBtn active={tab === "golden"} onClick={() => setTab("golden")} dense={dense}>
          <Award className="w-4.5 h-4.5 text-amber-300" /> Golden
        </TabBtn>
      </div>

      {/* Referral */}
      {tab === "referral" && (
        <section className={dense ? "space-y-4" : "space-y-5"}>
          <div className="flex flex-wrap items-center gap-2">
            <StatChip label="Lifetime (Referral)" value={referralLifetime.toLocaleString()} dense={dense} />
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-300">
              <Clock className="w-3.5 h-3.5 text-gray-400" /> Available now
            </span>
            <span className="ml-auto" />
            <StatChip label="YY" value={yy.toLocaleString()} dense={dense} />
            <StatChip label="SY" value={sy.toLocaleString()} dense={dense} />
            <StatChip label="PY" value={py.toLocaleString()} dense={dense} />
            <StatChip label="Total Available" value={referralAvailable.toLocaleString()} dense={dense} />
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
            {txBusy ? (
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
            {txBusy ? (
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
            {txBusy ? (
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
