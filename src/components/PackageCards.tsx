// src/components/PackageCards.tsx
import React from "react";
import { Lock, RefreshCcw } from "lucide-react";
import { usePackages } from "@/graphql/hooks/usePackages";
import { useInViewport } from "@/hooks/useInViewport";
import { getColorClasses } from "@/common/helper";


export interface PackageData {
  id: string;
  name: string;
  durationYears: number;
  minAmount: number;
  apy: number;
  color: string;
  tag?: string;
}
interface PackageCardsProps {
  onStakePackage: (packageData: PackageData) => void;
}

const YY: React.FC<{ className?: string; title?: string }> = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" className={className}><circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="16" opacity="0.7"/><path d="M100 160 V90 M100 90 L60 40 M100 90 L140 40" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/></svg>
);
const YYAmount: React.FC<{ value: number; className?: string }> = ({ value, className = "text-white/70" }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}><YY className="w-3.5 h-3.5"/><span className="tabular-nums">{value.toLocaleString()}</span></span>
);
const TagChip: React.FC<{ label: string; gradient: string }> = ({ label, gradient }) =>
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white bg-gradient-to-r ${gradient} shadow-[0_6px_16px_rgba(0,0,0,.35)] ring-1 ring-black/20`}>{label}</span>;
const AccentBar: React.FC<{ gradient: string }> = ({ gradient }) => <div className={`h-[6px] w-full rounded-full bg-gradient-to-r ${gradient} opacity-90`} />;
const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) =>
  <div className="flex items-center justify-between text-[13px] sm:text-sm"><span className="text-white/60">{label}</span><span className="text-white font-medium">{value}</span></div>;

function colorFromId(id: string) {
  const palette = ["blue", "purple", "green", "orange"] as const;
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const PackageCards: React.FC<PackageCardsProps> = ({ onStakePackage }) => {
  
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const { data: packages = [], isFetching, refetch } = usePackages(visible);

  // Last updated text sourced from React Query cache (first item’s meta)
  const lastUpdated = React.useMemo(() => {
    const q = (window as any).__RQ_LAST_UPDATED; // optional: dev peek
    return new Date().toLocaleString();
  }, [packages.length]);

  return (
    <div ref={ref} className="space-y-10">
      {/* Header w/ Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">Last updated: <span className="text-white/70">{lastUpdated}</span></span>
          <button
            onClick={() => refetch()}
            disabled={isFetching || !visible}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/15 ring-1 ring-white/15 disabled:opacity-50"
            title={!visible ? "Loads when visible" : "Refresh"}
          >
            <RefreshCcw className={"w-4 h-4 " + (isFetching ? "animate-spin" : "")} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Grid */}
      {!visible ? (
        <div className="flex items-center justify-center p-12 text-white/70">Loading when visible…</div>
      ) : packages.length === 0 && isFetching ? (
        <div className="flex items-center justify-center p-12 text-white/70">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/20 border-t-white/60 mr-3" />
          Loading packages…
        </div>
      ) : packages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-white/70">No active packages found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {packages.map((pkg) => {
            const gradient = getColorClasses(colorFromId(pkg.id));
            const monthlyAprOn1000 = ((1000 * pkg.apy) / 12) / 100;

            return (
              <div key={pkg.id} className="relative overflow-hidden rounded-3xl p-5 bg-white/5 ring-1 ring-white/10 shadow-[0_8px_40px_-8px_rgba(0,0,0,.35)] hover:shadow-[0_12px_50px_-6px_rgba(0,0,0,.45)] transition-all">
                <AccentBar gradient={gradient} />
                <div className="mt-3 flex items-center justify-between">
                  <div className="min-w-0">{pkg.tag && <TagChip label={pkg.tag} gradient={gradient} />}</div>
                  <div className={`shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-gradient-to-r ${gradient} text-white/95 ring-1 ring-black/20 shadow-inner`}>
                    <span className="opacity-85">APY</span><span className="tabular-nums">{pkg.apy}%</span>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-[42px] leading-none font-extrabold text-white tabular-nums">
                      {pkg.durationYears}
                    </span>
                    <span className="text-white/70 font-semibold text-base sm:text-lg">
                      {pkg.durationYears === 1 ? "Year" : "Years"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">
                  <StatRow label="Min Amount" value={<YYAmount value={pkg.minAmount} className="text-white/70" />} />
                  <div className="pt-2 text-xs inline-flex items-center gap-1.5 text-white/60">
                    <span>≈</span>
                    <YYAmount value={Number(monthlyAprOn1000.toFixed(2))} className="text-white/65" />
                    <span>/ month on</span>
                    <span className="inline-flex items-center gap-1.5 text-white/60">
                      <YY className="w-3.5 h-3.5" />
                      <span className="tabular-nums">1,000</span>
                    </span>
                  </div>
                </div>

                <button onClick={() => onStakePackage(pkg)} className={`mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${gradient} hover:opacity-95 active:opacity-90 transition transform hover:scale-[1.02]`}>
                  <Lock className="w-4 h-4" />
                  Stake Now
                </button>

                <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-14 -left-10 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PackageCards;
