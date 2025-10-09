// src/components/ReferralSection.tsx
// Mobile: bottom sheet with tabs (Level 1 / All Levels / Stats)
// Desktop: inline, simple explorer (no sheet)

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import {
  Gift, RefreshCw, Wallet, Award, Star, Crown, Copy, Check,
  Users, Search, Filter, Link as LinkIcon, X, PieChart
} from "lucide-react";
import { useReferralProfile, fmt } from "@/hooks/useReferralProfile";

/* ============================================================
   Constants
============================================================ */
const MAX_LEVEL = 15;
const PAGE_SIZE = 12;

/* ============================================================
   Small helpers
============================================================ */
const useIsMobile = (bp = 640) => {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.innerWidth <= bp
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [bp]);
  return isMobile;
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

/** Unique helper name to avoid collisions anywhere in the file */
function computeFilteredIds(
  levelMap: Map<number, { totalYY: bigint; rows: any[] }>,
  onlyNonEmpty: boolean
) {
  const ids = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  return onlyNonEmpty
    ? ids.filter((i) => (levelMap.get(i)?.rows?.length ?? 0) > 0)
    : ids;
}

/* ============================================================
   Bottom sheet (mobile-only)
============================================================ */
function SheetPortal({
  open,
  onClose,
  children,
}: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/50 z-[2100]" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[2101] border-t border-white/10 rounded-t-2xl bg-[#0a0f21] shadow-2xl"
        style={{ maxHeight: "85vh" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 pt-3 pb-2 border-b border-white/10 flex items-center">
          <div className="mx-auto h-1 w-12 rounded-full bg-white/15" />
          <button className="ml-auto p-2 text-gray-300 hover:text-white" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: "calc(85vh - 44px)" }}>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ============================================================
   Public component
============================================================ */
type Props = {
  hasPreferredBadge: boolean; // if false, render nothing
  placeholders?: { referral?: string; star?: string; golden?: string };
  className?: string;
};

const ReferralSection: React.FC<Props> = ({
  hasPreferredBadge,
  placeholders = { referral: "—", star: "—", golden: "—" },
  className,
}) => {
  if (!hasPreferredBadge) return null;

  const isMobile = useIsMobile(640);
  const { address } = useAccount();

  // Light profile fetch for the card/preview
  const { loading, decimals, myTotalYY, levels, invalidate } = useReferralProfile(
    address as `0x${string}`,
    { ttlMs: 120_000, perLevel: 120 }
  );

  const levelMap = useMemo(() => {
    const m = new Map<number, { totalYY: bigint; rows: { addr: string; stakes: number; totalYY: bigint }[] }>();
    (levels ?? []).forEach((L) => m.set(L.level, { totalYY: L.totalYY, rows: L.rows }));
    return m;
  }, [levels]);

  const L1 = levelMap.get(1) ?? { totalYY: 0n, rows: [] };
  const link = typeof window !== "undefined" ? `${window.location.origin}/ref/${address ?? ""}` : "";
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Shared explorer state (used by desktop inline + mobile sheet)
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState<number>(1);
  const [query, setQuery] = useState("");
  const [onlyNonEmpty, setOnlyNonEmpty] = useState(true);

  const filteredIdsMain = computeFilteredIds(levelMap, onlyNonEmpty);
  const effectiveMain = levelMap.has(level) ? level : (filteredIdsMain[0] ?? 1);

  const qMain = query.trim().toLowerCase();
  const allRowsMain = levelMap.get(effectiveMain)?.rows ?? [];
  const rowsMain = qMain ? allRowsMain.filter((r) => r.addr.toLowerCase().includes(qMain)) : allRowsMain;

  const totalPagesMain = Math.max(1, Math.ceil(rowsMain.length / PAGE_SIZE));
  const safePageMain = Math.min(Math.max(page, 1), totalPagesMain);
  const startMain = (safePageMain - 1) * PAGE_SIZE;
  const visibleMain = rowsMain.slice(startMain, startMain + PAGE_SIZE);
  const totalYYMain = levelMap.get(effectiveMain)?.totalYY ?? 0n;

  return (
    <>
      {/* Summary Card (always visible) */}
      <div className={["rounded-2xl p-4 sm:p-5 bg-white/5 border border-white/10", className || ""].join(" ")}>
        {/* Header */}
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
            {isMobile && (
              <button
                onClick={() => setSheetOpen(true)}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold bg-gradient-to-r from-purple-500 to-blue-600 text-white"
              >
                Open
              </button>
            )}
          </div>
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
          <Tile icon={<Wallet className="w-3.5 h-3.5" />} label="Total Staked" value={loading ? "…" : `${fmt(myTotalYY ?? 0n, decimals?.yy)} YY`} />
          <Tile icon={<Award className="w-3.5 h-3.5" />} label="Referral" value={placeholders.referral ?? "—"} />
          <Tile icon={<Star className="w-3.5 h-3.5" />} label="Star" value={placeholders.star ?? "—"} />
          <Tile icon={<Crown className="w-3.5 h-3.5" />} label="Golden" value={placeholders.golden ?? "—"} />
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

          {/* Mobile preview (simple) */}
          <div className="p-3 sm:p-4 bg-[#0b1022]">
            {loading && <div className="text-[12px] text-gray-400">Loading…</div>}
            {!loading && L1.rows.length === 0 && <div className="text-[12px] text-gray-400">No referees at this level.</div>}
            {!loading && L1.rows.length > 0 && (
              <div className="space-y-2 sm:hidden">
                {L1.rows.slice(0, 6).map((r, i) => (
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

            {/* Desktop preview table */}
            {!loading && L1.rows.length > 0 && (
              <div className="hidden sm:block">
                <div className="grid grid-cols-12 px-3 py-2 text-[11px] text-gray-400 bg-white/5 rounded-t-lg">
                  <div className="col-span-7">Address</div>
                  <div className="col-span-2 text-right">Stakes</div>
                  <div className="col-span-3 text-right">Total YY</div>
                </div>
                <div className="rounded-b-lg overflow-hidden divide-y divide-white/5">
                  {L1.rows.slice(0, 8).map((r, i) => (
                    <div key={`${r.addr}-${i}`} className="grid grid-cols-12 px-3 py-2 text-xs">
                      <div className="col-span-7 font-mono text-gray-200 truncate">{r.addr}</div>
                      <div className="col-span-2 text-right text-gray-200">{r.stakes}</div>
                      <div className="col-span-3 text-right text-indigo-200">{fmt(r.totalYY, decimals?.yy)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Desktop-only: inline simple explorer */}
            {!isMobile && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] font-semibold px-3 py-1.5 inline-block rounded-lg bg-white/5 hover:bg-white/10 text-white select-none">
                  Explore all 15 levels
                </summary>

                <div className="mt-3 grid sm:grid-cols-[260px_1fr] gap-3">
                  {/* Level rail */}
                  <aside className="rounded-xl border border-white/10 bg-[#0f1424] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-white">Levels</div>
                      <label className="flex items-center gap-1 text-[11px] text-gray-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="accent-indigo-500"
                          checked={onlyNonEmpty}
                          onChange={(e) => {
                            const v = e.target.checked;
                            setOnlyNonEmpty(v);
                            if (v && !(levelMap.get(level)?.rows?.length ?? 0)) {
                              const first = computeFilteredIds(levelMap, v)[0];
                              if (first) { setLevel(first); setPage(1); }
                            }
                          }}
                        />
                        <Filter className="w-3.5 h-3.5" />
                        Non-empty
                      </label>
                    </div>

                    <div className="grid grid-cols-5 sm:block gap-1 max-h-[40vh] overflow-auto pr-1">
                      {filteredIdsMain.map((lvl) => {
                        const active = lvl === effectiveMain;
                        const count = levelMap.get(lvl)?.rows?.length ?? 0;
                        const sumYY = levelMap.get(lvl)?.totalYY ?? 0n;
                        return (
                          <button
                            key={lvl}
                            onClick={() => { setLevel(lvl); setPage(1); }}
                            className={[
                              "rounded-lg px-2 py-1.5 border text-[11px] w-full text-left",
                              active
                                ? "bg-gradient-to-r from-purple-600/70 to-blue-600/70 border-white/20 text-white"
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
                      {filteredIdsMain.length === 0 && <div className="text-[11px] text-gray-500">No levels</div>}
                    </div>
                  </aside>

                  {/* List */}
                  <main className="rounded-xl border border-white/10 bg-[#0b1022]">
                    <div className="px-3 sm:px-4 py-3 border-b border-white/10 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 text-white">
                        <Users className="w-4 h-4 text-blue-300" />
                        <div className="text-sm font-semibold">Level {effectiveMain}</div>
                        <div className="text-[11px] text-gray-400">{loading ? "…" : `${rowsMain.length} referees`}</div>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
                          <span>Total YY</span>
                          <span className="font-mono font-semibold text-emerald-400 text-sm">
                            {loading ? "…" : fmt(totalYYMain, decimals?.yy)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                          <Search className="w-4 h-4 text-gray-400" />
                          <input
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                            placeholder="Search address…"
                            className="bg-transparent outline-none text-xs text-gray-100 placeholder:text-gray-500 w-36 sm:w-60"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 space-y-2 max-h-[56vh] overflow-auto">
                      {loading && <div className="text-[12px] text-gray-400">Loading…</div>}
                      {!loading && visibleMain.length === 0 && (
                        <div className="text-[12px] text-gray-400">
                          {rowsMain.length === 0 ? "No referees at this level." : "No matches for your search."}
                        </div>
                      )}
                      {!loading && visibleMain.map((r, i) => (
                        <div key={`${r.addr}-${i}`} className="rounded-lg bg-white/5 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-gray-200 truncate">{r.addr}</span>
                            <span className="text-[11px] text-gray-400">{r.stakes} stake{r.stakes === 1 ? "" : "s"}</span>
                          </div>
                          <div className="mt-2 text-[11px] text-indigo-200">Total YY {fmt(r.totalYY, decimals?.yy)}</div>
                        </div>
                      ))}

                      {!loading && rowsMain.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-1 mt-2">
                          <button
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 disabled:opacity-40"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePageMain <= 1}
                          >
                            Prev
                          </button>
                          <div className="text-[11px] text-gray-400">{safePageMain} / {totalPagesMain}</div>
                          <button
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 disabled:opacity-40"
                            onClick={() => setPage((p) => Math.min(totalPagesMain, p + 1))}
                            disabled={safePageMain >= totalPagesMain}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  </main>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet (tabs) */}
      <SheetPortal open={sheetOpen && isMobile} onClose={() => setSheetOpen(false)}>
        <Tabs
          link={link}
          tiles={{
            staked: loading ? "…" : `${fmt(myTotalYY ?? 0n, decimals?.yy)} YY`,
            referral: placeholders.referral ?? "—",
            star: placeholders.star ?? "—",
            golden: placeholders.golden ?? "—",
          }}
          levelMap={levelMap}
          decimals={decimals?.yy ?? 18}
          page={page} setPage={setPage}
          level={level} setLevel={setLevel}
          query={query} setQuery={setQuery}
          onlyNonEmpty={onlyNonEmpty} setOnlyNonEmpty={setOnlyNonEmpty}
        />
      </SheetPortal>
    </>
  );
};

export default ReferralSection;

/* ============================================================
   Tiny pieces
============================================================ */
function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 bg-white/5 border border-white/10">
      <div className="text-[11px] text-gray-400 flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="mt-1 text-base sm:text-lg font-bold text-white">{value}</div>
    </div>
  );
}

/* ============================================================
   Tabs (mobile sheet content)
============================================================ */
function Tabs(props: {
  link: string;
  tiles: { staked: string; referral: string; star: string; golden: string };
  levelMap: Map<number, { totalYY: bigint; rows: { addr: string; stakes: number; totalYY: bigint }[] }>;
  decimals: number;
  page: number; setPage: (n: number) => void;
  level: number; setLevel: (n: number) => void;
  query: string; setQuery: (s: string) => void;
  onlyNonEmpty: boolean; setOnlyNonEmpty: (b: boolean) => void;
}) {
  const {
    link, tiles, levelMap, decimals,
    page, setPage, level, setLevel, query, setQuery, onlyNonEmpty, setOnlyNonEmpty
  } = props;

  const [tab, setTab] = useState<"l1" | "all" | "stats">("l1");

  const filteredIds = computeFilteredIds(levelMap, onlyNonEmpty);
  const effective = levelMap.has(level) ? level : (filteredIds[0] ?? 1);

  const L1 = levelMap.get(1) ?? { totalYY: 0n, rows: [] };
  const q = query.trim().toLowerCase();
  const allRows = levelMap.get(effective)?.rows ?? [];
  const rows = q ? allRows.filter((r) => r.addr.toLowerCase().includes(q)) : allRows;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);
  const totalYY = levelMap.get(effective)?.totalYY ?? 0n;

  return (
    <div className="space-y-3">
      {/* Tab header */}
      <div className="flex gap-2">
        <button onClick={() => setTab("l1")} className={tabBtnCls(tab === "l1")}>
          <LinkIcon className="w-3.5 h-3.5" /> Level 1
        </button>
        <button onClick={() => setTab("all")} className={tabBtnCls(tab === "all")}>
          <Users className="w-3.5 h-3.5" /> All Levels
        </button>
        <button onClick={() => setTab("stats")} className={tabBtnCls(tab === "stats")}>
          <PieChart className="w-3.5 h-3.5" /> Stats
        </button>
      </div>

      {/* Level 1 tab */}
      {tab === "l1" && (
        <div className="rounded-xl border border-white/10 bg-[#0b1022]">
          <div className="px-3 py-3 border-b border-white/10 text-xs">
            <div className="text-gray-400 mb-1">Share Link</div>
            <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
              <span className="text-[11px] text-gray-300 font-mono truncate">{link}</span>
            </div>
          </div>
          <div className="px-3 py-3 border-b border-white/10 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-300" />
            <div className="text-sm font-semibold text-white">Level 1</div>
            <div className="text-[11px] text-gray-400">{`${L1.rows.length} referees`}</div>
            <div className="ml-auto text-[11px] text-gray-400">
              <span className="mr-2">Total YY</span>
              <span className="font-mono font-semibold text-emerald-400 text-sm">{fmt(L1.totalYY, decimals)}</span>
            </div>
          </div>
          <div className="p-3 space-y-2 max-h-[50vh] overflow-auto">
            {L1.rows.length === 0 && <div className="text-[12px] text-gray-400">No referees at this level.</div>}
            {L1.rows.slice(0, 50).map((r, i) => (
              <div key={`${r.addr}-${i}`} className="rounded-lg bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-200 truncate">{r.addr}</span>
                  <span className="text-[11px] text-gray-400">{r.stakes} stake{r.stakes === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-2 text-[11px] text-indigo-200">Total YY {fmt(r.totalYY, decimals)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All levels tab */}
      {tab === "all" && (
        <>
          <div className="rounded-xl border border-white/10 bg-[#0f1424] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-white">Levels</div>
              <label className="flex items-center gap-1 text-[11px] text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-indigo-500"
                  checked={onlyNonEmpty}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setOnlyNonEmpty(v);
                    const nextIds = computeFilteredIds(levelMap, v);
                    if (v && !(levelMap.get(level)?.rows?.length ?? 0)) {
                      if (nextIds[0]) { setLevel(nextIds[0]); setPage(1); }
                    }
                  }}
                />
                <Filter className="w-3.5 h-3.5" /> Non-empty
              </label>
            </div>
            <div className="grid grid-cols-5 gap-1 max-h-[35vh] overflow-auto pr-1">
              {filteredIds.map((lvl) => {
                const active = lvl === effective;
                const count = levelMap.get(lvl)?.rows?.length ?? 0;
                const sumYY = levelMap.get(lvl)?.totalYY ?? 0n;
                return (
                  <button
                    key={lvl}
                    onClick={() => { setLevel(lvl); setPage(1); }}
                    className={[
                      "rounded-lg px-2 py-1.5 border text-[11px] w-full text-left",
                      active ? "bg-white/15 border-white/20 text-white" : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-200",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">L{lvl}</span>
                      <span className="text-[10px] text-gray-300">{count}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-indigo-200">YY {fmt(sumYY, decimals)}</div>
                  </button>
                );
              })}
              {filteredIds.length === 0 && <div className="text-[11px] text-gray-500">No levels</div>}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0b1022]">
            <div className="px-3 py-3 border-b border-white/10 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-300" />
              <div className="text-sm font-semibold text-white">Level {effective}</div>
              <div className="text-[11px] text-gray-400">{`${rows.length} referees`}</div>
              <div className="ml-auto flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
                  <span>Total YY</span>
                  <span className="font-mono font-semibold text-emerald-400 text-sm">{fmt(totalYY, decimals)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder="Search address…"
                    className="bg-transparent outline-none text-xs text-gray-100 placeholder:text-gray-500 w-36 sm:w-60"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[40vh] overflow-auto">
              {visible.length === 0 && (
                <div className="text-[12px] text-gray-400">
                  {rows.length === 0 ? "No referees at this level." : "No matches for your search."}
                </div>
              )}
              {visible.map((r, i) => (
                <div key={`${r.addr}-${i}`} className="rounded-lg bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-200 truncate">{r.addr}</span>
                    <span className="text-[11px] text-gray-400">{r.stakes} stake{r.stakes === 1 ? "" : "s"}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-indigo-200">Total YY {fmt(r.totalYY, decimals)}</div>
                </div>
              ))}

              {rows.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-1 mt-2">
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 disabled:opacity-40"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={safePage <= 1}
                  >
                    Prev
                  </button>
                  <div className="text-[11px] text-gray-400">{safePage} / {totalPages}</div>
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 disabled:opacity-40"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={safePage >= totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Stats tab */}
      {tab === "stats" && (
        <div className="grid grid-cols-2 gap-2">
          <Tile icon={<Wallet className="w-3.5 h-3.5" />} label="Total Staked" value={tiles.staked} />
          <Tile icon={<Award className="w-3.5 h-3.5" />} label="Referral" value={tiles.referral} />
          <Tile icon={<Star className="w-3.5 h-3.5" />} label="Star" value={tiles.star} />
          <Tile icon={<Crown className="w-3.5 h-3.5" />} label="Golden" value={tiles.golden} />
        </div>
      )}
    </div>
  );
}

function tabBtnCls(active: boolean) {
  return [
    "px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1",
    active ? "bg-white/15 text-white" : "bg-white/5 text-gray-300",
  ].join(" ");
}
