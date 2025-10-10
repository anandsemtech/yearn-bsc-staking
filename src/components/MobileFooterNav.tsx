import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Wallet, Zap, Settings, Award, Users } from "lucide-react";
import clsx from "clsx";

type Props = {
  // Actions
  onOpenBalances: () => void;
  onOpenWallet: () => void;    // center FAB (Zap)
  onOpenSettings: () => void;
  onOpenClaims: () => void;     // "My Claims" sheet (only if hasPreferredBadge)
  onOpenReferrals: () => void;  // "Referrals" sheet (only if hasPreferredBadge)

  // State
  hasPreferredBadge: boolean;
  active?: "balances" | "wallet" | "settings" | "claims" | "referrals";
};

const Btn: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}> = ({ label, icon, onClick, active }) => {
  const reduce = useReducedMotion();
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center justify-center gap-1.5 min-w-[60px] rounded-xl relative",
        "pointer-events-auto", // ensure button gets taps
        active ? "text-white" : "text-white/70 hover:text-white"
      )}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <motion.div
        animate={active && !reduce ? { scale: [1, 1.15, 1] } : {}}
        transition={active && !reduce ? { repeat: Infinity, duration: 2 } : {}}
        className={clsx(
          "flex items-center justify-center w-10 h-10 rounded-full",
          active ? "bg-white/15 ring-1 ring-amber-400/40 shadow-lg" : "bg-transparent"
        )}
      >
        {icon}
      </motion.div>
      <span className="text-[11px] leading-none">{label}</span>
    </motion.button>
  );
};

const MobileFooterNav: React.FC<Props> = ({
  onOpenBalances,
  onOpenWallet,
  onOpenSettings,
  onOpenClaims,
  onOpenReferrals,
  hasPreferredBadge,
  active = "balances",
}) => {
  return (
    <motion.nav
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className="
        md:hidden fixed inset-x-0 bottom-0 z-[1000]
        border-t border-white/10
        bg-gradient-to-t from-[#0e1015]/95 via-[#171b22]/90 to-[#0e1015]/95
        backdrop-blur-xl
        pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]
        overflow-visible
      "
      role="navigation"
      aria-label="Mobile Navigation"
    >
      {/* Curved SVG background (decorative) */}
      <svg
        className="absolute inset-x-0 bottom-full w-full h-8 text-[#171b22]/80 pointer-events-none"
        viewBox="0 0 100 25"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,25 C25,5 75,5 100,25 L100,25 L0,25 Z" fill="currentColor" />
      </svg>

      <div className="mx-auto max-w-7xl px-4 relative flex items-center justify-around">
        {/* Left group */}
        <div className="flex gap-3 relative z-10 pointer-events-auto">
          {hasPreferredBadge ? (
            <>
              <Btn
                label="My Claims"
                icon={<Award className="w-5 h-5" />}
                onClick={onOpenClaims}
                active={active === "claims"}
              />
              <Btn
                label="Referrals"
                icon={<Users className="w-5 h-5" />}
                onClick={onOpenReferrals}
                active={active === "referrals"}
              />
            </>
          ) : (
            <Btn
              label="Balances"
              icon={<Wallet className="w-5 h-5" />}
              onClick={onOpenBalances}
              active={active === "balances"}
            />
          )}
        </div>

        {/* Floating center button (Wallet FAB) */}
        <motion.button
          onClick={onOpenWallet}
          whileTap={{ scale: 0.9 }}
          className="
            absolute -top-5 left-1/2 -translate-x-1/2
            w-14 h-14 rounded-full
            bg-gradient-to-br from-amber-400 to-yellow-500
            shadow-[0_0_25px_rgba(255,204,84,0.5)]
            border border-amber-300/40
            flex items-center justify-center
            active:scale-95
            focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60
            z-20 pointer-events-auto
          "
          aria-label="Wallet"
          aria-current={active === "wallet" ? "page" : undefined}
        >
          <Zap className="w-7 h-7 text-[#1a1a1a]" />
        </motion.button>

        {/* Right group */}
        <div className="flex gap-3 relative z-10 pointer-events-auto">
          {hasPreferredBadge ? (
            <>
              <Btn
                label="Balances"
                icon={<Wallet className="w-5 h-5" />}
                onClick={onOpenBalances}
                active={active === "balances"}
              />
              <Btn
                label="Settings"
                icon={<Settings className="w-5 h-5" />}
                onClick={onOpenSettings}
                active={active === "settings"}
              />
            </>
          ) : (
            <Btn
              label="Settings"
              icon={<Settings className="w-5 h-5" />}
              onClick={onOpenSettings}
              active={active === "settings"}
            />
          )}
        </div>
      </div>
    </motion.nav>
  );
};

export default MobileFooterNav;
