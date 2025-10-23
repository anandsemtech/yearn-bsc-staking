// src/providers/AppKitProvider.tsx
import React, { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { bsc } from "@reown/appkit/networks";
import { http } from "viem";

declare global {
  // avoid duplicate AppKit init in HMR/dev
  var __APPKIT_CREATED__: boolean | undefined;
  // allow inspecting the instance in dev (e.g. appKit.getState().metadata)
  var appKit: ReturnType<typeof createAppKit> | undefined;
}

const queryClient = new QueryClient();

// ---------------------------
// Environment + Network setup
// ---------------------------
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string;
if (!projectId) {
  throw new Error("Missing VITE_REOWN_PROJECT_ID in environment");
}

const networks = [bsc] as [AppKitNetwork, ...AppKitNetwork[]];
const bscRpc =
  (import.meta.env.VITE_BSC_RPC_URL as string) ||
  "https://bsc-dataseed1.bnbchain.org";

// ---------------------------
//
// URL / metadata handling
//
// ---------------------------

/** Coerces any string into a valid origin ("https://" assumed if missing). */
const coerceOrigin = (v?: string) => {
  if (!v) return undefined;
  try {
    const u = new URL(v);
    return u.origin;
  } catch {
    try {
      const u2 = new URL(`https://${v}`);
      return u2.origin;
    } catch {
      return undefined;
    }
  }
};

const runtimeOrigin =
  typeof window !== "undefined" ? window.location.origin : undefined;
const envSite = coerceOrigin(
  import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined
);

// If running locally, prefer localhost; otherwise use runtime or env.
const fallback =
  runtimeOrigin?.includes("localhost") || runtimeOrigin?.includes("127.0.0.1")
    ? "http://localhost:5173"
    : "https://stake.yearntogether.com";

const siteOrigin = runtimeOrigin ?? envSite ?? fallback;

// ---------------------------
// Metadata (no more mismatch!)
// ---------------------------
const metadata = {
  name: "Yearn Staking — AppKit Starter",
  url: siteOrigin,
  icons: [
    `${siteOrigin}/assets/yearntogether.png`,
    `${siteOrigin}/assets/YearntogetherLight.svg`,
  ],
};


// ---------------------------
// Wagmi + AppKit setup
// ---------------------------
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: false,
  transports: {
    [bsc.id]: http(bscRpc),
  },
});

const appKitTheme = {
  themeMode: "dark" as const,
  themeVariables: {
    "--w3m-accent": "#6c5ce7",
    "--w3m-background": "#0b1020",
    "--w3m-overlay-background": "rgba(1,4,12,0.6)",
    "--w3m-color-mix": "#6c5ce7",
    "--w3m-color-mix-strength": 20,
    "--w3m-font-family":
      "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    "--w3m-text-color": "#e5e7eb",
    "--w3m-border-radius-master": "16px",
  },
};

// Create the AppKit instance only once
if (!globalThis.__APPKIT_CREATED__) {
  const instance = createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,
    features: {
      analytics: false,
      email: true,
      socials: ["google", "x", "discord", "apple"],
      emailShowWallets: true,
    },
    allWallets: "SHOW",
    ...appKitTheme,
  });

  // Expose for console debugging in dev (optional)
  if (import.meta.env.DEV) {
    globalThis.appKit = instance;
  }

  globalThis.__APPKIT_CREATED__ = true;
}

// ---------------------------
// Provider wrapper
// ---------------------------
export function AppKitProvider({ children }: PropsWithChildren) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
