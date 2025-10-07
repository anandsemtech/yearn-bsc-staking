// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: "class", // ← enable class-based dark mode
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
        "pulse-slow": { "0%, 100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
        shootingStar: {
          "0%": { transform: "translateY(-100vh) rotate(45deg)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(45deg)", opacity: "0" },
        },
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        "pulse-slow": "pulse-slow 4s ease-in-out infinite",
        "shooting-star": "shootingStar 3s linear infinite",
      },
    },
  },
  safelist: [
    { pattern: /^(w|h)-(4|5|6|7|8|9|10|11|12|14)$/ },
    { pattern: /^text-(purple|blue|green|orange|pink|cyan)-400$/ },
    { pattern: /^bg-(emerald|purple|blue|orange|green|pink|cyan)-400$/ },
    { pattern: /^from-(purple|blue|green|orange|pink|cyan)-(400|500|600)$/ },
    { pattern: /^to-(purple|blue|green|orange|pink|cyan)-(400|500|600)$/ },
    "from-emerald-400","to-cyan-400","from-purple-400","to-pink-400","from-blue-400","to-indigo-400","from-orange-400","to-red-400",
  ],
} satisfies Config;
