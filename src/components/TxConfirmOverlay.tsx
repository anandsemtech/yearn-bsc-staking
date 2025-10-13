// src/components/TxConfirmOverlay.tsx
import React, { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { bsc } from "viem/chains";
import type { Hex } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

type Status = "idle" | "pending" | "success" | "error";

const DEFAULT_CELEBRATE_MS = 1600; // slightly longer so shower is visible
const WAIT_CONFIRMATIONS = 1;
const MAX_Z = 2147483647;

/* -------------------------------------------------------------
   Optional coin image (lazy-loaded to avoid top-level await)
------------------------------------------------------------- */
function useCoinImg() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    import("@/assets/yy-coin.png")
      .then((m) => mounted && setSrc(m.default as string))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);
  return src;
}

/* -------------------------------------------------------------
   Lightweight confetti shower (CSS keyframes + random seeds)
------------------------------------------------------------- */
type ConfettiPiece = {
  left: number; // 0..100 vw
  delay: number; // s
  duration: number; // s
  size: number; // px
  hue: number; // 0..360
  xDrift: number; // px
  rotate: number; // deg
};

function useConfettiSeeds(enabled: boolean, count = 80) {
  return useMemo<ConfettiPiece[]>(
    () =>
      enabled
        ? Array.from({ length: count }, () => ({
            left: Math.random() * 100,
            delay: Math.random() * 0.35, // small staggering
            duration: 1.2 + Math.random() * 0.9,
            size: 6 + Math.floor(Math.random() * 9),
            hue: Math.floor(Math.random() * 360),
            xDrift: (Math.random() - 0.5) * 120, // sway
            rotate: Math.random() * 360,
          }))
        : [],
    [enabled, count]
  );
}

/* -------------------------------------------------------------
   Ensure there's a top-level overlay root (outside app tree)
------------------------------------------------------------- */
function ensureOverlayRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById("overlay-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "overlay-root";
    document.body.appendChild(el);
  }
  // Inline critical styles so this works even before CSS loads
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    zIndex: String(MAX_Z),
    pointerEvents: "none",
    isolation: "isolate",
  } as CSSStyleDeclaration);
  return el;
}

const TxConfirmOverlay: React.FC = () => {
  const publicClient = usePublicClient({ chainId: bsc.id });

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [message, setMessage] = useState<string>("Waiting for confirmation…");

  // per-tx options from the event
  const [doneEvent, setDoneEvent] = useState<string | undefined>(undefined);
  const [celebrateMs, setCelebrateMs] = useState<number>(DEFAULT_CELEBRATE_MS);
  const [successText, setSuccessText] = useState<string>("Confirmed!");

  // portal target
  const overlayRoot = useMemo(() => ensureOverlayRoot(), []);
  const coinImgSrc = useCoinImg();

  // listen for open/close events from anywhere
  useEffect(() => {
    function onOpen(e: Event) {
      const { hash: h, text, successText, celebrateMs, doneEvent } =
        (e as CustomEvent).detail || {};

      if (!h) return;

      setHash(h);
      setMessage(text || "Waiting for confirmation…");
      setSuccessText(successText || "Confirmed!");
      setCelebrateMs(
        typeof celebrateMs === "number" && celebrateMs > 300
          ? celebrateMs
          : DEFAULT_CELEBRATE_MS
      );
      setDoneEvent(doneEvent);
      setStatus("pending");
      setOpen(true);
    }
    function onClose() {
      setOpen(false);
      setStatus("idle");
      setHash(null);
      setDoneEvent(undefined);
      setSuccessText("Confirmed!");
      setCelebrateMs(DEFAULT_CELEBRATE_MS);
    }
    window.addEventListener("txoverlay:open", onOpen as EventListener);
    window.addEventListener("txoverlay:close", onClose as EventListener);
    return () => {
      window.removeEventListener("txoverlay:open", onOpen as EventListener);
      window.removeEventListener("txoverlay:close", onClose as EventListener);
    };
  }, []);

  // when opened with a hash, wait for receipt → success → confetti → close
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!open || !hash || status !== "pending" || !publicClient) return;
      try {
        const rcpt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: WAIT_CONFIRMATIONS,
        });
        if (stop) return;

        if (rcpt.status === "reverted") {
          setStatus("error");
          setMessage("Transaction reverted");
          setTimeout(() => setOpen(false), 1100);
          return;
        }

        // SUCCESS → show burst + falling shower
        setStatus("success");
        setMessage(successText || "Confirmed!");

        // fire the requested “done” event (used by tables)
        if (doneEvent) window.dispatchEvent(new Event(doneEvent));
        // also keep generic refresh fan-out
        window.dispatchEvent(new Event("staking:updated"));
        window.dispatchEvent(new Event("active-packages:refresh"));
        window.dispatchEvent(new Event("stakes:changed"));

        setTimeout(() => {
          if (!stop) setOpen(false);
        }, celebrateMs);
      } catch {
        if (!stop) {
          setStatus("error");
          setMessage("Failed to confirm");
          setTimeout(() => setOpen(false), 1100);
        }
      }
    })();
    return () => {
      stop = true;
    };
  }, [open, hash, status, publicClient, celebrateMs, successText, doneEvent]);

  // generate seeds only while success is displayed (stable per open)
  const showerSeeds = useConfettiSeeds(open && status === "success");

  if (!open || !overlayRoot) return null;

  // ⬇️ Render ABOVE everything using a portal into #overlay-root
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="tx-confirm-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: MAX_Z, // <- sky high
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            // IMPORTANT: root should not block clicks outside toast if you want
            // pointerEvents: "none",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Falling shower (full screen) */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: MAX_Z,
            }}
          >
            <style>{`
              @keyframes confetti-fall {
                0%   { transform: translate3d(0,-110vh,0) rotate(0deg);   opacity: 0; }
                10%  { opacity: 1; }
                100% { transform: translate3d(var(--xdrift),105vh,0) rotate(var(--rot)); opacity: 0.9; }
              }
            `}</style>
            {status === "success" &&
              showerSeeds.map((p, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${p.left}vw`,
                    top: "-8vh",
                    width: `${p.size}px`,
                    height: `${Math.max(6, p.size * 1.2)}px`,
                    borderRadius: "3px",
                    background: `hsl(${p.hue} 85% 60%)`,
                    boxShadow: "0 0 8px rgba(255,255,255,.25)",
                    animation: `confetti-fall ${p.duration}s ease-in forwards`,
                    animationDelay: `${p.delay}s`,
                    transform: "translate3d(0,-110vh,0)",
                    // @ts-ignore custom CSS props
                    "--xdrift": `${p.xDrift}px`,
                    // @ts-ignore custom CSS props
                    "--rot": `${p.rotate + 360}deg`,
                  } as React.CSSProperties}
                />
              ))}
          </div>

          <motion.div
            className="relative w-[min(92vw,420px)] rounded-3xl p-6 bg-gray-900/95 text-white ring-1 ring-white/15 shadow-2xl overflow-hidden"
            initial={{ scale: 0.92, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            style={{ zIndex: MAX_Z + 1, pointerEvents: "auto" }} // ensure toast is clickable
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <motion.div
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-600/30 ring-1 ring-white/10 flex items-center justify-center"
                  animate={status === "pending" ? { rotate: 360 } : { rotate: 0 }}
                  transition={
                    status === "pending"
                      ? { repeat: Infinity, duration: 3, ease: "linear" }
                      : {}
                  }
                >
                  {coinImgSrc ? (
                    <img
                      src={coinImgSrc}
                      className="w-20 h-20 object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,.45)]"
                      alt="Y coin"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-500/70" />
                  )}
                </motion.div>

                {/* center burst on success */}
                <AnimatePresence>
                  {status === "success" && (
                    <motion.div
                      key="burst"
                      className="absolute inset-0 pointer-events-none"
                      initial={{ scale: 0, opacity: 0.9 }}
                      animate={{ scale: 1.45, opacity: 0 }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                    >
                      {[...Array(22)].map((_, i) => (
                        <span
                          key={i}
                          className="absolute inline-block w-1.5 h-3 rounded-[2px]"
                          style={{
                            left: "50%",
                            top: "50%",
                            transformOrigin: "left center",
                            transform: `rotate(${(i / 22) * 360}deg) translateX(22px)`,
                            background:
                              i % 3 === 0
                                ? "#34d399"
                                : i % 3 === 1
                                ? "#60a5fa"
                                : "#f472b6",
                            boxShadow: "0 0 8px rgba(255,255,255,.25)",
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-4 text-base font-semibold">{message}</div>
              <div className="mt-1 text-sm text-white/70">
                {status === "pending"
                  ? "Please keep this tab open."
                  : status === "success"
                  ? "Refreshing your positions…"
                  : "Something went wrong"}
              </div>

              <button
                onClick={() => setOpen(false)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 ring-1 ring-white/15"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    overlayRoot
  );
};

export default TxConfirmOverlay;
