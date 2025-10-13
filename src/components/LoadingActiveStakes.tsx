// src/components/LoadingActiveStakes.tsx
import React from "react";

/* =========================================================================
   Visual theme tokens (tweak freely)
=========================================================================== */
const BG = "#0E1626";
const CARD = "#121B2D";
const CARD_SOFT = "#162238";
const BORDER = "#223250";
const ACCENT = "#6c5ce7";
const ACCENT_SOFT = "rgba(108,92,231,0.25)";
const SUCCESS = "#22c55e";

/* =========================================================================
   YY Conic Spinner (SVG only) — with inner “orbiting dots”
=========================================================================== */
const YYConicSpinner: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    role="img"
    aria-label="Loading"
    className="will-change-transform"
    style={{ animation: "yyspin 1.2s linear infinite" }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="yyRing" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="100%" stopColor={ACCENT} stopOpacity="1" />
      </linearGradient>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* base disc */}
    <circle cx="24" cy="24" r="22" fill={CARD_SOFT} stroke={BORDER} strokeWidth="1.25" />

    {/* conic-ish arc (simulate with stroked path) */}
    <path
      d="M24 2 a22 22 0 0 1 0 44"
      fill="none"
      stroke="url(#yyRing)"
      strokeWidth="3.2"
      strokeLinecap="round"
      filter="url(#glow)"
    />

    {/* YY glyph (two diverging arms) */}
    <g stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
      <path d="M24 12 L24 30" />
      <path d="M24 16 L18 11" />
      <path d="M24 16 L30 11" />
    </g>

    {/* three tiny orbiters */}
    <g fill="#fff">
      <circle cx="24" cy="6" r="1.4" />
      <circle cx="40" cy="24" r="1.4" />
      <circle cx="24" cy="42" r="1.4" />
    </g>

    <style>{`
      @keyframes yyspin { to { transform: rotate(360deg) } }
      @media (prefers-reduced-motion: reduce) {
        svg { animation: none !important; }
      }
    `}</style>
  </svg>
);

/* =========================================================================
   Animated Aurora backdrop (pure CSS, clipped to card)
=========================================================================== */
const Aurora: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div className="absolute -inset-24 rounded-[48px] opacity-60 blur-3xl"
         style={{
           background: `conic-gradient(from 0deg at 50% 50%, ${ACCENT_SOFT}, transparent 20%, ${ACCENT_SOFT}, transparent 60%)`,
           animation: "aurora 8s linear infinite",
         }} />
    <style>{`
      @keyframes aurora {
        0% { transform: rotate(0deg) translateY(0px); }
        50% { transform: rotate(180deg) translateY(-6px); }
        100% { transform: rotate(360deg) translateY(0px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .absolute[style*="aurora"] { animation: none !important; }
      }
    `}</style>
  </div>
);

/* =========================================================================
   Progress: “live timeline” with pulsing ticks
=========================================================================== */
const ProgressTimeline: React.FC = () => (
  <div className="px-6 py-3">
    <div className="relative h-2 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 h-full rounded-full"
        style={{
          width: "40%",
          background: `linear-gradient(90deg, ${ACCENT_SOFT}, ${SUCCESS})`,
          animation: "flow 1.6s ease-in-out infinite",
          boxShadow: `0 0 0.5rem ${ACCENT_SOFT}`,
        }}
      />
      {/* ticking markers */}
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/40"
          style={{
            left: `${(i + 1) * (100 / 9)}%`,
            animation: `pulse ${1 + i * 0.08}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
    <div className="mt-2 text-[11px] text-gray-400">
      Syncing packages & positions • subgraph + RPC fallback
    </div>
    <style>{`
      @keyframes flow {
        0% { width: 10%; transform: translateX(0%); }
        50% { width: 65%; transform: translateX(20%); }
        100% { width: 10%; transform: translateX(100%); }
      }
      @keyframes pulse {
        from { opacity: 0.35; transform: translateY(-50%) scale(0.9); }
        to   { opacity: 1; transform: translateY(-50%) scale(1.1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .mt-2 + style ~ div div { animation: none !important; }
      }
    `}</style>
  </div>
);

/* =========================================================================
   Skeleton row with gradient shimmer + tiny counters
=========================================================================== */
const SkeletonRow: React.FC = () => (
  <tr className="bg-[#121C30]/60">
    {["pkg", "amt", "apr", "start", "next", "status"].map((key, idx) => (
      <td key={key} className="px-6 py-4">
        <div className="h-4 w-full rounded bg-white/8 relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
        {idx === 1 && (
          <div className="mt-2 h-2 w-24 rounded bg-white/5 overflow-hidden">
            <div className="h-full w-1/3 animate-[bar_1.3s_ease-in-out_infinite]" style={{ backgroundColor: SUCCESS }} />
          </div>
        )}
      </td>
    ))}
  </tr>
);

/* =========================================================================
   Helpful rotating tips (optional delight)
=========================================================================== */
const Tips: React.FC = () => (
  <div className="px-6 pb-4 text-xs text-gray-400">
    <span className="opacity-80">Tip:</span>{" "}
    <span className="inline-block animate-[fadeSlide_6s_ease-in-out_infinite] will-change-transform">
      Claims update live. If the subgraph is rate-limited, we’ll still render from RPC.
    </span>
    <style>{`
      @keyframes shimmer { 100% { transform: translateX(100%); } }
      @keyframes bar {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(20%); }
        100% { transform: translateX(160%); }
      }
      @keyframes fadeSlide {
        0% { opacity: 0; transform: translateY(2px); }
        10% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; }
        100% { opacity: 0; transform: translateY(-2px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .animate-[fadeSlide_6s_ease-in-out_infinite] { animation: none !important; }
      }
    `}</style>
  </div>
);

/* =========================================================================
   Main Loader Card
=========================================================================== */
const LoadingActiveStakes: React.FC = () => {
  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{ borderColor: BORDER, background: CARD }}
    >
      <Aurora />

      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b backdrop-blur-sm"
        style={{ borderColor: BORDER, background: "linear-gradient(180deg, rgba(255,255,255,0.02), transparent)" }}
      >
        <YYConicSpinner />
        <div className="flex flex-col">
          <div className="text-gray-100 font-medium tracking-wide">Loading active stakes…</div>
          <div className="text-xs text-gray-400">
            Fetching packages & positions from subgraph
          </div>
        </div>

        {/* Right-side soft status pill */}
        <div className="ml-auto">
          <div className="text-[11px] px-2.5 py-1 rounded-full border"
               style={{ borderColor: BORDER, background: "#101b2c", color: "#9aa4b2" }}>
            Live indexing
            <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: SUCCESS, boxShadow: `0 0 8px ${SUCCESS}` }} />
          </div>
        </div>
      </div>

      {/* Timeline progress */}
      <ProgressTimeline />

      {/* Skeleton table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left uppercase text-gray-500 tracking-wider"
                 style={{ background: CARD_SOFT }}>
            <tr>
              {["Package", "Amount", "APR", "Start Date", "Next Claim", "Status"].map((h) => (
                <th key={h} className="px-6 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-100">
            <SkeletonRow />
            <tr style={{ height: 4, background: "#182235" }}>
              <td colSpan={6} />
            </tr>
            <SkeletonRow />
            <tr style={{ height: 4, background: "#182235" }}>
              <td colSpan={6} />
            </tr>
            <SkeletonRow />
          </tbody>
        </table>
      </div>

      <Tips />

      {/* SR-only live region */}
      <div className="sr-only" aria-live="polite">
        Loading active stakes. Fetching packages and positions from subgraph.
      </div>
    </div>
  );
};

export default LoadingActiveStakes;
