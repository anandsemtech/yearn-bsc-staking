// src/components/ReferralSection.tsx
// Mobile: AppKit-style bottom sheets (Levels / My Claims)
// Desktop: inline explorer (always open). Uses subgraph + RPC.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import {
  Gift, RefreshCw, Wallet, Award, Star as StarIcon, Crown, Copy, Check,
  Users, Search, Filter, Link as LinkIcon, X, PieChart
} from "lucide-react";
import { useReferralProfile, fmt } from "@/hooks/useReferralProfile";
import { useEarningsRPC } from "@/hooks/useEarningsRPC";
import ReferralClaimsSheetContent from "@/components/ReferralClaimsSheetContent";

/* ============================================================
   Constants
============================================================ */
const MAX_LEVEL = 15;
const PAGE_SIZE = 12;
// Vite env var (IMPORTANT)
const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_YEARN as string;

/* ============================================================
   Types for subgraph-based levels
============================================================ */
type Row = { addr: string; totalYY: bigint };
type LevelBucket = { level: number; rows: Row[]; totalYY: bigint };

type SGUserTotals = {
  starEarningsTotal: bigint;
  goldenEarningsTotal: bigint;
};

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

function computeFilteredIds(
  levelMap: Map<number, { totalYY: bigint; rows: Row[] }>,
  onlyNonEmpty: boolean
) {
  const ids = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  return onlyNonEmpty
    ? ids.filter((i) => (levelMap.get(i)?.rows?.length ?? 0) > 0)
    : ids;
}

/* ============================================================
   Subgraph hook: pull up to 15 levels + user earnings totals
============================================================ */
function useReferralLevelsFromSubgraph(
  address?: `0x${string}`,
  opts?: { maxLevels?: number; perLevel?: number }
) {
  const maxLevels = opts?.maxLevels ?? MAX_LEVEL;
  const perLevel = opts?.perLevel ?? 1000;

  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState<LevelBucket[]>([]);
  const [totals, setTotals] = useState<SGUserTotals>({ starEarningsTotal: 0n, goldenEarningsTotal: 0n });

  useEffect(() => {
    if (!address || !SUBGRAPH_URL) {
      setLevels([]);
      setTotals({ starEarningsTotal: 0n, goldenEarningsTotal: 0n });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const me = address.toLowerCase();

        const query = `
          query RefLevels($me: ID!, $first: Int!) {
            user(id: $me) {
              id
              starEarningsTotal
              goldenEarningsTotal
            }
            referralPaths(
              where: { ancestor: $me, depth_in: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] }
              first: $first
            ) {
              depth
              descendant { id totalStaked }
            }
          }`;

        const res = await fetch(SUBGRAPH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables: { me, first: perLevel } }),
        });
        const json = await res.json();

        const rows: Array<{ depth: number; descendant: { id: string; totalStaked: string } }> =
          json?.data?.referralPaths ?? [];

        const map = new Map<number, { rows: Row[]; totalYY: bigint }>();
        for (let d = 1; d <= maxLevels; d++) map.set(d, { rows: [], totalYY: 0n });

        for (const r of rows) {
          const d = r.depth;
          if (d < 1 || d > maxLevels) continue;
          const addr = (r.descendant?.id ?? "").toLowerCase();
          const total = BigInt(r.descendant?.totalStaked ?? "0");
          const bucket = map.get(d)!;
          bucket.rows.push({ addr, totalYY: total });
          bucket.totalYY += total;
        }

        const out: LevelBucket[] = Array.from({ length: maxLevels }, (_, i) => {
          const lvl = i + 1;
          const b = map.get(lvl)!;
          b.rows.sort((a, b) => (a.totalYY > b.totalYY ? -1 : a.totalYY < b.totalYY ? 1 : 0));
          return { level: lvl, rows: b.rows, totalYY: b.totalYY };
        });

        const u = json?.data?.user ?? null;
        const sgTotals: SGUserTotals = {
          starEarningsTotal: BigInt(u?.starEarningsTotal ?? "0"),
          goldenEarningsTotal: BigInt(u?.goldenEarningsTotal ?? "0"),
        };

        if (!cancelled) {
          setLevels(out);
          setTotals(sgTotals);
        }
      } catch (e) {
        console.error("useReferralLevelsFromSubgraph error:", e);
        if (!cancelled) {
          setLevels([]);
          setTotals({ starEarningsTotal: 0n, goldenEarningsTotal: 0n });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [address, perLevel, maxLevels]);

  return { loading, levels, totals };
}

/* ============================================================
   AppKit-style Bottom Sheet
   - Auto grows with content (ResizeObserver) up to `maxVh` then scrolls
============================================================ */
function SheetPortal({
  open,
  onClose,
  title,
  children,
  maxVh = 90,
  bottomGapPx = 28,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxVh?: number;
  bottomGapPx?: number;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const [pxHeight, setPxHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open || !bodyRef.current) return;

    const headerPx = 64; // header height

    const compute = () => {
      const node = bodyRef.current;
      if (!node || !node.isConnected) return;
      const content = node.scrollHeight;
      const desired = headerPx + content + bottomGapPx;
      const cap = Math.round((window.innerHeight || 0) * (maxVh / 100));
      setPxHeight(Math.min(desired, cap));
    };

    const scheduleCompute = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(compute);
    };

    scheduleCompute();

    const RO: any = (window as any).ResizeObserver;
    if (RO) {
      if (!roRef.current) {
        roRef.current = new RO(() => scheduleCompute());
      }
      if (bodyRef.current) roRef.current?.observe(bodyRef.current);
    }

    const onResize = () => scheduleCompute();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (roRef.current) {
        try { roRef.current.disconnect(); } catch {}
        roRef.current = null;
      }
    };
  }, [open, maxVh, bottomGapPx]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2100]" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-[2101] rounded-t-[24px] shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.55)]
                   border-t border-white/10
                   bg-[linear-gradient(180deg,rgba(34,38,54,0.95),rgba(21,24,38,0.98))]
                   text-white"
        style={{
          height: pxHeight ? `${pxHeight}px` : "85dvh",
          maxHeight: `calc(${maxVh}dvh + env(safe-area-inset-bottom, 0px))`,
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/10">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="justify-self-center h-1 w-12 rounded-full bg-white/20" aria-hidden="true" />
            <div className="justify-self-center text-base font-semibold">
              {title ?? ""}
            </div>
            <button
              className="justify-self-end p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body (scrolls when we hit the cap) */}
        <div
          ref={bodyRef}
          className="px-5 overflow-y-auto"
          style={{
            maxHeight: `calc(${maxVh}dvh - 64px - env(safe-area-inset-bottom, 0px))`,
            paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomGapPx}px)`,
          }}
        >
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ============================================================
   Desktop Modal (glass, centered) — for My Claims on web
============================================================ */
function DesktopModal({
  open,
  onClose,
  title,
  children,
  maxW = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxW?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[2100] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[2101] flex items-center justify-center p-4">
        <div
          className={[
            "w-full", maxW,
            "rounded-2xl border border-white/10 bg-[rgba(18,22,36,0.9)] backdrop-blur-xl",
            "shadow-[0_20px_80px_-20px_rgba(0,0,0,0.6)]"
          ].join(" ")}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <div className="text-sm font-semibold text-white">{title ?? "My Claims"}</div>
            <button
              onClick={onClose}
              className="ml-auto px-2 py-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            {children}
          </div>
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
  hasPreferredBadge: boolean;
  placeholders?: { referral?: string; star?: string; golden?: string };
  className?: string;
  onOpenClaims?: () => void;
};

const ReferralSection: React.FC<Props> = ({
  hasPreferredBadge,
  placeholders = { referral: "—", star: "—", golden: "—" },
  className,
  onOpenClaims,
}) => {
  const isMobile = useIsMobile(640);
  const { address } = useAccount();

  // Lifetime referral via RPC (Y token 18d)
  const { totals: rpcTotals, loading: rpcLoading } = useEarningsRPC(address || undefined);
  const lifetimeReferralStr = rpcLoading ? "…" : fmt(rpcTotals?.lifeSum ?? 0n, 18);

  const {
    loading: profileLoading,
    decimals,
    myTotalYY,
    invalidate
  } = useReferralProfile(
    (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    { ttlMs: 120_000 }
  );

  const { loading: levelsLoading, levels, totals } = useReferralLevelsFromSubgraph(
    (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    { maxLevels: 15, perLevel: 1000 }
  );

  const loading = profileLoading || levelsLoading;

  // map level -> rows/total
  const levelMap = useMemo(() => {
    const m = new Map<number, { totalYY: bigint; rows: Row[] }>();
    for (const L of levels) m.set(L.level, { totalYY: L.totalYY, rows: L.rows });
    return m;
  }, [levels]);

  const L1 = levelMap.get(1) ?? { totalYY: 0n, rows: [] };

  // SSR-safe link
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = origin && address ? `${origin}?ref=${address}` : "";

  const [sheetOpen, setSheetOpen] = useState(false);
  const [claimsOpen, setClaimsOpen] = useState(false);

  // Footer → open-sheet event bridge
  useEffect(() => {
    const openRefs = () => setSheetOpen(true);
    const openClaims = () => setClaimsOpen(true);
    window.addEventListener("referrals:open", openRefs);
    window.addEventListener("claims:open", openClaims);
    return () => {
      window.removeEventListener("referrals:open", openRefs);
      window.removeEventListener("claims:open", openClaims);
    };
  }, []);

  // Shared explorer state
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

  if (!hasPreferredBadge) return <></>;

  return (
    <>
      {/* Summary Card (always visible) */}
      <div
        className={[
          "rounded-2xl p-4 sm:p-5",
          "bg-[linear-gradient(180deg,rgba(36,40,58,0.65),rgba(20,24,40,0.7))] backdrop-blur",
          "border border-white/10 ring-1 ring-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.45)]",
          className || "",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-xl p-2.5 bg-gradient-to-br from-purple-500 to-blue-600">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold text-white leading-tight">Referrals</h3>
            <p className="text-[12px] text-gray-300/90">Invite • Track 15 Levels • Share</p>
          </div>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => invalidate()}
              aria-label="Refresh referrals"
              title="Refresh"
              className="rounded-xl px-2 py-2 sm:px-3 sm:py-2 text-[12px] text-gray-100 bg-white/10 hover:bg-white/15 inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => {
                setClaimsOpen(true);
                if (isMobile) setSheetOpen(false);
                onOpenClaims?.();
              }}
              className="rounded-xl px-3 py-2 text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              My Claims
            </button>
          </div>
        </div>

        {/* Tiles (Stats on the card) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3">
          <Tile icon={<Wallet className="w-4.5 h-4.5" />} label="Total Staked" value={loading ? "…" : `${fmt(myTotalYY ?? 0n, decimals?.yy)} YY`} />
          {/* Referral = lifetime referrals (RPC) */}
          <Tile icon={<Award className="w-4.5 h-4.5" />} label="Referral" value={lifetimeReferralStr} />
          <Tile icon={<StarIcon className="w-4.5 h-4.5" />} label="Star" value={loading ? "…" : fmt(totals.starEarningsTotal, 18)} />
          <Tile icon={<Crown className="w-4.5 h-4.5" />} label="Golden" value={loading ? "…" : fmt(totals.goldenEarningsTotal, 18)} />
        </div>

        {/* Level 1 + Share link */}
        <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden bg-[#141a2c]/70">
          <div className="px-3 sm:px-4 py-3 border-b border-white/10">
            <div className="text-xs font-semibold text-white mb-1 flex items-center gap-2">
              <LinkIcon className="w-4.5 h-4.5 text-indigo-300" />
              Share Link
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/8 px-2.5 py-2 ring-1 ring-white/10">
              <span className="text-[12px] text-gray-100/90 font-mono truncate flex-1" title={link || "—"}>
                {link || "—"}
              </span>
              <CopyIconButton text={link} />
            </div>
          </div>

          <div className="px-3 sm:px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-300" />
            <div className="text-[13px] font-semibold text-white">Level 1</div>
            <div className="text-[12px] text-gray-300/90">{loading ? "…" : `${L1.rows.length} referees`}</div>

            <div className="ml-auto flex items-center gap-2 text-[12px] text-gray-300/90">
              <span>Total YY</span>
              <span className="font-mono font-semibold text-emerald-300 text-[13px]">
                {loading ? "…" : fmt(L1.totalYY, decimals?.yy)}
              </span>
              {isMobile && (
                <button
                  onClick={() => setSheetOpen(true)}
                  className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold
                             bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow hover:opacity-95"
                >
                  All Levels
                </button>
              )}
            </div>
          </div>

          {/* Mobile preview (simple) */}
          <div className="p-3 sm:p-4">
            {loading && <div className="text-[12px] text-gray-300/90">Loading…</div>}
            {!loading && L1.rows.length === 0 && <div className="text-[12px] text-gray-300/90">No referees at this level.</div>}
            {!loading && L1.rows.length > 0 && (
              <div className="space-y-2 sm:hidden">
                {L1.rows.slice(0, 6).map((r, i) => (
                  <div key={`${r.addr}-${i}`} className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] text-gray-100 truncate">{r.addr}</span>
                      <div className="text-right">
                        <div className="text-[11px] text-gray-300/80 leading-none">Total YY</div>
                        <div className="font-mono text-[16px] font-bold text-emerald-300 leading-none">
                          {fmt(r.totalYY, decimals?.yy)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Desktop: inline explorer — ALWAYS OPEN */}
            {!isMobile && (
              <div className="mt-3 grid sm:grid-cols-[300px_1fr] gap-3">
                {/* Level rail (spacious rows) */}
                <aside className="rounded-2xl ring-1 ring-white/10 bg-[#151b2b]/80 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12px] font-semibold text-white">Levels</div>
                    <label className="flex items-center gap-1 text-[12px] text-gray-300/90 cursor-pointer select-none">
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
                      <Filter className="w-4 h-4" />
                      Non-empty
                    </label>
                  </div>

                  <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
                    {filteredIdsMain.map((lvl) => {
                      const active = lvl === effectiveMain;
                      const count = levelMap.get(lvl)?.rows?.length ?? 0;
                      const sumYY = levelMap.get(lvl)?.totalYY ?? 0n;
                      return (
                        <LevelRow
                          key={lvl}
                          lvl={lvl}
                          count={count}
                          sumYY={sumYY}
                          active={active}
                          decimals={decimals?.yy ?? 18}
                          onClick={() => { setLevel(lvl); setPage(1); }}
                        />
                      );
                    })}
                    {filteredIdsMain.length === 0 && <div className="text-[12px] text-gray-400">No levels</div>}
                  </div>
                </aside>

                {/* List */}
                <main className="rounded-2xl ring-1 ring-white/10 bg-[#13192a]/80">
                  <div className="px-3 sm:px-4 py-3 border-b border-white/10 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 text-white">
                      <Users className="w-5 h-5 text-blue-300" />
                      <div className="text-[13px] font-semibold">Level {effectiveMain}</div>
                      <div className="text-[12px] text-gray-300/90">{loading ? "…" : `${rowsMain.length} referees`}</div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="hidden sm:flex items-center gap-2 text-[12px] text-gray-300/90">
                        <span>Total YY</span>
                        <span className="font-mono font-semibold text-emerald-300 text-[13px]">
                          {loading ? "…" : fmt(totalYYMain, decimals?.yy)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-white/8 px-2.5 py-1.5 ring-1 ring-white/10">
                        <Search className="w-4.5 h-4.5 text-gray-300/90" />
                        <input
                          value={query}
                          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                          placeholder="Search address…"
                          className="bg-transparent outline-none text-[12px] text-gray-100 placeholder:text-gray-400 w-36 sm:w-60"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 space-y-2 max-h-[56vh] overflow-auto">
                    {loading && <div className="text-[12px] text-gray-300/90">Loading…</div>}
                    {!loading && visibleMain.length === 0 && (
                      <div className="text-[12px] text-gray-300/90">
                        {rowsMain.length === 0 ? "No referees at this level." : "No matches for your search."}
                      </div>
                    )}
                    {!loading && visibleMain.map((r, i) => (
                      <div key={`${r.addr}-${i}`} className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[12px] text-gray-100 truncate">{r.addr}</span>
                          <div className="text-right">
                            <div className="text-[11px] text-gray-300/80 leading-none">Total YY</div>
                            <div className="font-mono text-[16px] font-bold text-emerald-300 leading-none">
                              {fmt(r.totalYY, decimals?.yy)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {!loading && rowsMain.length > PAGE_SIZE && (
                      <div className="flex items-center justify-between px-1 mt-2">
                        <button
                          className="text-[12px] px-3 py-1.5 rounded-xl bg-white/8 text-gray-100 ring-1 ring-white/10 disabled:opacity-40"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={safePageMain <= 1}
                        >
                          Prev
                        </button>
                        <div className="text-[12px] text-gray-300/90">{safePageMain} / {totalPagesMain}</div>
                        <button
                          className="text-[12px] px-3 py-1.5 rounded-xl bg-white/8 text-gray-100 ring-1 ring-white/10 disabled:opacity-40"
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
            )}
          </div>
        </div>
      </div>

      {/* Referrals (Levels) bottom sheet — mobile ONLY */}
      <SheetPortal
        open={sheetOpen && isMobile}
        onClose={() => setSheetOpen(false)}
        title="Referrals"
        maxVh={90}
        bottomGapPx={28}
      >
        <Tabs
          link={link}
          tiles={{
            staked: loading ? "…" : `${fmt(myTotalYY ?? 0n, decimals?.yy)} YY`,
            referral: lifetimeReferralStr,
            star: loading ? "…" : fmt(totals.starEarningsTotal, 18),
            golden: loading ? "…" : fmt(totals.goldenEarningsTotal, 18),
            lifetimeReferral: lifetimeReferralStr,
          }}
          levelMap={levelMap}
          decimals={decimals?.yy ?? 18}
          page={page} setPage={setPage}
          level={level} setLevel={setLevel}
          query={query} setQuery={setQuery}
          onlyNonEmpty={onlyNonEmpty} setOnlyNonEmpty={setOnlyNonEmpty}
        />
      </SheetPortal>

      {/* My Claims — keep both variants mounted; gate with `open` */}
      <SheetPortal
        open={claimsOpen && isMobile}
        onClose={() => setClaimsOpen(false)}
        title="My Claims"
        maxVh={92}
        bottomGapPx={32}
      >
        <ReferralClaimsSheetContent />
      </SheetPortal>

      <DesktopModal
        open={claimsOpen && !isMobile}
        onClose={() => setClaimsOpen(false)}
        title="My Claims"
        maxW="max-w-xl"
      >
        <ReferralClaimsSheetContent />
      </DesktopModal>
    </>
  );
};

/* ============================================================
   Tiny helper component: Tile
============================================================ */
function Tile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl p-3 sm:p-3.5 bg-white/8 ring-1 ring-white/10">
      <div className="text-[12px] text-gray-300/90 flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[16px] sm:text-[18px] font-bold text-white">
        {value}
      </div>
    </div>
  );
}

/* ===== Icon-only copy with instant feedback ===== */
function CopyIconButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(text);
      if (navigator.vibrate) navigator.vibrate(10);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand?.("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }

  return (
    <div
      className={`relative inline-flex ${className || ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={doCopy}
        aria-label={copied ? "Copied!" : "Copy to clipboard"}
        className={[
          "group rounded-xl p-2 ring-1 ring-white/10 bg-white/10 hover:bg-white/15",
          "text-white transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        ].join(" ")}
      >
        <span className="inline-flex items-center justify-center w-5 h-5">
          {copied ? (
            <Check className="w-5 h-5 text-emerald-300" />
          ) : (
            <Copy className="w-5 h-5" />
          )}
        </span>
      </button>

      {(hover || copied) && (
        <div
          className={[
            "absolute -top-7 right-0 px-2 py-1 rounded-md text-[11px] leading-none",
            "bg-black/70 text-white backdrop-blur ring-1 ring-white/10",
            "pointer-events-none select-none",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          {copied ? "Copied!" : "Copy"}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LevelRow — spacious, readable level pill
============================================================ */
function LevelRow({
  lvl, count, sumYY, active, onClick, decimals,
}: {
  lvl: number;
  count: number;
  sumYY: bigint;
  active?: boolean;
  onClick?: () => void;
  decimals: number;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full rounded-2xl px-3.5 py-3 ring-1 text-left flex items-center gap-3",
        active
          ? "bg-gradient-to-r from-purple-600/60 to-blue-600/60 ring-white/20"
          : "bg-white/8 hover:bg-white/12 ring-white/10",
      ].join(" ")}
    >
      <div className="shrink-0 rounded-xl w-9 h-9 flex items-center justify-center
                      bg-white/10 font-semibold text-white">
        L{lvl}
      </div>

      <div className="min-w-0">
        <div className="text-[13px] text-white font-semibold">Level {lvl}</div>
        <div className="text-[12px] text-gray-300/90">
          {count} referees • YY {fmt(sumYY, decimals)}
        </div>
      </div>

      <div className="ml-auto text-right">
        <div className="text-[11px] text-gray-300/80 uppercase tracking-wide">Total YY</div>
        <div className="font-mono text-[16px] sm:text-[18px] font-bold text-emerald-300 leading-none">
          {fmt(sumYY, decimals)}
        </div>
      </div>
    </button>
  );
}

/* ============================================================
   Tabs (mobile sheet content)
============================================================ */
function Tabs(props: {
  link: string;
  tiles: { staked: string; referral: string; star: string; golden: string; lifetimeReferral: string };
  levelMap: Map<number, { totalYY: bigint; rows: Row[] }>;
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
    <div className="space-y-4">
      {/* Tab header */}
      <div className="mt-3 flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 scroll-px-5 snap-x snap-mandatory">
        <button onClick={() => setTab("l1")} className={tabBtnCls(tab === "l1")}>
          <LinkIcon className="w-4.5 h-4.5" /> Level 1
        </button>
        <button onClick={() => setTab("all")} className={tabBtnCls(tab === "all")}>
          <Users className="w-4.5 h-4.5" /> All Levels
        </button>
        <button onClick={() => setTab("stats")} className={tabBtnCls(tab === "stats")}>
          <PieChart className="w-4.5 h-4.5" /> Stats
        </button>
      </div>

      {/* Level 1 tab */}
      {tab === "l1" && (
        <div className="rounded-2xl ring-1 ring-white/10 bg-[#151b2b]/80">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="text-[12px] text-gray-300/90 mb-1">Share Link</div>
            <div className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 ring-1 ring-white/10">
              <span className="text-[12px] text-gray-100 font-mono truncate" title={link}>{link}</span>
              <CopyIconButton text={link} />
            </div>
          </div>
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-300" />
            <div className="text-[13px] font-semibold text-white">Level 1</div>
            <div className="text-[12px] text-gray-300/90">{`${L1.rows.length} referees`}</div>
            <div className="ml-auto text-[12px] text-gray-300/90">
              <span className="mr-2">Total YY</span>
              <span className="font-mono font-semibold text-emerald-300 text-[13px]">{fmt(L1.totalYY, decimals)}</span>
            </div>
          </div>
          <div className="p-3 space-y-2 max-h-[50vh] overflow-auto">
            {L1.rows.length === 0 && <div className="text-[12px] text-gray-300/90">No referees at this level.</div>}
            {L1.rows.slice(0, 60).map((r, i) => (
              <div key={`${r.addr}-${i}`} className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[12px] text-gray-100 truncate">{r.addr}</span>
                  <div className="text-right">
                    <div className="text-[11px] text-gray-300/80 leading-none">Total YY</div>
                    <div className="font-mono text-[16px] font-bold text-emerald-300 leading-none">
                      {fmt(r.totalYY, decimals)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All levels tab */}
      {tab === "all" && (
        <>
          <div className="rounded-2xl ring-1 ring-white/10 bg-[#1a2033]/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-semibold text-white">Levels</div>
              <label className="flex items-center gap-1.5 text-[12px] text-gray-300/90 cursor-pointer select-none">
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
                <Filter className="w-4 h-4" /> Non-empty
              </label>
            </div>

            {/* Spacious list of levels */}
            <div className="space-y-2 max-h-[35vh] overflow-auto pr-1">
              {filteredIds.map((lvl) => {
                const active = lvl === effective;
                const count = levelMap.get(lvl)?.rows?.length ?? 0;
                const sumYY = levelMap.get(lvl)?.totalYY ?? 0n;
                return (
                  <LevelRow
                    key={lvl}
                    lvl={lvl}
                    count={count}
                    sumYY={sumYY}
                    active={active}
                    decimals={decimals}
                    onClick={() => { setLevel(lvl); setPage(1); }}
                  />
                );
              })}
              {filteredIds.length === 0 && <div className="text-[12px] text-gray-400">No levels</div>}
            </div>
          </div>

          <div className="rounded-2xl ring-1 ring-white/10 bg-[#151b2b]/80">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-300" />
              <div className="text-[13px] font-semibold text-white">Level {effective}</div>
              <div className="text-[12px] text-gray-300/90">{`${rows.length} referees`}</div>
              <div className="ml-auto flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 text-[12px] text-gray-300/90">
                  <span>Total YY</span>
                  <span className="font-mono font-semibold text-emerald-300 text-[13px]">{fmt(totalYY, decimals)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/8 px-2.5 py-1.5 ring-1 ring-white/10">
                  <Search className="w-4.5 h-4.5 text-gray-300/90" />
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder="Search address…"
                    className="bg-transparent outline-none text-[12px] text-gray-100 placeholder:text-gray-400 w-40"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[40vh] overflow-auto">
              {visible.length === 0 && (
                <div className="text-[12px] text-gray-300/90">
                  {rows.length === 0 ? "No referees at this level." : "No matches for your search."}
                </div>
              )}
              {visible.map((r, i) => (
                <div key={`${r.addr}-${i}`} className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[12px] text-gray-100 truncate">{r.addr}</span>
                    <div className="text-right">
                      <div className="text-[11px] text-gray-300/80 leading-none">Total YY</div>
                      <div className="font-mono text-[16px] font-bold text-emerald-300 leading-none">
                        {fmt(r.totalYY, decimals)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {rows.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-1 mt-2">
                  <button
                    className="text-[12px] px-3 py-1.5 rounded-xl bg-white/8 text-gray-100 ring-1 ring-white/10 disabled:opacity-40"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={safePage <= 1}
                  >
                    Prev
                  </button>
                  <div className="text-[12px] text-gray-300/90">{safePage} / {totalPages}</div>
                  <button
                    className="text-[12px] px-3 py-1.5 rounded-xl bg-white/8 text-gray-100 ring-1 ring-white/10 disabled:opacity-40"
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
          <Tile icon={<Wallet className="w-4.5 h-4.5" />} label="My Total Staked" value={tiles.staked} />
          <Tile icon={<Award className="w-4.5 h-4.5" />} label="Referral (Lifetime)" value={tiles.lifetimeReferral} />
          <Tile icon={<StarIcon className="w-4.5 h-4.5" />} label="Star Earnings" value={tiles.star} />
          <Tile icon={<Crown className="w-4.5 h-4.5" />} label="Golden Earnings" value={tiles.golden} />
        </div>
      )}
    </div>
  );
}

function tabBtnCls(active: boolean) {
  return [
    "px-3.5 py-2 rounded-xl text-[12px] font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 snap-start",
    active ? "bg-white/15 text-white" : "bg-white/8 text-gray-200 hover:bg-white/12",
  ].join(" ");
}

export default ReferralSection;
