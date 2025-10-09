// src/components/ReferralTabsSheetContent.tsx
import React, { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Users, Search, Filter, Link as LinkIcon, PieChart } from "lucide-react";
import { useReferralProfile, fmt } from "@/hooks/useReferralProfile";

type Props = { hasPreferredBadge: boolean; shareLink: string; tiles: { staked: string; referral: string; star: string; golden: string } };
const PAGE_SIZE = 12; const MAX_LEVEL = 15;

export default function ReferralTabsSheetContent({ hasPreferredBadge, shareLink, tiles }: Props) {
  const { address } = useAccount();
  const { loading, decimals, levels } = useReferralProfile(
    hasPreferredBadge ? (address as `0x${string}`) : undefined,
    { ttlMs: 120_000, perLevel: 200 }
  );

  const [tab, setTab] = useState<"l1" | "all" | "stats">("l1");
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState<number>(1);
  const [query, setQuery] = useState(""); const [onlyNonEmpty, setOnlyNonEmpty] = useState(true);

  const levelMap = useMemo(() => {
    const m = new Map<number, { totalYY: bigint; rows: { addr: string; stakes: number; totalYY: bigint }[] }>();
    (levels ?? []).forEach((L) => m.set(L.level, { totalYY: L.totalYY, rows: L.rows }));
    if (!m.size) m.set(1, { totalYY: 0n, rows: [] });
    return m;
  }, [levels]);

  const ids = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const filtered = onlyNonEmpty ? ids.filter((i) => (levelMap.get(i)?.rows?.length ?? 0) > 0) : ids;
  const effective = levelMap.has(level) ? level : (filtered[0] ?? 1);

  const L1 = levelMap.get(1)!;
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
      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab("l1")}
          className={["px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1",
            tab === "l1" ? "bg-white/15 text-white" : "bg-white/5 text-gray-300"].join(" ")}
        ><LinkIcon className="w-3.5 h-3.5" /> Level 1</button>

        <button onClick={() => setTab("all")}
          className={["px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1",
            tab === "all" ? "bg-white/15 text-white" : "bg-white/5 text-gray-300"].join(" ")}
        ><Users className="w-3.5 h-3.5" /> All Levels</button>

        <button onClick={() => setTab("stats")}
          className={["px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1",
            tab === "stats" ? "bg-white/15 text-white" : "bg-white/5 text-gray-300"].join(" ")}
        ><PieChart className="w-3.5 h-3.5" /> Stats</button>
      </div>

      {/* Tab: Level 1 (link on top) */}
      {tab === "l1" && (
        <div className="rounded-xl border border-white/10 bg-[#0b1022]">
          <div className="px-3 py-3 border-b border-white/10 text-xs">
            <div className="text-gray-400 mb-1">Share Link</div>
            <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
              <span className="text-[11px] text-gray-300 font-mono truncate">{shareLink}</span>
            </div>
          </div>

          <div className="px-3 py-3 border-b border-white/10 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-300" /><div className="text-sm font-semibold text-white">Level 1</div>
            <div className="text-[11px] text-gray-400">{loading ? "…" : `${L1.rows.length} referees`}</div>
            <div className="ml-auto text-[11px] text-gray-400">
              <span className="mr-2">Total YY</span>
              <span className="font-mono font-semibold text-emerald-400 text-sm">{loading ? "…" : fmt(L1.totalYY, decimals?.yy)}</span>
            </div>
          </div>

          <div className="p-3 space-y-2 max-h-[50vh] overflow-auto">
            {!loading && L1.rows.length === 0 && <div className="text-[12px] text-gray-400">No referees at this level.</div>}
            {loading && <div className="text-[12px] text-gray-400">Loading…</div>}
            {!loading && L1.rows.slice(0, 50).map((r, i) => (
              <div key={`${r.addr}-${i}`} className="rounded-lg bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-200 truncate">{r.addr}</span>
                  <span className="text-[11px] text-gray-400">{r.stakes} stake{r.stakes === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-2 text-[11px] text-indigo-200">Total YY {fmt(r.totalYY, decimals?.yy)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: All levels */}
      {tab === "all" && (
        <>
          <div className="rounded-xl border border-white/10 bg-[#0f1424] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-white">Levels</div>
              <label className="flex items-center gap-1 text-[11px] text-gray-400 cursor-pointer select-none">
                <input type="checkbox" className="accent-indigo-500" checked={onlyNonEmpty}
                  onChange={(e) => { const v = e.target.checked; setOnlyNonEmpty(v);
                    if (v && !(levelMap.get(level)?.rows?.length ?? 0)) { const first = filtered[0]; if (first) { setLevel(first); setPage(1); }}}}
                />
                <Filter className="w-3.5 h-3.5" /> Non-empty
              </label>
            </div>
            <div className="grid grid-cols-5 gap-1 max-h-[35vh] overflow-auto pr-1">
              {filtered.map((lvl) => {
                const active = lvl === effective;
                const count = levelMap.get(lvl)?.rows?.length ?? 0;
                const sumYY = levelMap.get(lvl)?.totalYY ?? 0n;
                return (
                  <button key={lvl} onClick={() => { setLevel(lvl); setPage(1); }}
                    className={[
                      "rounded-lg px-2 py-1.5 border text-[11px] w-full text-left",
                      active ? "bg-white/15 border-white/20 text-white" : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-200",
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
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0b1022]">
            <div className="px-3 py-3 border-b border-white/10 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-300" />
              <div className="text-sm font-semibold text-white">Level {effective}</div>
              <div className="text-[11px] text-gray-400">{loading ? "…" : `${rows.length} referees`}</div>
              <div className="ml-auto flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400">
                  <span>Total YY</span>
                  <span className="font-mono font-semibold text-emerald-400 text-sm">{loading ? "…" : fmt(totalYY, decimals?.yy)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search address…"
                    className="bg-transparent outline-none text-xs text-gray-100 placeholder:text-gray-500 w-36 sm:w-60" />
                </div>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[40vh] overflow-auto">
              {loading && <div className="text-[12px] text-gray-400">Loading…</div>}
              {!loading && visible.length === 0 && <div className="text-[12px] text-gray-400">{rows.length === 0 ? "No referees at this level." : "No matches for your search."}</div>}
              {!loading && visible.map((r, i) => (
                <div key={`${r.addr}-${i}`} className="rounded-lg bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-200 truncate">{r.addr}</span>
                    <span className="text-[11px] text-gray-400">{r.stakes} stake{r.stakes === 1 ? "" : "s"}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-indigo-200">Total YY {fmt(r.totalYY, decimals?.yy)}</div>
                </div>
              ))}

              {rows.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-1 mt-1">
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 disabled:opacity-40"
                    onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>Prev</button>
                  <div className="text-[11px] text-gray-400">{safePage} / {totalPages}</div>
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-200 disabled:opacity-40"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Next</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tab: Stats */}
      {tab === "stats" && (
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Total Staked" value={tiles.staked} />
          <Tile label="Referral" value={tiles.referral} />
          <Tile label="Star" value={tiles.star} />
          <Tile label="Golden" value={tiles.golden} />
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 bg-white/5 border border-white/10">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="mt-1 text-base font-bold text-white">{value}</div>
    </div>
  );
}
