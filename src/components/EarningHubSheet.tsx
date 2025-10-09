// src/components/EarningHubSheet.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, X, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useAppKit } from "@reown/appkit/react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** e.g. "MetaMask" */
  walletName?: string;
  /** app logo URL or JSX */
  logo?: React.ReactNode;
  /** Primary click handler (fallback if AppKit not available) */
  onOpenApp?: () => void;
  /** Optional deep link to copy (or current URL if omitted) */
  deepLink?: string;
  /** Render on mobile only (default true) */
  mobileOnly?: boolean;
};

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

const EarningHubSheet: React.FC<Props> = ({
  open,
  onClose,
  walletName = "Wallet",
  logo,
  onOpenApp,
  deepLink,
  mobileOnly = true,
}) => {
  const { open: openAppKit } = useAppKit?.() ?? ({ open: undefined } as any);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const shouldRender = useMemo(() => {
    return open && (!mobileOnly || isMobileViewport());
  }, [open, mobileOnly]);

  // Body scroll lock
  useEffect(() => {
    if (!shouldRender) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [shouldRender]);

  // ESC to close
  useEffect(() => {
    if (!shouldRender) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shouldRender, onClose]);

  // Focus on open
  useEffect(() => {
    if (shouldRender && containerRef.current) {
      containerRef.current.focus();
    }
  }, [shouldRender]);

  if (typeof document === "undefined") return null;
  const root = document.body;

  const dl = deepLink || (typeof window !== "undefined" ? window.location.href : "");

  const handleOpen = async () => {
    // Prefer AppKit’s modal if available (smooth handoff to mobile wallet)
    if (typeof openAppKit === "function") {
      try { await openAppKit(); } catch {}
    } else if (typeof onOpenApp === "function") {
      onOpenApp();
    } else {
      // Fallback: try opening the deep link in a new tab
      try { window.open(dl, "_blank", "noopener,noreferrer"); } catch {}
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(dl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {}
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={[
          "fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity",
          shouldRender ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${walletName} connect`}
        tabIndex={-1}
        ref={containerRef}
        className={[
          "fixed z-[91]",
          "bottom-0 left-0 right-0",
          "md:hidden",                    // mobile only UI shell
          "rounded-t-2xl border border-white/10",
          "bg-[#141824] text-white",
          "shadow-2xl",
          "transition-transform duration-300",
          shouldRender ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{
          // Respect safe area on modern phones
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-transparent px-4 pt-3 pb-2">
          <div className="flex items-center">
            <span className="inline-flex h-6 w-12 items-center justify-center rounded-full bg-white/10">
              <GripHorizontal className="h-4 w-4 text-gray-300" />
            </span>
            <button
              onClick={onClose}
              className="ml-auto inline-flex items-center justify-center rounded-lg p-2 text-gray-300 hover:text-white hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-3">
          <div className="text-center">
            <div className="inline-flex items-center gap-3">
              {logo ?? (
                <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-lg">
                  🦊
                </div>
              )}
              <div className="text-lg font-semibold">{walletName}</div>
            </div>

            <p className="mt-3 text-sm text-gray-300">
              Continue in {walletName}. Open and continue in the wallet app.
            </p>

            <div className="mt-5">
              <button
                onClick={handleOpen}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold border border-white/15 bg-white/10 hover:bg-white/15"
              >
                <span>Open</span>
              </button>

              <button
                onClick={copy}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm border border-white/10 text-gray-200 hover:bg-white/5"
                title="Copy deep link"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-gray-300" />}
                <span>{copied ? "Copied" : "Copy link"}</span>
              </button>
            </div>
          </div>

          {/* Footer / caption */}
          <div className="mt-6 flex items-center justify-center">
            <span className="text-[11px] text-gray-400">UX by&nbsp;</span>
            <span className="text-[11px] text-gray-200 rounded-full bg-white/10 px-2 py-0.5">reown</span>
          </div>
        </div>
      </div>
    </>,
    root
  );
};

export default EarningHubSheet;
