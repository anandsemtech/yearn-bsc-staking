// src/components/ReferralSummaryCard.tsx
import React, { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Gift, RefreshCw, Wallet, Award, Star, Crown, Copy, Check, Users } from "lucide-react";
import { useReferralProfile, fmt } from "@/hooks/useReferralProfile";

type Props = {
  hasPreferredBadge: boolean;
  onOpenAllLevels: () => void;
  placeholders?: { referral?: string; star?: string; golden?: string };
  className?: string;
  maxPreview?: number;
};

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand("copy"); document.body.removeChild(ta);
    return true;
  } catch { return false; }
}

export default function ReferralSummaryCard({
  hasPreferredBadge,
  onOpenAllLevels,
  placeholders = { referral: "—", star: "—", golden: "—" },
  className,
  maxPreview = 6,
}: Props) {
  if (!hasPreferredBadge) return null;

  const { address } = useAccount();
  const { loading, decimals, myTotalYY, levels, invalidate } = useReferralProfile(address as `0x${string}`, {
    ttlMs: 120_000, perLevel: 120,
  });

  const levelMap = useMemo(() => {
    const m = new Map<number, { totalYY: bigint; rows: { addr: string; stakes: number; totalYY: bigint }[] }>();
    (levels ?? []).forEach((L) => m.set(L.level, { totalYY: L.totalYY, rows: L.rows }));
    return m;
  }, [levels]);

  const L1 = levelMap.get(1) ?? { totalYY: 0n, rows: [] };
  const preview = L1.rows.slice(0, maxPreview);
  const link = typeof window !== "undefined" ? `${window.location.origin}/ref/${address ?? ""}` : "";
  const [copied, setCopied] = useState(false);

  return (
    <div className={["rounded-2xl p-4 sm:p-5 bg-white/5 border border-white/10", className || ""].join(" ")}>
      {/* header */}
      <div className="flex items-center gap-3">
        <div className="shrink-0 rounded-xl p-2 bg-gradient-to-br from-purple-500 to-blue-600">
          <Gift className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white leading-tight">Referrals</h3>
          <p className="text-[11px] text-gray-400">Invite • Track 15 Levels • Share</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => invalidate()}
            className="rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 bg-white/5 hover:bg-white/10 inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={onOpenAllLevels}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-gradient-to-r from-purple-500 to-blue-600 text-white"
          >
            Open
          </button>
        </div>
      </div>

      {/* 4 tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
          <div className="text-[11px] text-gray-400 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Total Staked</div>
          <div className="mt-1 text-base sm:text-lg font-bold text-white">{loading ? "…" : `${fmt(myTotalYY ?? 0n, decimals?.yy)} YY`}</div>
        </div>
        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
          <div className="text-[11px] text-gray-400 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> Referral</div>
          <div className="mt-1 text-base sm:text-lg font-bold text-white">{placeholders.referral}</div>
        </div>
        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
          <div className="text-[11px] text-gray-400 flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Star</div>
          <div className="mt-1 text-base sm:text-lg font-bold text-white">{placeholders.star}</div>
        </div>
        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
          <div className="text-[11px] text-gray-400 flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> Golden</div>
          <div className="mt-1 text-base sm:text-lg font-bold text-white">{placeholders.golden}</div>
        </div>
      </div>

      {/* Level 1 + Share link */}
      <div className="mt-4 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-3 sm:px-4 py-3 bg-[#0b122a] border-b border-white/10 flex items-center gap-2">
          <div className="text-xs font-semibold text-white flex-1">Share Link</div>
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
            <span className="text-[11px] text-gray-300 font-mono truncate max-w-[42vw] sm:max-w-none">
              {link ? (link.length > 36 ? `${link.slice(0, 22)}…${link.slice(-10)}` : link) : "—"}
            </span>
            <button
              onClick={async () => { const ok = await copy(link); setCopied(ok); setTimeout(() => setCopied(false), 1200); }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold bg-gradient-to-r from-purple-500 to-blue-600 text-white"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="px-3 sm:px-4 py-3 bg-[#0b1022] border-b border-white/10 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-300" />
          <div className="text-sm font-semibold text-white">Level 1</div>
          <div className="text-[11px] text-gray-400">{loading ? "…" : `${L1.rows.length} referees`}</div>
          <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
            <span>Total YY</span>
            <span className="font-mono font-semibold text-emerald-400 text-sm">{loading ? "…" : fmt(L1.totalYY, decimals?.yy)}</span>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-[#0b1022]">
          {loading && <div className="text-[12px] text-gray-400">Loading…</div>}
          {!loading && preview.length === 0 && <div className="text-[12px] text-gray-400">No referees at this level.</div>}
          {!loading && preview.length > 0 && (
            <div className="space-y-2 sm:hidden">
              {preview.map((r, i) => (
                <div key={`${r.addr}-${i}`} className="rounded-lg bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-200 truncate">{r.addr}</span>
                    <span className="text-[11px] text-gray-400">{r.stakes} stake{r.stakes === 1 ? "" : "s"}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-indigo-200">Total YY {fmt(r.totalYY, decimals?.yy)}</div>
                </div>
              ))}
            </div>
          )}

          {!loading && preview.length > 0 && (
            <div className="hidden sm:block">
              <div className="grid grid-cols-12 px-3 py-2 text-[11px] text-gray-400 bg-white/5 rounded-t-lg">
                <div className="col-span-7">Address</div><div className="col-span-2 text-right">Stakes</div><div className="col-span-3 text-right">Total YY</div>
              </div>
              <div className="rounded-b-lg overflow-hidden divide-y divide-white/5">
                {preview.map((r, i) => (
                  <div key={`${r.addr}-${i}`} className="grid grid-cols-12 px-3 py-2 text-xs">
                    <div className="col-span-7 font-mono text-gray-200 truncate">{r.addr}</div>
                    <div className="col-span-2 text-right text-gray-200">{r.stakes}</div>
                    <div className="col-span-3 text-right text-indigo-200">{fmt(r.totalYY, decimals?.yy)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <button onClick={onOpenAllLevels} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white">
              View all 15 levels
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
