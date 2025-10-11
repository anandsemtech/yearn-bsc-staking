import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import {
  Star,
  Users,
  Crown,
  Gift,
  Info,
  CheckCircle2,
  Lock as LockIcon,
} from "lucide-react";
import { subgraph, gql } from "@/lib/subgraph";

/* ================= Types ================= */
type Density = "compact" | "comfortable";

type UserStarDataBase = {
  id: string;
  currentStar: number;
  directReferralsCount: number;
  star1Children: number;
  star2Children: number;
  star3Children: number;
  star4Children: number;
  isGoldenStar: boolean;
  goldenStarActivatedAt?: string | null;
  starEarningsTotal: string;   // BigInt as string
  goldenEarningsTotal: string; // BigInt as string
};

type RefRow = { id: string; assignedAt: string };

type UserStarDataWithRefs = UserStarDataBase & {
  referees: RefRow[];
};

type Props = {
  address?: `0x${string}` | null;
  goldenStarWindowDays?: number;
  star1DirectNeeded?: number;
  higherStarChildNeeded?: number;
  goldenStarDirectNeeded?: number;
  density?: Density;
  starBenefits?: Record<1 | 2 | 3 | 4 | 5, string[]>;
  goldenBenefits?: string[];
};

/* ================= Dark Theme ================= */
const TONES = {
  panel:
    "bg-[#0B0E12]/90 border-white/5 ring-1 ring-white/5 shadow-[0_20px_60px_-20px_rgba(0,0,0,.8)]",
  card: "bg-[#0F141A]/80 border-white/10",
  softText: "text-slate-300",
  hardText: "text-slate-100",
  dimText: "text-slate-400",
  glow: "shadow-[0_0_0_1px_rgba(255,255,255,.04),0_10px_40px_-10px_rgba(0,0,0,.8)]",
};

const AURORA = (
  <div
    aria-hidden
    className="pointer-events-none absolute -inset-24 opacity-60 blur-2xl"
    style={{
      background:
        "radial-gradient(800px 300px at 15% 10%, rgba(56,189,248,.18), transparent 60%), radial-gradient(600px 240px at 85% 85%, rgba(168,85,247,.16), transparent 60%), radial-gradient(600px 240px at 50% 40%, rgba(234,179,8,.10), transparent 60%)",
    }}
  />
);

/* star accent palettes */
const palette = {
  1: { ring: "text-amber-400", grad: "from-amber-500/50 to-yellow-400/60" },
  2: { ring: "text-sky-400", grad: "from-sky-500/50 to-cyan-400/60" },
  3: { ring: "text-violet-400", grad: "from-violet-500/50 to-fuchsia-400/60" },
  4: { ring: "text-emerald-400", grad: "from-emerald-500/50 to-green-400/60" },
  5: { ring: "text-rose-400", grad: "from-rose-500/50 to-orange-400/60" },
} as const;

const densityMap: Record<
  Density,
  { pad: string; gap: string; title: string; sectionPad: string }
> = {
  compact: { pad: "p-4", gap: "gap-3", title: "text-sm", sectionPad: "p-4" },
  comfortable: { pad: "p-6", gap: "gap-4", title: "text-base", sectionPad: "p-6" },
};

/* ================= Small Atoms ================= */
const Chip: React.FC<{
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
  title?: string;
}> = ({ icon: Icon, children, className, title }) => (
  <div
    title={title}
    className={clsx(
      "inline-flex items-center gap-1.5 text-[11px] rounded-xl px-2.5 py-1",
      "border border-white/10 bg-white/5 backdrop-blur",
      "text-slate-200",
      className
    )}
  >
    <Icon className="w-3.5 h-3.5 opacity-90" />
    <span className="opacity-90 leading-none">{children}</span>
  </div>
);

const Bar: React.FC<{
  value: number;
  labelLeft?: string;
  labelRight?: string;
  className?: string;
}> = ({ value, labelLeft, labelRight, className }) => {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx("w-full", className)}>
      {(labelLeft || labelRight) && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>{labelLeft}</span>
          <span>{labelRight}</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-white/5 border border-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400/90 via-emerald-400/90 to-yellow-300/90"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 150, damping: 22 }}
        />
      </div>
    </div>
  );
};

const LevelToken: React.FC<{ achieved: boolean; level: number }> = ({
  achieved,
  level,
}) => {
  const c = palette[level as 1 | 2 | 3 | 4 | 5];
  return (
    <div
      className={clsx(
        "relative w-10 h-10 rounded-full grid place-items-center",
        "bg-white/[0.02] border border-white/10",
        TONES.glow
      )}
    >
      <Star className={clsx("w-5 h-5", c.ring)} />
      <AnimatePresence>
        {achieved && (
          <motion.div
            className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-[2px]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LevelCard: React.FC<{
  lvl: number;
  active: boolean;
  achieved: boolean;
  requirement: string;
  pct: number;
  onSelect: () => void;
}> = ({ lvl, active, achieved, requirement, pct, onSelect }) => {
  const c = palette[lvl as 1 | 2 | 3 | 4 | 5];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="snap-start w-40 shrink-0 transform-gpu"
    >
      <div
        className={clsx(
          "rounded-2xl p-[1.5px] transition-shadow",
          active ? `bg-gradient-to-tr ${c.grad}` : "bg-white/5"
        )}
      >
        <div className={clsx("rounded-2xl px-3 py-3 min-h-[104px]", TONES.card)}>
          <div className="flex items-center gap-3">
            <LevelToken achieved={achieved} level={lvl} />
            <div className="min-w-0">
              <div className={clsx("text-sm font-semibold", TONES.hardText)}>
                {lvl}-Star
              </div>
              <div className="text-[11px] text-slate-400 line-clamp-1">
                {requirement || "—"}
              </div>
            </div>
          </div>
          <div className="mt-2">
            <Bar value={pct} />
          </div>
        </div>
      </div>
    </button>
  );
};

/* ================= GQL (3 paths) ================= */
// 1) With derived referees + server-side time filter (best)
const Q_WITH_REFS_FILTER = gql/* GraphQL */ `
  query UserStar_WithRefsFilter($id: ID!, $fromTs: BigInt!) {
    user(id: $id) {
      id
      currentStar
      directReferralsCount
      star1Children
      star2Children
      star3Children
      star4Children
      isGoldenStar
      goldenStarActivatedAt
      starEarningsTotal
      goldenEarningsTotal
      referees(where: { assignedAt_gte: $fromTs }) { id assignedAt }
    }
  }
`;

// 2) With derived referees but **no** where (client filters)
const Q_WITH_REFS_NOFILTER = gql/* GraphQL */ `
  query UserStar_WithRefsNoFilter($id: ID!) {
    user(id: $id) {
      id
      currentStar
      directReferralsCount
      star1Children
      star2Children
      star3Children
      star4Children
      isGoldenStar
      goldenStarActivatedAt
      starEarningsTotal
      goldenEarningsTotal
      referees(first: 100, orderBy: assignedAt, orderDirection: desc) {
        id
        assignedAt
      }
    }
  }
`;

// 3) Without referees at all (older schema)
const Q_NO_REFS = gql/* GraphQL */ `
  query UserStar_NoRefs($id: ID!) {
    user(id: $id) {
      id
      currentStar
      directReferralsCount
      star1Children
      star2Children
      star3Children
      star4Children
      isGoldenStar
      goldenStarActivatedAt
      starEarningsTotal
      goldenEarningsTotal
    }
  }
`;

/* ================= Helpers ================= */
const toLower = (a?: string | null) => (a ? a.toLowerCase() : null);
const bnToN = (x?: string | null) => {
  if (!x) return 0;
  try {
    return Number(x);
  } catch {
    return 0;
  }
};
const requirementText = (
  lvl: 1 | 2 | 3 | 4 | 5,
  star1Need: number,
  higherNeed: number
) =>
  lvl === 1
    ? `Refer ${star1Need} direct users`
    : `Have ${higherNeed} direct ${lvl - 1}-Star users`;

function progressFor(
  targetLevel: 1 | 2 | 3 | 4 | 5,
  u: UserStarDataBase,
  star1Need: number,
  higherNeed: number
) {
  if (targetLevel === 1) {
    const curr = u.directReferralsCount ?? 0;
    return {
      label: "Direct referrals",
      current: curr,
      target: star1Need,
      pct: Math.min(100, (curr / star1Need) * 100),
    };
  }
  const buckets: Record<number, number> = {
    2: u.star1Children,
    3: u.star2Children,
    4: u.star3Children,
    5: u.star4Children,
  };
  const curr = buckets[targetLevel] ?? 0;
  return {
    label: `${targetLevel - 1}-Star direct children`,
    current: curr,
    target: higherNeed,
    pct: Math.min(100, (curr / higherNeed) * 100),
  };
}

function looksSchemaError(e: any): boolean {
  const msg = String(
    e?.response?.errors?.[0]?.message || e?.message || e || ""
  ).toLowerCase();
  return (
    msg.includes("cannot query field") ||
    msg.includes("unknown argument") ||
    msg.includes("unknown type") ||
    msg.includes("validation error")
  );
}

function looksTransient(e: any): boolean {
  const msg = String(e?.message || e || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("tempor") // temporary
  );
}

/* ================= Component ================= */
const StarJourneyPanel: React.FC<Props> = ({
  address,
  goldenStarWindowDays = 30,
  star1DirectNeeded = 5,
  higherStarChildNeeded = 2,
  goldenStarDirectNeeded = 15,
  density = "comfortable",
  starBenefits,
  goldenBenefits,
}) => {
  const { address: connected } = useAccount();
  const userId = toLower(address ?? connected) as string | null;
  const D = densityMap[density];

  const [data, setData] = useState<UserStarDataWithRefs | UserStarDataBase | null>(null);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"with-filter" | "with-no-filter" | "no-refs" | null>(null);

  const fromTs = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec - goldenStarWindowDays * 24 * 60 * 60;
  }, [goldenStarWindowDays]);

  useEffect(() => {
    let live = true;

    async function attempt<T>(fn: () => Promise<T>) {
      try {
        return await fn();
      } catch (e) {
        if (looksTransient(e)) {
          await new Promise((r) => setTimeout(r, 450));
          return await fn();
        }
        throw e;
      }
    }

    async function fetchData() {
      if (!userId) {
        setData(null);
        setLoading(false);
        setErr(null);
        setMode(null);
        return;
      }
      setLoading(true);
      setErr(null);

      try {
        // 1) try WITH filter
        const res1 = await attempt(() =>
          subgraph.request<{ user: UserStarDataWithRefs | null }>(
            Q_WITH_REFS_FILTER,
            { id: userId, fromTs: String(fromTs) } // BigInt as string
          )
        );
        if (!live) return;
        setData(res1.user);
        setMode("with-filter");
        return;
      } catch (e1: any) {
        console.debug("[StarPanel] WITH_FILTER failed:", e1);
        if (!looksSchemaError(e1)) {
          setErr(String(e1?.response?.errors?.[0]?.message || e1?.message || e1));
        }
      }

      try {
        // 2) try WITH referees but no filter (client-side window)
        const res2 = await attempt(() =>
          subgraph.request<{ user: UserStarDataWithRefs | null }>(
            Q_WITH_REFS_NOFILTER,
            { id: userId }
          )
        );
        if (!live) return;
        setData(res2.user);
        setMode("with-no-filter");
        setErr(null);
        return;
      } catch (e2: any) {
        console.debug("[StarPanel] WITH_NO_FILTER failed:", e2);
        if (!looksSchemaError(e2)) {
          setErr(String(e2?.response?.errors?.[0]?.message || e2?.message || e2));
        }
      }

      try {
        // 3) try NO referees (older schema)
        const res3 = await attempt(() =>
          subgraph.request<{ user: UserStarDataBase | null }>(Q_NO_REFS, {
            id: userId,
          })
        );
        if (!live) return;
        setData(res3.user);
        setMode("no-refs");
        setErr(null);
        return;
      } catch (e3: any) {
        console.debug("[StarPanel] NO_REFS failed:", e3);
        if (!live) return;
        setErr(String(e3?.response?.errors?.[0]?.message || e3?.message || e3));
      } finally {
        if (live) setLoading(false);
      }
    }

    fetchData();
    return () => {
      live = false;
    };
  }, [userId, fromTs]);

  // Defaults if user not found yet
  const uBase: UserStarDataBase =
    (data as any) ?? {
      id: userId ?? "",
      currentStar: 0,
      directReferralsCount: 0,
      star1Children: 0,
      star2Children: 0,
      star3Children: 0,
      star4Children: 0,
      isGoldenStar: false,
      goldenStarActivatedAt: null,
      starEarningsTotal: "0",
      goldenEarningsTotal: "0",
    };

  // Separate lifetime totals
  const starLifetime = bnToN(uBase.starEarningsTotal);
  const goldenLifetime = bnToN(uBase.goldenEarningsTotal);

  // Focus level + progress
  const [focusLevel, setFocusLevel] = useState<number>(
    Math.max(1, uBase.currentStar || 1)
  );
  useEffect(() => setFocusLevel(Math.max(1, uBase.currentStar || 1)), [uBase.currentStar]);

  const focus = useMemo(
    () => progressFor(focusLevel as 1 | 2 | 3 | 4 | 5, uBase, star1DirectNeeded, higherStarChildNeeded),
    [focusLevel, uBase, star1DirectNeeded, higherStarChildNeeded]
  );
  const nextLevel = Math.min(5, Math.max(1, (uBase.currentStar || 0) + 1));
  const next = progressFor(
    nextLevel as 1 | 2 | 3 | 4 | 5,
    uBase,
    star1DirectNeeded,
    higherStarChildNeeded
  );

  // Golden Star progress
  let goldenNowCount = 0;
  if (mode === "with-filter" || mode === "with-no-filter") {
    const refs = (data as UserStarDataWithRefs)?.referees ?? [];
    if (mode === "with-filter") {
      goldenNowCount = refs.length;
    } else {
      const windowStart = fromTs;
      goldenNowCount = refs.filter((r) => Number(r.assignedAt) >= windowStart).length;
    }
  }
  const goldenPct = Math.min(100, (goldenNowCount / goldenStarDirectNeeded) * 100);

  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLDivElement>(
      `[data-level="${focusLevel}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focusLevel]);

  // Benefits copy
  const DEFAULT_BENEFITS: Record<1 | 2 | 3 | 4 | 5, string[]> = {
    1: ["Unlock referral earnings", "Level bonuses", "Leaderboard boost"],
    2: ["Higher bonus share", "Priority support", "Exclusive campaigns"],
    3: ["Premium bonus share", "Early access", "Invite-only promos"],
    4: ["Elite bonus share", "Co-marketing slots", "VIP events"],
    5: ["Top-tier share", "Brand spotlight", "Founders’ circle"],
  };
  const BENEFITS = {
    1: starBenefits?.[1] ?? DEFAULT_BENEFITS[1],
    2: starBenefits?.[2] ?? DEFAULT_BENEFITS[2],
    3: starBenefits?.[3] ?? DEFAULT_BENEFITS[3],
    4: starBenefits?.[4] ?? DEFAULT_BENEFITS[4],
    5: starBenefits?.[5] ?? DEFAULT_BENEFITS[5],
  } as Record<1 | 2 | 3 | 4 | 5, string[]>;

  const GOLDEN_BENEFITS = goldenBenefits ?? [
    "1-Star APR for 12 months",
    "Or until 10× total stake cap",
    "Golden badge + glow",
  ];

  if (!userId) {
    return (
      <div className={clsx("rounded-3xl p-6", TONES.panel)}>
        <div className="text-sm text-slate-300">
          Connect your wallet to see your Star Journey.
        </div>
      </div>
    );
  }

  return (
    <div className={clsx("relative rounded-3xl overflow-hidden", TONES.panel)}>
      {AURORA}

      {/* Header */}
      <div className={clsx("relative border-b border-white/10", D.pad)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
              {uBase.currentStar}-Star
            </span>
          </div>

          {/* Split lifetime earnings */}
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                Star Level • lifetime
              </div>
              <div className="text-base md:text-lg font-bold text-white">
                ${starLifetime.toLocaleString()}
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-right leading-tight">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                Golden Star • lifetime
              </div>
              <div className="text-base md:text-lg font-bold text-white">
                ${goldenLifetime.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Golden Star */}
      <div className={clsx("relative border-b border-white/10", D.sectionPad)}>
        <div
          className={clsx(
            "relative rounded-2xl p-4 md:p-5 overflow-hidden",
            "border border-yellow-400/30 bg-gradient-to-br from-yellow-500/10 via-amber-400/10 to-orange-400/10"
          )}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-20 opacity-40"
            initial={{ scale: 0.95, opacity: 0.25 }}
            animate={{ scale: 1, opacity: 0.4 }}
            transition={{ duration: 2.2, repeat: Infinity, repeatType: "reverse" }}
            style={{
              background:
                "radial-gradient(600px 220px at 12% 15%, rgba(255,220,120,.25), transparent 60%), radial-gradient(600px 220px at 88% 85%, rgba(255,180,70,.18), transparent 60%)",
            }}
          />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-2xl p-3 bg-white/5 border border-white/10">
                <Crown className="w-7 h-7 text-yellow-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={clsx("font-semibold", TONES.hardText, "text-base")}>
                    Golden Star
                  </span>
                  <span className="text-[12px] text-slate-300">
                    Refer {goldenStarDirectNeeded} within {goldenStarWindowDays} days
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Chip
                    icon={Users}
                    title={
                      mode === "no-refs"
                        ? "Upgrade subgraph to show rolling window"
                        : mode === "with-no-filter"
                        ? "Calculated client-side (top 100 latest)"
                        : "Direct referrals in rolling window"
                    }
                  >
                    {mode === "no-refs"
                      ? "—"
                      : `${Math.min(goldenNowCount, goldenStarDirectNeeded)} / ${goldenStarDirectNeeded}`}
                  </Chip>
                  <Chip icon={Gift} title="Golden benefits">
                    1-Star APR ×12m / 10× cap
                  </Chip>
                  <span
                    className={clsx(
                      "text-xs font-semibold",
                      uBase.isGoldenStar ? "text-emerald-400" : "text-yellow-300"
                    )}
                  >
                    {uBase.isGoldenStar ? "Active" : "Locked"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full lg:max-w-[520px]">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Earnings (lifetime):</span>
                <span className="text-sm font-semibold text-white">
                  ${goldenLifetime.toLocaleString()}
                </span>
              </div>

              <Bar
                value={mode === "no-refs" ? 0 : goldenPct}
                labelLeft="Progress"
                labelRight={
                  mode === "no-refs"
                    ? "update subgraph to show"
                    : `${Math.min(goldenNowCount, goldenStarDirectNeeded)} / ${goldenStarDirectNeeded}`
                }
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {(goldenBenefits ?? [
                  "1-Star APR for 12 months",
                  "Or until 10× total stake cap",
                  "Golden badge + glow",
                ])
                  .slice(0, 3)
                  .map((b, i) => (
                    <Chip key={i} icon={Gift} className="bg-white/10 border-white/10">
                      {b}
                    </Chip>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Level Strip */}
      <div className="px-3 md:px-4 py-3">
        <div className="overflow-x-auto no-scrollbar">
          <div
            ref={stripRef}
            className="flex items-stretch gap-3 min-w-[420px] snap-x snap-mandatory overflow-visible"
          >
            {[1, 2, 3, 4, 5].map((lvl) => {
              const achieved = (uBase.currentStar || 0) >= lvl;
              const req = requirementText(
                lvl as 1 | 2 | 3 | 4 | 5,
                star1DirectNeeded,
                higherStarChildNeeded
              );
              const pct = progressFor(
                lvl as 1 | 2 | 3 | 4 | 5,
                uBase,
                star1DirectNeeded,
                higherStarChildNeeded
              ).pct;
              return (
                <div key={lvl} data-level={lvl}>
                  <LevelCard
                    lvl={lvl}
                    active={focusLevel === lvl}
                    achieved={achieved}
                    requirement={req}
                    pct={pct}
                    onSelect={() => setFocusLevel(lvl)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Progress & Next */}
      <div className={clsx(D.sectionPad)}>
        <div className={clsx("rounded-2xl p-4 md:p-5", TONES.card)}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  "rounded-md px-2 py-0.5 text-[11px] text-white bg-gradient-to-r",
                  palette[focusLevel as 1 | 2 | 3 | 4 | 5].grad
                )}
              >
                {focusLevel}-Star
              </span>
              <span className="text-[12px] text-slate-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> tap a star to preview
              </span>
            </div>
            {(uBase.currentStar || 0) >= focusLevel ? (
              <span className="text-emerald-400 text-xs flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> achieved
              </span>
            ) : (
              <span className="text-amber-300 text-xs flex items-center gap-1">
                <LockIcon className="w-4 h-4" /> locked
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Focus requirement */}
            <div className={clsx("rounded-xl p-4", TONES.card)}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] text-slate-400">
                  Star Level earnings (lifetime):
                </span>
                <span className="text-sm font-semibold text-white">
                  ${starLifetime.toLocaleString()}
                </span>
              </div>

              <Bar
                value={focus.pct}
                labelLeft={focus.label}
                labelRight={`${focus.current} / ${focus.target}`}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {((
                  {
                    1: ["Unlock referral earnings", "Level bonuses", "Leaderboard boost"],
                    2: ["Higher bonus share", "Priority support", "Exclusive campaigns"],
                    3: ["Premium bonus share", "Early access", "Invite-only promos"],
                    4: ["Elite bonus share", "Co-marketing slots", "VIP events"],
                    5: ["Top-tier share", "Brand spotlight", "Founders’ circle"],
                  } as any
                )[focusLevel] as string[]).slice(0, 3).map((r: string, i: number) => (
                  <Chip key={i} icon={Gift}>
                    {r}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Next milestone */}
            <div className={clsx("rounded-xl p-4", TONES.card)}>
              {(uBase.currentStar || 0) >= 5 ? (
                <div className="text-xs text-slate-300">Max level reached 🎉</div>
              ) : (
                <>
                  <Bar
                    value={next.pct}
                    labelLeft={`${nextLevel}-Star • ${next.label}`}
                    labelRight={`${next.current} / ${next.target}`}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(BENEFITS[nextLevel as 1 | 2 | 3 | 4 | 5] || [])
                      .slice(0, 2)
                      .map((r, i) => (
                        <Chip key={i} icon={Gift} className="bg-white/10 border-white/10">
                          {r}
                        </Chip>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {loading && (
            <div className="mt-4 text-[12px] text-slate-400">
              Fetching on-chain stats…
            </div>
          )}
          {err && (
            <div className="mt-4 text-[12px] text-amber-300">
              {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StarJourneyPanel;
