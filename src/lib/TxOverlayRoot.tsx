import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";

type OverlayData = {
  hash: string;
  text?: string;
  doneEvent?: string;
  successText?: string;
  celebrateMs?: number;
};

const MAX_Z = 2147483647;

export default function TxOverlayRoot() {
  const [overlay, setOverlay] = useState<OverlayData | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OverlayData>).detail;
      setOverlay(detail);

      // fire confetti at open
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          zIndex: MAX_Z,
        });
      } catch {}
    };

    const onClose = () => setOverlay(null);

    window.addEventListener("txoverlay:open", onOpen);
    window.addEventListener("txoverlay:close", onClose);
    return () => {
      window.removeEventListener("txoverlay:open", onOpen);
      window.removeEventListener("txoverlay:close", onClose);
    };
  }, []);

  // auto-close after celebrateMs
  useEffect(() => {
    if (!overlay) return;
    const t = setTimeout(() => {
      if (overlay.doneEvent) window.dispatchEvent(new Event(overlay.doneEvent));
      setOverlay(null);
    }, overlay.celebrateMs ?? 1800);
    return () => clearTimeout(t);
  }, [overlay]);

  if (!overlay) return null;

  const root = document.getElementById("overlay-root");
  if (!root) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: MAX_Z,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.75)",
          color: "white",
          padding: "12px 18px",
          borderRadius: "12px",
          fontSize: "14px",
          pointerEvents: "auto",
          boxShadow: "0 10px 40px -10px rgba(0,0,0,0.6)",
        }}
      >
        {overlay.text || "Transaction submitted…"}
      </div>
    </div>,
    root
  );
}
