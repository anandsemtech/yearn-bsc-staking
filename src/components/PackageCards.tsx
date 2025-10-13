import React from "react";
import { Lock, ChevronDown, Box } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useInViewport } from "@/hooks/useInViewport";
import { getColorClasses } from "@/common/helper";
import { usePackages, type PackageUI } from "@/hooks/usePackages";

/* =========================
   Types for parent callback
========================= */
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
  /** start collapsed when the page loads */
  initiallyCollapsed?: boolean;
  /** automatically collapse the whole section after a stake */
  autoCollapseAfterStake?: boolean;
  /** optional title override */
  title?: string;
  /** if false, details are always visible and no per-card toggle is shown */
  cardDetailsCollapsible?: boolean;
}

/* =========================
   Tiny UI helpers
========================= */
const YY: React.FC<{ className?: string; title?: string }> = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" className={className}>
    <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="16" opacity="0.7" />
    <path
      d="M100 160 V90 M100 90 L60 40 M100 90 L140 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="16"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.9"
    />
  </svg>
);

const YYAmount: React.FC<{ value: number; className?: string }> = ({ value, className = "text-white/70" }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    <YY className="w-3.5 h-3.5" />
    <span className="tabular-nums">{value.toLocaleString()}</span>
  </span>
);

const GradientChip: React.FC<{ label: string; gradient: string; uppercase?: boolean }> = ({
  label,
  gradient,
  uppercase = false,
}) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
      uppercase ? "text-[10px] font-extrabold uppercase tracking-wide" : "text-[11px] font-semibold"
    } text-white bg-gradient-to-r ${gradient} ring-1 ring-black/20 shadow-[0_6px_16px_rgba(0,0,0,.35)]`}
  >
    {label}
  </span>
);

const AccentBar: React.FC<{ gradient: string }> = ({ gradient }) => (
  <div className={`h-[4px] w-full rounded-full bg-gradient-to-r ${gradient} opacity-80`} />
);

const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-[13px] sm:text-sm">
    <span className="text-white/60">{label}</span>
    <span className="text-white font-medium">{value}</span>
  </div>
);

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-white/10 text-white/80 ring-1 ring-white/10">
    {children}
  </span>
);

const InfoRow: React.FC<{ icon?: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between text-[12px] sm:text-[13px]">
    <span className="inline-flex items-center gap-1.5 text-white/60">
      {icon}
      {label}
    </span>
    <span className="text-white font-medium">{value}</span>
  </div>
);

const fmtInt = (n: number) => Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

/* =========================
   Collapsible helpers (section-level)
========================= */
const useLocalStorage = <T,>(key: string, initial: T) => {
  const [val, setVal] = React.useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val]);
  return [val, setVal] as const;
};

/* =========================
   Component
========================= */
const PackageCards: React.FC<PackageCardsProps> = ({
  onStakePackage,
  initiallyCollapsed = false,
  autoCollapseAfterStake = true,
  title = "Available Packages",
  cardDetailsCollapsible = true,
}) => {
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const { data: packages = [], isFetching } = usePackages(visible);

  // Section collapse state (persisted)
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("pkg-section-collapsed", initiallyCollapsed);
  const toggleSection = () => setCollapsed((p) => !p);

  // Card-level expand (one-at-a-time)
  const [openId, setOpenId] = React.useState<string | null>(null);
  const toggleCard = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  // Auto-collapse section after a stake action
  const handleStake = (pkg: PackageUI) => {
    onStakePackage({
      id: pkg.id,
      name: pkg.name,
      durationYears: pkg.durationYears,
      minAmount: pkg.minAmount,
      apy: pkg.apy,
      color: pkg.color,
      tag: pkg.tag,
    });
    if (autoCollapseAfterStake) setCollapsed(true);
  };

  // fancy header underline progress (purely aesthetic)
  const underlineVariants = {
    collapsed: { scaleX: 0.35, opacity: 0.6 },
    open: { scaleX: 1, opacity: 1 },
  } as const;

  return (
    <section ref={ref} className="space-y-4">
      {/* Section header */}
      <motion.header
        layout
        className="sticky top-0 z-10 -mx-2 px-2 pt-1 pb-2 backdrop-blur supports-[backdrop-filter]:bg-white/5 rounded-b-2xl ring-1 ring-white/10"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Box className="w-4 h-4 text-white/80" />
            </span>
            <div className="truncate">
              <h3 className="text-white font-semibold leading-tight truncate">{title}</h3>
              <p className="text-white/60 text-xs truncate">
                {isFetching ? "Loading…" : `${packages.length} option${packages.length === 1 ? "" : "s"} available`}
              </p>
            </div>
          </div>

          <button
            onClick={toggleSection}
            aria-expanded={!collapsed}
            aria-controls="package-section"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-white/90 text-sm font-medium ring-1 ring-white/15 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span className="hidden sm:inline">{collapsed ? "Show" : "Hide"}</span>
            <motion.span
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="inline-flex"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </button>
        </div>
        <motion.div
          className="mt-2 h-[3px] w-full origin-left rounded-full bg-white/10 overflow-hidden"
          initial={false}
          animate={collapsed ? "collapsed" : "open"}
        >
          <motion.div
            variants={underlineVariants}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="h-full w-full bg-white/40"
          />
        </motion.div>
      </motion.header>

      {/* Section body (collapsible) */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="package-section"
            id="package-section"
            role="region"
            aria-label="Package list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 22 }}
            className="overflow-hidden"
          >
            <div className="space-y-10">
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
                  {packages.map((pkg: PackageUI) => {
                    const gradient = getColorClasses(String(Number(pkg.id)));
                    const monthlyAprOnMin = (pkg.minAmount * pkg.apy) / 12 / 100;

                    const claimEveryDays =
                      pkg.monthlyAPRClaimable && pkg.claimableIntervalSec > 0
                        ? Math.max(1, Math.round(pkg.claimableIntervalSec / 86400))
                        : null;

                    const isOpen = cardDetailsCollapsible ? openId === pkg.id : true;
                    const regionId = `pkg-${pkg.id}-details`;

                    return (
                      <motion.div
                        key={pkg.id}
                        layout
                        className="relative overflow-hidden rounded-3xl p-5 bg-white/5 ring-1 ring-white/10 shadow-[0_8px_40px_-8px_rgba(0,0,0,.35)] hover:shadow-[0_12px_50px_-6px_rgba(0,0,0,.45)] transition-all"
                      >
                        <AccentBar gradient={gradient} />

                        {/* Header row */}
                        <div className="mt-3 flex items-center justify-between">
                          <div className="min-w-0 flex items-center gap-2 flex-wrap">
                            <GradientChip label={pkg.name} gradient={gradient} />
                            {pkg.tag && <GradientChip label={pkg.tag} gradient={gradient} uppercase />}
                          </div>

                          {/* APY + Optional Toggle */}
                          <div className="flex items-center gap-2">
                            <GradientChip label={`APY ${pkg.apy}%`} gradient={gradient} uppercase />
                            {cardDetailsCollapsible && (
                              <button
                                id={`${regionId}-button`}
                                aria-controls={regionId}
                                aria-expanded={isOpen}
                                onClick={() => toggleCard(pkg.id)}
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white/90 bg-white/10 hover:bg-white/15 ring-1 ring-white/15 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
                              >
                                <span className="hidden sm:inline">{isOpen ? "Hide" : "Details"}</span>
                                <motion.span
                                  animate={{ rotate: isOpen ? 180 : 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                                  className="inline-flex"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </motion.span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="mt-4 flex items-end justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl sm:text-[42px] leading-none font-extrabold text-white tabular-nums">{pkg.durationYears}</span>
                            <span className="text-white/70 font-semibold text-base sm:text-lg">{pkg.durationYears === 1 ? "Year" : "Years"}</span>
                          </div>
                        </div>

                        {/* Core stats */}
                        <div className="mt-5 space-y-2.5">
                          <StatRow label="Min Amount" value={<YYAmount value={pkg.minAmount} className="text-white/70" />} />
                          <div className="pt-2 text-xs inline-flex items-center gap-1.5 text-white/60">
                            <span>≈</span>
                            <YYAmount
                              value={Number(monthlyAprOnMin.toFixed(2))}
                              className="text-white/65"
                            />
                            <span>/ month on</span>
                            <span className="inline-flex items-center gap-1.5 text-white/60">
                              <YY className="w-3.5 h-3.5" />
                              <span className="tabular-nums">
                                {pkg.minAmount.toLocaleString()}
                              </span>
                            </span>
                          </div>

                        </div>

                        {/* Collapsible details (per card) — CTA always visible */}
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              key={regionId}
                              id={regionId}
                              role="region"
                              aria-labelledby={`${regionId}-button`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 200, damping: 24 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-3">
                                <div className="mt-2 space-y-1.5">
                                  <InfoRow
                                    label="Claim cadence"
                                    value={
                                      pkg.monthlyAPRClaimable
                                        ? claimEveryDays
                                          ? `${claimEveryDays} days`
                                          : "Monthly"
                                        : "On maturity"
                                    }
                                  />
                                  <InfoRow
                                    label="Principal"
                                    value={
                                      pkg.principalLocked ? "Locked" : pkg.monthlyUnstake ? "Monthly return" : "On maturity"
                                    }
                                    icon={<Lock className="w-3.5 h-3.5 text-white/50" />}
                                  />
                                  {pkg.stakeStep && pkg.stakeStep > 1 && (
                                    <InfoRow label="Add in multiples of" value={fmtInt(pkg.stakeStep)} />
                                  )}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {pkg.monthlyAPRClaimable && <Pill>Monthly claims</Pill>}
                                  {pkg.monthlyUnstake && <Pill>Monthly principal</Pill>}
                                  {pkg.principalLocked && <Pill>Locked</Pill>}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* CTA — always visible */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => handleStake(pkg)}
                          className={`mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${gradient} hover:opacity-95 active:opacity-90 transition`}
                        >
                          <Lock className="w-4 h-4" />
                          Stake Now
                        </motion.button>

                        {/* Soft background glows */}
                        <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
                        <div className="pointer-events-none absolute -bottom-14 -left-10 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default PackageCards;
