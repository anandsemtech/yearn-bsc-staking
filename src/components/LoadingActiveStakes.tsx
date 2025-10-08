// src/components/LoadingActiveStakes.tsx
import React from "react";

/** Spinning YY token (SVG, no image fetch) */
const YYSpinner: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    className="animate-spin-slow"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="20" cy="20" r="19" fill="#FFFFFF" />
    <circle cx="20" cy="20" r="17" fill="#2F6BFF" />
    <circle cx="20" cy="20" r="13" fill="none" stroke="#FFFFFF" strokeWidth="2" />
    <path d="M20 11 L20 29" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M20 14 L14 9" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M20 14 L26 9" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    <style>{`
      .animate-spin-slow { animation: yyspin 1.6s linear infinite; }
      @keyframes yyspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `}</style>
  </svg>
);

/** Subtle animated progress bar */
const Progress: React.FC = () => (
  <div className="w-full h-1.5 bg-white/5 rounded overflow-hidden">
    <div className="h-full w-1/3 bg-emerald-500/70 animate-progress" />
    <style>{`
      .animate-progress {
        animation: progressSlide 1.2s ease-in-out infinite;
      }
      @keyframes progressSlide {
        0%   { transform: translateX(-100%); }
        50%  { transform: translateX(40%); }
        100% { transform: translateX(160%); }
      }
    `}</style>
  </div>
);

/** Skeleton row */
const SkeletonRow: React.FC = () => (
  <tr className="bg-[#1F2733]">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-4 w-full rounded bg-white/10 relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>
      </td>
    ))}
    <style>{`
      .animate-shimmer { animation: shimmer 1.4s ease-in-out infinite; }
      @keyframes shimmer { 100% { transform: translateX(100%); } }
    `}</style>
  </tr>
);

/** Main loader used in ActivePackages */
const LoadingActiveStakes: React.FC = () => {
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#1C2430] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-[#1E2A36]">
        <YYSpinner />
        <div className="flex flex-col">
          <div className="text-gray-100 font-medium">Loading active stakes…</div>
          <div className="text-xs text-gray-400">Fetching packages & positions from subgraph</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 py-3">
        <Progress />
      </div>

      {/* Skeleton table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left uppercase text-gray-500 tracking-wider bg-[#1E2A36]">
            <tr>
              {["Package", "Amount", "APR", "Start Date", "Next Claim", "Status"].map((h) => (
                <th key={h} className="px-6 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-100">
            <SkeletonRow />
            <tr className="h-1 bg-[#242F3B]"><td colSpan={6} /></tr>
            <SkeletonRow />
            <tr className="h-1 bg-[#242F3B]"><td colSpan={6} /></tr>
            <SkeletonRow />
          </tbody>
        </table>
      </div>

      {/* Accessibility live region */}
      <div className="sr-only" aria-live="polite">
        Loading active stakes. Fetching packages and positions from subgraph.
      </div>
    </div>
  );
};

export default LoadingActiveStakes;
