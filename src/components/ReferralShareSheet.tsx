// src/components/ReferralShareSheet.tsx
import React, { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Gift, Copy, Check, Users, Filter, Search, Wallet, Award, Star, Crown, RefreshCw, X } from "lucide-react";
import { useReferralProfile, fmt } from "@/hooks/useReferralProfile";

type Props = {
  hasPreferredBadge: boolean;           // hide completely if false
  useBottomSheet?: boolean;             // default true
  open?: boolean; onOpenChange?: (b: boolean) => void;
  placeholderTotals?: { referral?: string; star?: string; golden?: string };
  className?: string;
};

const PAGE_SIZE = 12; const MAX_LEVEL = 15;

const SkeletonBar = ({ className = "" }: { className?: string }) => (
  <div className={`h-3 w-full rounded bg-white/10 relative overflow-hidden ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
  </div>
);

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand("copy"); document.body.removeChild(ta); return true;
  } catch { return false; }
}

export default function ReferralShareSheet({
  hasPreferredBadge,
  useBottomSheet = true,
  open, onOpenChange,
  placeholderTotals = { referral: "—", star: "—", golden: "—" },
  className,
}: Props) {
  if (!hasPreferredBadge) return null; // do not mount when not eligible

  const isCtrl = typeof open === "boolean";
  const [localOpen, setLocalOpen] = useState(false);
  const sheetOpen = isCtrl ? (open as boolean) : localOpen;
  const setOpen = (b: boolean) => (isCtrl ? onOpenChange?.(b) : setLocalOpen(b));

  const { address } = useAccount();
  const { loading, error, decimals, myTotalYY, levels, invalidate } = useReferralProfile(address as `0x${string}`, {
    ttlMs: 120_000, perLevel: 200,
  });

  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState<number>(1);
  const [query, setQuery] = useState("");
  const [onlyNonEmpty, setOnlyNonEmpty] = useState(true);

  const levelMap = useMemo(() => {
    const m = new Map<number, { totalYY: bigint; rows: { addr: string; stakes: number; totalYY: bigint }[] }>();
    (levels ?? []).forEach((L) => m.set(L.level, { totalYY: L.totalYY, rows: L.rows }));
    if (!m.size) m.set(1, { totalYY: 0n, rows: [] });
    return m;
  }, [levels]);

  const ids = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const filtered = onlyNonEmpty ? ids.filter((i) => (levelMap.get(i)?.rows?.length ?? 0) > 0) : ids;
  const effective = levelMap.has(level) ? level : (filtered[0] ?? 1);

  const allRows = levelMap.get(effective)?.rows ?? [];
  const rows = query.trim() ? allRows.filter((r) => r.addr.toLowerCase().includes(query.trim().toLowerCase())) : allRows;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);
  const totalYY = levelMap.get(effective)?.totalYY ?? 0n;

  const link = typeof window !== "undefined" ? `${window.location.origin}/ref/${address ?? ""}` : "";
  const isMobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : true;

  const onCopy = async () => { if (!link) return; const ok = await copyToClipboard(link); setCopied(ok); setTimeout(() => setCopied(false), 1200); };
  const refresh = () => { invalidate(); setOnlyNonEmpty((v) => !v); setTimeout(() => setOnlyNonEmpty((v) => !v), 0); };

  const Header = (
    <div className="flex items-center gap-3">
      <div className="shrink-0 rounded-xl p-2 bg-gradient-to-br from-purple-500 to-blue-600">
        <Gift className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-white leading-tight">Referrals</h3>
        <p className="text-[11px] text-gray-400">Invite • Track 15 Levels • Share</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={refresh} className="rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
        {isMobile && useBottomSheet && (
          <button onClick={() => setOpen(true)} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-gradient-to-r from-purple-500 to-blue-600 text-white">
            Open
          </button>
        )}
      </div>
    </div>
  );

  const StatTiles = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
      <div className="rounded-xl p-3 bg-white/5 border border-white/10">
        <div className="text-[11px] text-gray-400 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Total Staked</div>
        <div className="mt-1 text-base sm:text-lg font-bold text-white">{loading ? <SkeletonBar className="h-5 w-20" /> : `${fmt(myTotalYY ?? 0n, decimals?.yy)} YY`}</div>
      </div>
      <div className="rounded-xl p-3 bg-white/5 border border-white/10">
        <div className="text-[11px] text-gray-400 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> Referral Earnings</div>
        <div className="mt-1 text-base sm:text-lg font-bold text-white">{placeholderTotals.referral}</div>
      </div>
      <div className="rounded-xl p-3 bg-white/5 border border-white/10">
        <div className="text-[11px] text-gray-400 flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Star Earnings</div>
        <div className="mt-1 text-base sm:text-lg font-bold text-white">{placeholderTotals.star}</div>
      </div>
      <div className="rounded-xl p-3 bg-white/5 border border-white/10">
        <div className="text-[11px] text-gray-400 flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> Golden Star</div>
        <div className="mt-1 text-base sm:text-lg font-bold text-white">{placeholderTotals.golden}</div>
      </div>
    </div>
  );

  const Body = (
    <>
      <div className="mt-3 rounded-xl bg-[#111834] border border-white/10 p-3">
        <div className="text-xs font-semibold text-white">Share Link</div>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#0b122a] px-2 py-1.5">
          <span className="text-[11px] text-gray-300 flex-1 min-w-0 font-mono">{link ? (link.length > 36 ? `${link.slice(0, 22)}…${link.slice(-10)}` : link) : "—"}</span>
          <button onClick={onCopy} className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold bg-gradient-to-r from-purple-500 to-blue-600 text-white">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid sm:grid-cols-[260px_1fr] gap-3">
        <aside className="rounded-xl border border-white/10 bg-[#0f1424] p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-white">Levels</div>
            <label className="flex items-center gap-1 text-[11px] text-gray-400 cursor-pointer select-none">
              <input type="checkbox" className="accent-indigo-500" checked={onlyNonEmpty}
                onChange={(e) => { const v = e.target.checked; setOnlyNonEmpty(v); if (v && !(levelMap.get(level)?.rows?.length ?? 0)) { const first = filtered[0]; if (first) { setLevel(first); setPage(1); }}}}
              />
              <Filter className="w-3.5 h-3.5" /> Non-empty
            </label>
          </div>

          <div className="grid grid-cols-5 sm:block gap-1 max-h-[40vh] sm:max-h-[50vh] overflow-auto pr-1">
            {filtered.map((lvl) => {
              const active = lvl === effective;
              const count = levelMap.get(lvl)?.rows?.length ?? 0;
              const sumYY = levelMap.get(lvl)?.totalYY ?? 0n;
              return (
                <button key={lvl} onClick={() => { setLevel(lvl); setPage(1); }}
                  className={[
                    "rounded-lg px-2 py-1.5 border text-[11px] w-full text-left",
                    active ? "bg-gradient-to-r from-purple-600/70 to-blue-600/70 border-white/20 text-white"
                          : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-200",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">L{lvl}</span>
                    <span className="text-[10px] text-gray-300">{count}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-indigo-200">YY {fmt(sumYY, decimals?.yy)}</div>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="text-[11px] text-gray-500">No levels</div>}
          </div>
        </aside>

        <main className="rounded-xl border border-white/10 bg-[#0b1022]">
          <div className="px-3 sm:px-4 py-3 border-b border-white/10 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-white"><Users className="w-4 h-4 text-blue-300" />
              <div className="text-sm font-semibold">Level {effective}</div>
              <div className="text-[11px] text-gray-400">{loading ? "…" : `${rows.length} referees`}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
                <span>Total YY</span>
                <span className="font-mono font-semibold text-emerald-400 text-sm">{loading ? "…" : fmt(totalYY, decimals?.yy)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                <Search className="w-4 h-4 text-gray-400" />
                <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search address…"
                  className="bg-transparent outline-none text-xs text-gray-100 placeholder:text-gray-500 w-36 sm:w-60"
                />
              </div>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:grid grid-cols-12 px-3 py-2 text-[11px] text-gray-400 bg-white/5">
            <div className="col-span-7">Address</div><div className="col-span-2 text-right">Stakes</div><div className="col-span-3 text-right">Total YY</div>
          </div>
          <div className="hidden sm:block max-h-[56vh] overflow-auto divide-y divide-white/5">
            {loading && (<div className="p-4"><SkeletonBar className="h-4 w-1/2 mb-2" /><SkeletonBar className="h-4 w-2/3 mb-2" /><SkeletonBar className="h-4 w-1/3" /></div>)}
            {!loading && visible.length === 0 && (<div className="px-4 py-6 text-sm text-gray-400">{rows.length === 0 ? "No referees at this level." : "No matches for your search."}</div>)}
            {!loading && visible.map((r, i) => (
              <div key={`${r.addr}-${i}`} className="grid grid-cols-12 px-3 py-2 text-xs">
                <div className="col-span-7 font-mono text-gray-200 truncate">{r.addr}</div>
                <div className="col-span-2 text-right text-gray-200">{r.stakes}</div>
                <div className="col-span-3 text-right text-indigo-200">{fmt(r.totalYY, decimals?.yy)}</div>
              </div>
            ))}
          </div>

          {/* Mobile list */}
          <div className="sm:hidden p-3 space-y-2 max-h-[55vh] overflow-auto">
            {loading && (<>
              <div className="rounded-lg bg-white/5 p-3"><SkeletonBar className="h-4 w-2/3 mb-2" /><SkeletonBar className="h-3 w-1/3" /></div>
              <div className="rounded-lg bg-white/5 p-3"><SkeletonBar className="h-4 w-1/2 mb-2" /><SkeletonBar className="h-3 w-2/5" /></div>
            </>)}
            {!loading && visible.length === 0 && (<div className="text-[12px] text-gray-400">{rows.length === 0 ? "No referees at this level." : "No matches for your search."}</div>)}
            {!loading && visible.map((r, i) => (
              <div key={`${r.addr}-${i}`} className="rounded-lg bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-200 truncate">{r.addr}</span>
                  <span className="text-[11px] text-gray-400">{r.stakes} stake{r.stakes === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-2 text-[11px] text-indigo-200">Total YY {fmt(r.totalYY, decimals?.yy)}</div>
              </div>
            ))}
            {!loading && rows.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-1 mt-2">
                <button className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 disabled:opacity-40"
                  onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Prev</button>
                <div className="text-[11px] text-gray-400">{safePage} / {totalPages}</div>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 disabled:opacity-40"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Next</button>
              </div>
            )}
          </div>
        </main>
      </div>
      {error && <div className="px-1 sm:px-0 py-3 text-xs text-rose-400">{String(error)}</div>}
    </>
  );

  return (
    <div className={className}>
      {/* header + (mobile) open button */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">{Header}</div>

      {/* desktop body */}
      {!isMobile || !useBottomSheet ? (<>{StatTiles}{Body}</>) : (
        <>
          {sheetOpen && (
            <>
              <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setOpen(false)} />
              <div className="fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl bg-[#0a0f21] border-t border-white/10 shadow-2xl" style={{ maxHeight: "85vh" }}>
                <div className="px-4 pt-3 pb-2 border-b border-white/10 flex items-center">
                  <div className="mx-auto h-1 w-12 rounded-full bg-white/15" />
                  <button className="ml-auto p-2 text-gray-300 hover:text-white" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
                </div>
                <div className="px-4 pb-4">
                  {StatTiles}
                  {Body}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
