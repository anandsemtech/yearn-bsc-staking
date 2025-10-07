// src/providers/AppKitProvider.tsx
import React, { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { bsc } from "@reown/appkit/networks";

declare global {
  var __APPKIT_CREATED__: boolean | undefined;
}

const queryClient = new QueryClient();

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string;
if (!projectId) {
  throw new Error("Missing VITE_REOWN_PROJECT_ID in environment");
}

const networks = [bsc] as [AppKitNetwork, ...AppKitNetwork[]];

const metadata = {
  name: "Yearn Staking — AppKit Starter",
  description: "Minimal connect → dashboard scaffold using Reown AppKit + Wagmi",
  url:
    (import.meta.env.VITE_PUBLIC_SITE_URL as string) ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173"),
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: false,
  // transports: {
  //   [bsc.id]: http(import.meta.env.VITE_BSC_RPC_URL || "https://bsc-dataseed1.bnbchain.org")
  // }
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

if (!globalThis.__APPKIT_CREATED__) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,
    features: { analytics: true },
    ...appKitTheme,
  });
  globalThis.__APPKIT_CREATED__ = true;
}

export function AppKitProvider({ children }: PropsWithChildren) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
