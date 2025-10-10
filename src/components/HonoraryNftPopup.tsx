import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import type { Transition } from "framer-motion";

type Item = {
  title: string;
  imageUrl: string | null | undefined;
  address: Address; // unique per badge
};

type Props = {
  items: Item[];                                // pass ONLY owned badges
  onClose: () => void;
  /** When user closes/minimizes, we’ll hand back the current hero so Header can show the chip */
  onMinimizeToHeader?: (hero: { title: string; imageUrl: string | null | undefined; address: Address }) => void;
  placeholderSrc?: string;
};

const spring: Transition = { type: "spring", stiffness: 360, damping: 32, mass: 0.9 };

const HonoraryNftPopup: React.FC<Props> = ({
  items,
  onClose,
  onMinimizeToHeader,
  placeholderSrc = "/images/placeholder.png",
}) => {
  const [heroIndex, setHeroIndex] = useState(0);
  const [showCongrats, setShowCongrats] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleMinimize();
      if (e.key === "ArrowRight") setHeroIndex((i) => (i + 1) % Math.max(items.length, 1));
      if (e.key === "ArrowLeft") setHeroIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const keyedItems = useMemo(() => {
    const seen: Record<string, number> = {};
    return items.map((it, i) => {
      const addr = it.address.toLowerCase();
      const count = (seen[addr] ?? 0) + 1;
      seen[addr] = count;
      const safeKey = count === 1 ? addr : `${addr}-${count}`;
      return { ...it, _key: safeKey, _i: i };
    });
  }, [items]);

  const hero = keyedItems[heroIndex];

  useEffect(() => {
    setShowCongrats(true);
    const t = setTimeout(() => setShowCongrats(false), 4000);
    return () => clearTimeout(t);
  }, [hero?._key]);

  const handleMinimize = () => {
    if (hero && onMinimizeToHeader) {
      onMinimizeToHeader({
        title: hero.title,
        imageUrl: hero.imageUrl || placeholderSrc,
        address: hero.address as Address,
      });
    }
    onClose();
  };

  const swipeTo = (dir: 1 | -1) => {
    setHeroIndex((i) => {
      const n = keyedItems.length || 1;
      return (i + dir + n) % n;
    });
  };

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key="honorary-popup-root"
        className="fixed inset-0 z-[80] flex items-center justify-center"
        aria-modal="true"
        role="dialog"
      >
        {/* background beams + scrim */}
        <motion.div
          key="honorary-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-[radial-gradient(1100px_520px_at_50%_-10%,rgba(255,186,0,0.14),transparent_60%)]"
        />
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleMinimize}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* dialog */}
        <motion.div
          key="honorary-dialog"
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.94, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.92, y: 8, filter: "blur(2px)" }}
          transition={spring}
          className="
            relative z-10 w-[min(96vw,1000px)] max-h-[92vh] overflow-hidden
            rounded-3xl bg-zinc-950/90 ring-1 ring-white/10
            shadow-[0_40px_120px_rgba(0,0,0,0.55)]
          "
        >
          {/* header */}
          <div className="
            flex items-center justify-between px-4 sm:px-6 py-4
            border-b border-white/10 bg-gradient-to-br from-white/5 to-transparent
          ">
            <div className="text-white font-semibold tracking-tight text-sm sm:text-base">
              🎖️ Honorary Badges
              <span className="ml-2 text-[11px] sm:text-xs text-white/60">({keyedItems.length})</span>
            </div>
            <button
              onClick={handleMinimize}
              className="rounded-lg px-2.5 py-1.5 text-white/85 hover:bg_white/10"
              aria-label="Minimize"
              title="Minimize"
            >
              ✕
            </button>
          </div>

          {/* content */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr]">
            {/* hero */}
            <div className="relative p-4 sm:p-6 flex items-center justify-center">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -z-10 left-1/2 top-1/3 -translate-x-1/2 w-[70%] h-[60%] rounded-full blur-3xl opacity-30 bg-[radial-gradient(circle_at_center,rgba(255,196,67,0.28),transparent_60%)]" />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {hero && (
                  <motion.div
                    key={`hero-wrap-${hero._key}`}
                    initial={{ opacity: 0, y: 16, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.985 }}
                    transition={spring}
                    className="relative w-full"
                  >
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      onDragEnd={(_, info) => {
                        if (info.offset.x > 90) swipeTo(-1);
                        else if (info.offset.x < -90) swipeTo(1);
                      }}
                      className="
                        mx-auto max-w-[88vw] md:max-w-[640px]
                        rounded-2xl ring-1 ring-white/15 bg-white/[0.04]
                        shadow-2xl overflow-hidden
                      "
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.995 }}
                    >
                      <img
                        src={hero.imageUrl || placeholderSrc}
                        alt={hero.title}
                        className="w-full h-auto max-h-[58vh] object-contain bg-transparent"
                      />
                    </motion.div>

                    <AnimatePresence>
                      {showCongrats && (
                        <motion.div
                          className="
                            pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2
                            rounded-full px-3 py-1 text-[11px] sm:text-xs
                            bg-white/12 text-white/90 ring-1 ring-white/20 backdrop-blur-md shadow-sm
                          "
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        >
                          ✅ New badge unlocked
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {showCongrats && (
                      <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2">
                        {[...Array(10)].map((_, i) => (
                          <motion.span
                            key={i}
                            className="inline-block select-none text-sm sm:text-base"
                            initial={{ opacity: 0, y: 0, x: 0, rotate: 0 }}
                            animate={{
                              opacity: [0, 1, 0],
                              y: [-4, -18 - i * 2],
                              x: (i - 5) * 8,
                              rotate: (i - 5) * 6,
                            }}
                            transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.015 }}
                          >
                            🎉
                          </motion.span>
                        ))}
                      </div>
                    )}

                    <div className="absolute bottom-3 sm:bottom-4 left-0 right-0 flex items-center justify-between gap-2 px-3 sm:px-4">
                      <button onClick={() => swipeTo(-1)} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/90">◀</button>
                      <div className="max-w-[70%] sm:max-w-none text-center text-white/95 text-sm sm:text-base font-medium px-2 truncate mx-2" title={hero.title}>
                        {hero.title}
                      </div>
                      <button onClick={() => swipeTo(1)} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/90">▶</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* thumbnails */}
            <div className="md:border-l md:border-white/10 md:p-4">
              <div className="md:hidden border-t border-white/10 px-3 py-3">
                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
                  {keyedItems.map((it, idx) => {
                    const active = idx === heroIndex;
                    return (
                      <motion.button
                        key={`thumb-m-${it._key}`}
                        onClick={() => setHeroIndex(idx)}
                        className={`relative rounded-xl ring-1 ring-white/10 overflow-hidden min-w-[92px] max-w-[92px] snap-start ${active ? "outline outline-2 outline-amber-300/60" : ""}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <img src={it.imageUrl || placeholderSrc} alt={it.title} className="aspect-square object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-black/45 text-[10px] text-white/85 px-2 py-1 truncate">{it.title}</div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div className="hidden md:block p-4 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-3 gap-3">
                  {keyedItems.map((it, idx) => {
                    const active = idx === heroIndex;
                    return (
                      <motion.button
                        key={`thumb-${it._key}`}
                        onClick={() => setHeroIndex(idx)}
                        className={`relative rounded-xl ring-1 ring-white/10 overflow-hidden ${active ? "outline outline-2 outline-amber-300/60" : ""}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <img src={it.imageUrl || placeholderSrc} alt={it.title} className="aspect-square object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-black/45 text-[11px] text-white/85 px-2 py-1 truncate">{it.title}</div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-white/[0.02] pb-[max(env(safe-area-inset-bottom),0px)]">
            <div className="text-[11px] sm:text-xs text-white/70">Tip: You can re-open this later from the header badge.</div>
            <div className="flex gap-2">
              <button onClick={handleMinimize} className="rounded-xl px-3 py-1.5 bg-white/8 hover:bg-white/12 text-white/90 text-sm">Close</button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HonoraryNftPopup;
