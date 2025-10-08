// src/components/HonoraryNftPopup.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { motion, AnimatePresence } from "framer-motion";

type Item = {
  title: string;
  imageUrl: string | null | undefined;
  address: Address; // unique per badge
};

type Props = {
  items: Item[];                                // pass ONLY owned badges
  onClose: () => void;
  onDontAskAgainAll?: () => void;
  onDontAskAgainSelected?: (addresses: Address[]) => void;
  placeholderSrc?: string;
};

const HonoraryNftPopup: React.FC<Props> = ({
  items,
  onClose,
  onDontAskAgainAll,
  onDontAskAgainSelected,
  placeholderSrc = "/images/placeholder.png",
}) => {
  const [muteMap, setMuteMap] = useState<Record<string, boolean>>({});
  const [heroIndex, setHeroIndex] = useState(0);

  // focus trap + ESC close
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setHeroIndex((i) => (i + 1) % Math.max(items.length, 1));
      if (e.key === "ArrowLeft") setHeroIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, items.length]);

  // De-dupe keys (defensive): if the same address appears twice, suffix the index.
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

  const toggleMute = (addrKey: string) =>
    setMuteMap((m) => ({ ...m, [addrKey]: !m[addrKey] }));

  const selectedForMute = useMemo(
    () => Object.entries(muteMap).filter(([_, on]) => on).map(([k]) => k as Address),
    [muteMap]
  );

  return (
    <AnimatePresence initial={false} mode="wait">
      {/* Single presence child with a stable key */}
      <motion.div
        key="honorary-popup-root"
        className="fixed inset-0 z-[80] flex items-center justify-center"
        aria-modal="true"
        role="dialog"
      >
        {/* Backdrop */}
        <motion.div
          key="honorary-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black"
          onClick={onClose}
        />

        {/* Dialog */}
        <motion.div
          key="honorary-dialog"
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 6 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="relative z-10 w-[min(92vw,980px)] max-h-[86vh] overflow-hidden rounded-2xl bg-zinc-900/95 ring-1 ring-white/10 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div className="text-white/90 font-semibold">
              Honorary Badges
              <span className="ml-2 text-xs text-white/50">({keyedItems.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {onDontAskAgainAll && (
                <button
                  onClick={onDontAskAgainAll}
                  className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/70"
                >
                  Don’t show again (all)
                </button>
              )}
              {onDontAskAgainSelected && (
                <button
                  onClick={() => onDontAskAgainSelected(selectedForMute)}
                  className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/70"
                >
                  Don’t show selected
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-md px-2 py-1 text-white/70 hover:bg-white/10"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-0">
            {/* Hero */}
            <div className="relative p-5 flex items-center justify-center">
              <AnimatePresence mode="wait" initial={false}>
                {hero && (
                  <motion.img
                    key={`hero-${hero._key}`}
                    src={hero.imageUrl || placeholderSrc}
                    alt={hero.title}
                    className="max-h-[60vh] w-auto object-contain rounded-xl ring-1 ring-white/10 bg-white/5"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                  />
                )}
              </AnimatePresence>
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between gap-3">
                <button
                  onClick={() =>
                    setHeroIndex((i) => (i - 1 + keyedItems.length) % Math.max(keyedItems.length, 1))
                  }
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80"
                >
                  ◀
                </button>
                <div className="text-white/70 text-sm">
                  {hero ? hero.title : "—"}
                </div>
                <button
                  onClick={() =>
                    setHeroIndex((i) => (i + 1) % Math.max(keyedItems.length, 1))
                  }
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* Thumbnails + mute */}
            <div className="p-4 border-l border-white/10 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-3 gap-3">
                {keyedItems.map((it, idx) => {
                  const active = idx === heroIndex;
                  return (
                    <motion.button
                      key={`thumb-${it._key}`}
                      onClick={() => setHeroIndex(idx)}
                      className={`relative rounded-lg ring-1 ring-white/10 overflow-hidden ${
                        active ? "outline outline-2 outline-white/40" : ""
                      }`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                    >
                      <img
                        src={it.imageUrl || placeholderSrc}
                        alt={it.title}
                        className="aspect-square object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/40 text-[11px] text-white/80 px-2 py-1 truncate">
                        {it.title}
                      </div>
                      <label className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded text-[10px] text-white/80">
                        <input
                          type="checkbox"
                          checked={!!muteMap[it._key]}
                          onChange={() => toggleMute(it._key)}
                          className="accent-white/80"
                        />
                        mute
                      </label>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HonoraryNftPopup;
