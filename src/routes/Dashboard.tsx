import React, { useMemo, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Navigate } from "react-router-dom";
import type { Address } from "viem";

import PackageCards, { PackageData } from "@/components/PackageCards";
import StakingModal from "@/components/StakingModal";
import ActivePackages from "@/components/ActivePackages";

import { useActiveStakes } from "@/hooks/useActiveStakes";
import { useHonoraryNft } from "@/hooks/useHonoraryNft";
import HonoraryNftPopup from "@/components/HonoraryNftPopup";

import ReferralSection from "@/components/ReferralSection";
import MobileFooterNav from "@/components/MobileFooterNav";

/* === EXACT preferred badge contracts from env === */
const YEARNCHAMPNFT = (import.meta.env.VITE_YEARNCHAMPNFT ||
  "0xb065ab52d4aE43dba2b8b87cf6F6873becD919a3") as Address;
const YEARNBUDDYNFT = (import.meta.env.VITE_YEARNBUDDYNFT ||
  "0x18A562d77336FAEca3C6c0dA157B94C80d5359bD") as Address;

const GlassPanel: React.FC<
  React.PropsWithChildren<{ title?: string; className?: string; id?: string }>
> = ({ title, className, id, children }) => (
  <section
    id={id}
    className={[
      "relative rounded-3xl p-5 sm:p-6",
      "bg-white/10 backdrop-blur-xl",
      "border border-white/10 ring-1 ring-white/15 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.45)]",
      className || "",
    ].join(" ")}
  >
    <div
      className="pointer-events-none absolute -inset-px rounded-3xl opacity-60"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.02))",
      }}
    />
    {title ? (
      <h2 className="text-lg font-semibold text-white mb-4 relative">
        {title}
      </h2>
    ) : null}
    <div className="relative">{children}</div>
  </section>
);

export default function Dashboard() {
  const [selectedPackage, setSelectedPackage] = useState<PackageData | null>(
    null
  );
  const { address, isConnected } = useAccount();
  if (!isConnected || !address) return <Navigate to="/" replace />;

  const { rows, loading, error, refresh } = useActiveStakes({
    address,
    requireDirtyOrStale: true,
    softMaxAgeMs: 120_000,
    ttlMs: 60_000,
  });

  const { badges, show, dismiss, loading: badgesLoading } = useHonoraryNft({
    owner: address ?? null,
    contracts: [
      { address: YEARNCHAMPNFT, label: "YearnChamp" },
      { address: YEARNBUDDYNFT, label: "YearnBuddy" },
    ],
  });

  const preferredSet = useMemo(
    () => new Set([YEARNCHAMPNFT.toLowerCase(), YEARNBUDDYNFT.toLowerCase()]),
    []
  );

  const userHasPreferredBadge = useMemo(() => {
    return (badges || []).some(
      (b) =>
        b?.owned &&
        b?.address &&
        preferredSet.has(String(b.address).toLowerCase())
    );
  }, [badges, preferredSet]);

  const [hasPreferred, setHasPreferred] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHasPreferred(userHasPreferredBadge), 150);
    return () => clearTimeout(t);
  }, [userHasPreferredBadge]);

  const honoraryItems = useMemo(
    () =>
      (badges || [])
        .filter((b) => b.owned)
        .map((b) => ({
          title: b.label,
          imageUrl: b.imageUrl,
          address: b.address,
        })),
    [badges]
  );

  const [forceHonoraryOpen, setForceHonoraryOpen] = useState(false);
  useEffect(() => {
    const openHandler = () => setForceHonoraryOpen(true);
    window.addEventListener("honorary:open", openHandler as EventListener);
    return () =>
      window.removeEventListener("honorary:open", openHandler as EventListener);
  }, []);

  // Footer state + handlers
  const [activeFooter, setActiveFooter] = useState<
    "balances" | "wallet" | "settings" | "claims" | "referrals"
  >("balances");

  const openReferrals = () => {
    setActiveFooter("referrals");
    window.dispatchEvent(new CustomEvent("referrals:open"));
  };

  const openClaims = () => {
    setActiveFooter("claims");
    window.dispatchEvent(new CustomEvent("claims:open"));
  };

  // ⬇️ No scrolling — just request Header to open the balances sheet
  const openBalances = () => {
    setActiveFooter("balances");
    window.dispatchEvent(new CustomEvent("balances:open"));
  };

  const openSettings = () => {
    setActiveFooter("settings");
    window.dispatchEvent(new CustomEvent("settings:open"));
  };

  const openWallet = async () => {
    setActiveFooter("wallet");
    const anyWin = window as any;
    if (anyWin?.appKit?.open) await anyWin.appKit.open();
    else if (anyWin?.reown?.open) await anyWin.reown.open();
    else if (anyWin?.ethereum?.request) {
      try {
        await anyWin.ethereum.request({ method: "eth_requestAccounts" });
      } catch {}
    }
    window.dispatchEvent(new CustomEvent("wallet:open"));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-[92px] md:pb-8">
      {(show || forceHonoraryOpen) && honoraryItems.length > 0 && (
        <HonoraryNftPopup
          items={honoraryItems}
          onClose={() => {
            setForceHonoraryOpen(false);
            dismiss();
          }}
          onMinimizeToHeader={(hero) => {
            window.dispatchEvent(
              new CustomEvent("honorary:minimize", {
                detail: {
                  imageUrl: hero.imageUrl ?? "/images/placeholder.png",
                  title: hero.title,
                },
              })
            );
            setForceHonoraryOpen(false);
            dismiss();
          }}
        />
      )}

      <GlassPanel title="Available Packages" className="mt-8" id="available-packages">
        <PackageCards onStakePackage={setSelectedPackage} />
      </GlassPanel>

      <GlassPanel title="Active Packages" className="mt-8" id="active-packages">
        <ActivePackages rows={rows} loading={loading} error={error} onRefresh={refresh} />
      </GlassPanel>

      {selectedPackage && (
        <StakingModal
          package={selectedPackage}
          onClose={() => setSelectedPackage(null)}
          hasAdvanced={!badgesLoading && hasPreferred}
          honoraryItems={honoraryItems}
        />
      )}

      {/* Mobile footer — shows claims/referrals only when badge present */}
      <MobileFooterNav
        hasPreferredBadge={!badgesLoading && hasPreferred}
        active={activeFooter}
        onOpenReferrals={openReferrals}
        onOpenClaims={openClaims}
        onOpenBalances={openBalances}
        onOpenSettings={openSettings}
        onOpenWallet={openWallet}
      />

      {/* Keep ReferralSection mounted (but hidden) so its sheets & listeners work from the menu */}
      <div className="hidden">
        <ReferralSection hasPreferredBadge={!badgesLoading && hasPreferred} />
      </div>
    </div>
  );
}
