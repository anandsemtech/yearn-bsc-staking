// src/components/HonoraryNftPopup.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import type { Transition } from "framer-motion";

type Item = {
  title: string;
  imageUrl: string | null | undefined;
  address: Address;
};

type Props = {
  items: Item[];
  onClose: () => void;
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
  const [flying, setFlying] = useState<null | { id: number; src: string; from: DOMRect; to: DOMRect }>(null);
  const flySeq = useRef(0);

  const dialogRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleMinimize();
      if (e.key === "ArrowRight") setHeroIndex((i) => (i + 1) % Math.max(items.length, 1));
      if (e.key === "ArrowLeft") setHeroIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [items.length]);

  // Stable, non-empty keys for items
  const keyedItems = useMemo(() => {
    return items.map((it, i) => {
      const addr = (it.address || "0x").toLowerCase();
      const base = addr && addr !== "0x" ? addr : `idx-${i}`;
      const titleSlug =
        (it.title || "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24) || `title-${i}`;
      return { ...it, _key: `${base}-${titleSlug}-${i}` };
    });
  }, [items]);

  const hero = keyedItems[heroIndex];

  const handleMinimize = () => {
    const anchor = document.getElementById("honorary-chip-anchor");
    const imgEl = heroImgRef.current;
    if (anchor && imgEl) {
      const from = imgEl.getBoundingClientRect();
      const to = anchor.getBoundingClientRect();
      const id = ++flySeq.current;
      setFlying({ id, src: (hero?.imageUrl || placeholderSrc) as string, from, to });
      setTimeout(() => {
        hero &&
          onMinimizeToHeader?.({
            title: hero.title,
            imageUrl: hero.imageUrl || placeholderSrc,
            address: hero.address as Address,
          });
        onClose();
      }, 480);
      return;
    }
    hero &&
      onMinimizeToHeader?.({
        title: hero.title,
        imageUrl: hero.imageUrl || placeholderSrc,
        address: hero.address as Address,
      });
    onClose();
  };

  const swipeTo = (dir: 1 | -1) => {
    setHeroIndex((i) => {
      const n = keyedItems.length || 1;
      return (i + dir + n) % n;
    });
  };

  return (
    <>
      {/* Fly-to-chip image (no AnimatePresence needed) */}
      {flying && (
        <motion.img
          key={`fly-${flying.id}`}
          src={flying.src}
          alt=""
          className="fixed z-[2000] rounded-xl shadow-lg ring-1 ring-white/25 bg-black/10 object-cover"
          initial={{
            left: flying.from.left,
            top: flying.from.top,
            width: flying.from.width,
            height: flying.from.height,
            opacity: 1,
          }}
          animate={{
            left: flying.to.left,
            top: flying.to.top,
            width: Math.max(32, flying.to.width),
            height: Math.max(32, flying.to.height),
            opacity: 0.9,
            borderRadius: 12,
          }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
        />
      )}

      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-[80]"
        aria-modal="true"
        role="dialog"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleMinimize} />
      </motion.div>

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8, filter: "blur(4px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.92, y: 8, filter: "blur(2px)" }}
        transition={spring}
        className="fixed inset-0 z-[90] flex items-center justify-center"
      >
        <div
          ref={dialogRef}
          className="relative w-[min(96vw,1000px)] max-h-[92vh] overflow-hidden rounded-3xl bg-zinc-950/90 ring-1 ring-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-gradient-to-br from-white/5 to-transparent">
            <div className="text-white font-semibold tracking-tight text-sm sm:text-base">
              🎖️ Honorary Badges
              <span className="ml-2 text-[11px] sm:text-xs text-white/60">({keyedItems.length})</span>
            </div>
            <button
              onClick={handleMinimize}
              className="rounded-lg px-2.5 py-1.5 text-white/85 hover:bg-white/10"
              aria-label="Minimize"
              title="Minimize"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr]">
            {/* Hero (single AnimatePresence with stable child key) */}
            <div className="relative p-4 sm:p-6 flex items-center justify-center">
              <AnimatePresence initial={false} mode="wait">
                {hero ? (
                  <motion.div
                    key={`hero-${hero._key}`}
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
                      className="mx-auto max-w-[88vw] md:max-w-[640px] rounded-2xl ring-1 ring-white/15 bg-white/[0.04] shadow-2xl overflow-hidden"
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.995 }}
                    >
                      <img
                        ref={heroImgRef}
                        src={hero.imageUrl || placeholderSrc}
                        alt={hero.title}
                        className="w-full h-auto max-h-[58vh] object-contain bg-transparent"
                      />
                    </motion.div>

                    <div className="absolute bottom-3 sm:bottom-4 left-0 right-0 flex items-center justify-between gap-2 px-3 sm:px-4">
                      <button
                        onClick={() => swipeTo(-1)}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/90"
                      >
                        ◀
                      </button>
                      <div
                        className="max-w-[70%] sm:max-w-none text-center text-white/95 text-sm sm:text-base font-medium px-2 truncate mx-2"
                        title={hero.title}
                      >
                        {hero.title}
                      </div>
                      <button
                        onClick={() => swipeTo(1)}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/90"
                      >
                        ▶
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hero-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-white/70 text-sm"
                  >
                    No badges yet.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Thumbnails */}
            <div className="md:border-l md:border-white/10 md:p-4">
              <div className="md:hidden border-t border-white/10 px-3 py-3">
                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
                  {keyedItems.map((it, idx) => {
                    const active = idx === heroIndex;
                    return (
                      <motion.button
                        key={`thumb-m-${it._key}`}
                        onClick={() => setHeroIndex(idx)}
                        className={`relative rounded-xl ring-1 ring-white/10 overflow-hidden min-w-[92px] max-w-[92px] snap-start ${
                          active ? "outline outline-2 outline-amber-300/60" : ""
                        }`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <img
                          src={it.imageUrl || placeholderSrc}
                          alt={it.title}
                          className="aspect-square object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/45 text-[10px] text-white/85 px-2 py-1 truncate">
                          {it.title}
                        </div>
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
                        className={`relative rounded-xl ring-1 ring-white/10 overflow-hidden ${
                          active ? "outline outline-2 outline-amber-300/60" : ""
                        }`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <img
                          src={it.imageUrl || placeholderSrc}
                          alt={it.title}
                          className="aspect-square object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/45 text-[11px] text-white/85 px-2 py-1 truncate">
                          {it.title}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-white/[0.02] pb-[max(env(safe-area-inset-bottom),0px)]">
            <div className="text-[11px] sm:text-xs text-white/70">
              You can re-open this later from the header badge.
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleMinimize}
                className="rounded-xl px-3 py-1.5 bg-white/8 hover:bg-white/12 text-white/90 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default HonoraryNftPopup;
