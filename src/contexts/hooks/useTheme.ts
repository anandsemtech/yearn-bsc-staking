// src/contexts/hooks/useTheme.ts
import { useEffect } from "react";

export type Theme = "dark";

export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return {
    theme: "dark" as const,
    resolvedTheme: "dark" as const,
    setTheme: (_t: Theme) => {},
    toggleTheme: () => {},
  };
}
