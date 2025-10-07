// src/routes/Dashboard.tsx
import React from "react";
import PackageCards, { PackageData } from "@/components/PackageCards";

/* A tiny glass panel shell so it looks like the rest of your app */
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
      style={{ background: "linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.02))" }}
    />
    {title ? <h2 className="text-lg font-semibold text-white mb-4 relative">{title}</h2> : null}
    <div className="relative">{children}</div>
  </section>
);

const Dashboard: React.FC = () => {
  // We’ll wire staking later; for now just acknowledge the click
  const handleStakePackage = (pkg: PackageData) => {
    console.debug("[PackageCards] Stake clicked:", pkg);
    // TODO: integrate StakingModal once we finish contract writes
    // setSelectedPackage(pkg); setShowStakingModal(true);
  };

  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8
                 bg-[radial-gradient(1100px_600px_at_50%_-200px,rgba(125,106,255,0.12),transparent)]
                 bg-[length:100%_auto]"
    >
      <GlassPanel title="Available Packages">
        <PackageCards onStakePackage={handleStakePackage} />
      </GlassPanel>
    </div>
  );
};

export default Dashboard;
