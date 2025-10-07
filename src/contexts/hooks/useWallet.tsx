// src/contexts/hooks/useWallet.ts
import React, { createContext, useContext, useMemo, useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";

/** Shape used across your components */
export type WalletUser = {
  address?: Address | null;

  // Optional affiliate/UX fields used around the app
  starLevel?: number;
  totalVolume?: number;
  totalReferrals?: number;
  directReferrals?: number;
  levelUsers?: Record<number, number>;
  isGoldenStar?: boolean;
  goldenStarProgress?: number;

  // Optional staking list placeholder
  activePackages?: unknown[];
};

export type WalletContextShape = {
  user: WalletUser | null;
  setUser: React.Dispatch<React.SetStateAction<WalletUser | null>>;
  /** Optional refresh hooks used by some components; safe no-ops by default */
  refreshWallet: () => void;
  refreshTokenBalances: () => void;
};

const WalletContext = createContext<WalletContextShape | null>(null);

/**
 * Provider (optional): If you wrap your app with it you can enrich `user`
 * from subgraph/contract. If you don’t, `useWallet()` gracefully falls back
 * to wagmi so nothing breaks.
 */
export const WalletProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { address } = useAccount();
  const [user, setUser] = useState<WalletUser | null>(() => ({
    address: (address ?? null) as Address | null,
    starLevel: 0,
    totalVolume: 0,
    totalReferrals: 0,
    directReferrals: 0,
    levelUsers: { 1: 0, 2: 0, 3: 0, 4: 0 },
    isGoldenStar: false,
    goldenStarProgress: 0,
    activePackages: [],
  }));

  // Keep address in sync with wagmi
  React.useEffect(() => {
    setUser((prev) => ({ ...(prev || {}), address: (address ?? null) as Address | null }));
  }, [address]);

  const value = useMemo<WalletContextShape>(
    () => ({
      user,
      setUser,
      refreshWallet: () => {
        // plug in subgraph/contract refresh here later
      },
      refreshTokenBalances: () => {
        // plug in token balances refresh here later
      },
    }),
    [user]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

/**
 * Hook: If no provider is mounted, returns a safe fallback derived from wagmi,
 * so existing components keep working without extra wiring.
 */
export function useWallet(): WalletContextShape {
  const ctx = useContext(WalletContext);
  if (ctx) return ctx;

  // Fallback mode (no provider)
  const { address } = useAccount();
  const fallback: WalletContextShape = {
    user: {
      address: (address ?? null) as Address | null,
      starLevel: 0,
      totalVolume: 0,
      totalReferrals: 0,
      directReferrals: 0,
      levelUsers: { 1: 0, 2: 0, 3: 0, 4: 0 },
      isGoldenStar: false,
      goldenStarProgress: 0,
      activePackages: [],
    },
    setUser: () => {
      /* no-op without provider */
    },
    refreshWallet: () => {
      /* no-op without provider */
    },
    refreshTokenBalances: () => {
      /* no-op without provider */
    },
  };
  return fallback;
}
