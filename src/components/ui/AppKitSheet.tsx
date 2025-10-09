// src/components/ui/AppKitSheet.tsx
import React, { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  zIndex?: number;        // default 2100 (above most UI, below any Wallet priority you set)
  maxHeightVh?: number;   // default 85
  children: React.ReactNode;
};

function portalTarget(): Element {
  return (
    document.getElementById("reown-appkit") ||
    document.getElementById("appkit-root") ||
    document.body
  );
}

export default function AppKitSheet({ open, onOpenChange, zIndex = 2100, maxHeightVh = 85, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const stylePanel: React.CSSProperties = {
    zIndex,
    maxHeight: `calc(${maxHeightVh}vh + env(safe-area-inset-bottom))`,
  };
  const styleBody: React.CSSProperties = {
    maxHeight: `calc(${maxHeightVh}vh - 44px)`,
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/50"
        style={{ zIndex: zIndex - 1 }}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed inset-x-0 bottom-0 border-t border-white/10 rounded-t-2xl bg-[#0a0f21] shadow-2xl translate-y-0 opacity-100 transition-transform duration-250 will-change-transform"
        style={stylePanel}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-4 pt-3 pb-2 border-b border-white/10">
          <div className="mx-auto h-1 w-12 rounded-full bg-white/15" />
        </div>
        <div className="px-4 overflow-y-auto" style={styleBody}>
          {children}
        </div>
      </div>
    </>,
    portalTarget()
  );
}
