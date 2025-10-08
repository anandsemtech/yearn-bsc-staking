// src/routes/Dashboard.tsx
// Badge (NFT) detection happens here (not in the modal)
// Passes `hasAdvanced` and `honoraryItems` to StakingModal
import React, { useMemo, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import PackageCards, { PackageData } from "@/components/PackageCards";
import StakingModal from "@/components/StakingModal";
import ActivePackages from "@/components/ActivePackages";
import { useActiveStakes } from "@/hooks/useActiveStakes";
import { useHonoraryNft } from "@/hooks/useHonoraryNft";
import HonoraryNftPopup from "@/components/HonoraryNftPopup";
import type { Address } from "viem";

const YEARNCHAMPNFT = (import.meta.env.VITE_YEARNCHAMPNFT ||
  "0xb065ab52d4aE43dba2b8b87cf6F6873becD919a3") as Address;
const YEARNBUDDYNFT = (import.meta.env.VITE_YEARNBUDDYNFT ||
  "0x18A562d77336FAEca3C6c0dA157B94C80d5359bD") as Address;

const GlassPanel: React.FC<React.PropsWithChildren<{ title?: string; className?: string }>> = ({
  title,
  className,
  children,
}) => (
  <section
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
      <h2 className="text-lg font-semibold text-white mb-4 relative">{title}</h2>
    ) : null}

    <div className="relative">{children}</div>
  </section>
);

export default function Dashboard() {
  const [selectedPackage, setSelectedPackage] = useState<PackageData | null>(null);
  const { address } = useAccount();

  // Active stakes (cached + refreshable)
  const { rows, loading, error, refresh } = useActiveStakes({
    address,
    requireDirtyOrStale: true,
    softMaxAgeMs: 120_000,
    ttlMs: 60_000,
  });

  // Centralized Honorary NFT detection (no modal-side detection)
  const {
    badges,
    show,
    dismiss,
    dontAskAgain,
    loading: badgesLoading,
  } = useHonoraryNft({
    owner: address ?? null,
    contracts: [
      { address: YEARNCHAMPNFT, label: "YearnChamp" },
      { address: YEARNBUDDYNFT, label: "YearnBuddy" },
    ],
  });

  // Raw advanced flag + items from owned badges
  const hasAdvancedRaw = useMemo(() => (badges || []).some((b) => b.owned), [badges]);
  const honoraryItems = useMemo(
    () =>
      (badges || [])
        .filter((b) => b.owned)
        .map((b) => ({ title: b.label, imageUrl: b.imageUrl, address: b.address })),
    [badges]
  );

  // Small debounce to avoid flicker when badge state settles
  const [hasAdvanced, setHasAdvanced] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHasAdvanced(hasAdvancedRaw), 250);
    return () => clearTimeout(t);
  }, [hasAdvancedRaw]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Optional popup about owned badges */}
      {show && honoraryItems.length > 0 && (
        <HonoraryNftPopup
          items={honoraryItems}
          onClose={dismiss}
          onDontAskAgainAll={() => dontAskAgain("all")}
          onDontAskAgainSelected={(addrs) => dontAskAgain(addrs)}
        />
      )}

      <GlassPanel title="Available Packages" className="mt-8">
        <PackageCards onStakePackage={setSelectedPackage} />
      </GlassPanel>

      <GlassPanel title="Active Packages" className="mt-8">
        <ActivePackages
          rows={rows}
          loading={loading}
          error={error}
          onRefresh={refresh}
        />
      </GlassPanel>

      {selectedPackage && (
        <StakingModal
          package={selectedPackage}
          onClose={() => setSelectedPackage(null)}
          hasAdvanced={hasAdvanced && !badgesLoading}
          honoraryItems={honoraryItems}
        />
      )}
    </div>
  );
}
