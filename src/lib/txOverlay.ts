// src/lib/txOverlay.ts
import type { Hex } from "viem";

type TxOverlayOptions = {
  /** Event name to dispatch on success (e.g. "apr:claimed", "unstaked", "stake:confirmed") */
  doneEvent?: string;
  /** Message to show when confirmed */
  successText?: string;
  /** How long to keep the success/confetti visible (ms) */
  celebrateMs?: number;
};

export function openTxOverlay(hash: Hex, text?: string, opts?: TxOverlayOptions) {
  window.dispatchEvent(
    new CustomEvent("txoverlay:open", {
      detail: {
        hash,
        text,
        ...opts,
      },
    }),
  );
}

export function closeTxOverlay() {
  window.dispatchEvent(new Event("txoverlay:close"));
}
