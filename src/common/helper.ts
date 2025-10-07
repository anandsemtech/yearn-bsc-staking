// src/common/helper.ts
// Returns Tailwind gradient classes for our cards’ accent colors.
export function getColorClasses(color: string): string {
  switch (color) {
    case "blue":
      return "from-sky-500 to-indigo-600";
    case "purple":
      return "from-fuchsia-500 to-violet-600";
    case "green":
      return "from-emerald-500 to-teal-600";
    case "orange":
      return "from-amber-500 to-orange-600";
    default:
      return "from-slate-500 to-slate-700";
  }
}
