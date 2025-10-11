// src/common/helper.ts
// Restored classic gradients — same order & tone as before

export function getColorClasses(key: string | number) {
  const index = typeof key === "number" ? key : parseInt(key) || 0;
  const palette = [
    "from-sky-500 to-indigo-500",     // blue gradient (cool tone)
    "from-fuchsia-500 to-purple-500", // purple gradient (vivid)
    "from-emerald-500 to-teal-500",   // green gradient (calm)
    "from-orange-500 to-amber-500",   // orange gradient (warm)
  ];
  return palette[index % palette.length];
}

/**
 * Optional: a light accent for subtle backgrounds or outlines.
 * Used by some UI sections to create harmony with the gradients.
 */
export function getSoftColor(key: string | number) {
  const index = typeof key === "number" ? key : parseInt(key) || 0;
  const palette = [
    "text-sky-400",
    "text-fuchsia-400",
    "text-emerald-400",
    "text-orange-400",
  ];
  return palette[index % palette.length];
}
