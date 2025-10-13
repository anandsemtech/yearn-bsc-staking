// src/hooks/usePackages.ts
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";
import { bsc } from "viem/chains";
import { STAKING_ABI } from "@/web3/abi/stakingAbi";

/* ========= On-chain env ========= */
const PROXY =
  (import.meta.env.VITE_BASE_CONTRACT_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as const);

/* ========= UI types ========= */
export type PackageUI = {
  id: string;
  name: string;
  durationYears: number;
  durationLabel: string;
  minAmount: number;
  apy: number;
  color: string;
  tag?: string;

  // behavior fields for the card
  monthlyAPRClaimable: boolean;
  claimableIntervalSec: number;
  principalLocked: boolean;
  monthlyUnstake: boolean;
  stakeStep?: number; // token units (hide if <=1 or undefined)
};

/* ========= Configurable Names/Tags =========
   Options:
   1) Single CSV env:
      VITE_PKG_NAMES="Early Bird,10x Community,Founders,Infinity,..."
      VITE_PKG_TAGS="Popular, ,Long-term, ,Promo,..."

   2) Per-index env (overrides CSV if present):
      VITE_PKG_NAME_0="Early Bird"
      VITE_PKG_TAG_0="Popular"

   3) Hardcoded defaults below.
*/
const DEFAULT_NAMES = [
  "Early Bird",
  "10x Community",
  "Founders",
  "Infinity",
  "Sapphire",
  "Emerald",
  "Topaz",
  "Platinum",
  "Prime",
  "Legend",
];

const DEFAULT_TAGS = [
  "Popular",
  undefined,
  "Long-term",
  undefined,
  "Popular",
  undefined,
  undefined,
  "Promo",
  undefined,
  undefined,
];

const csv = (v?: string) => (v ? v.split(",").map((s) => s.trim()) : []);
const ENV_NAMES = csv((import.meta as any).env?.VITE_PKG_NAMES);
const ENV_TAGS = csv((import.meta as any).env?.VITE_PKG_TAGS);

export function getPackageName(idx: number): string {
  const byIdx = (import.meta as any).env?.[`VITE_PKG_NAME_${idx}`];
  if (byIdx && byIdx.trim()) return byIdx.trim();
  if (ENV_NAMES[idx] && ENV_NAMES[idx].length) return ENV_NAMES[idx];
  return DEFAULT_NAMES[idx] ?? `Package #${idx}`;
}

export function getPackageTag(idx: number): string | undefined {
  const byIdx = (import.meta as any).env?.[`VITE_PKG_TAG_${idx}`];
  if (byIdx && byIdx.trim()) return byIdx.trim();
  if (ENV_TAGS[idx] && ENV_TAGS[idx].length) return ENV_TAGS[idx];
  return DEFAULT_TAGS[idx];
}

/* ========= Local cache seed (optional) ========= */
const LS_KEY = "yy_packages_cache_v2";
function readLS<T>(): { t: number; data: T } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ========= On-chain shapes (from contract) =========
struct Package {
  uint16 id;
  uint16 durationInDays;
  uint16 apr; // basis points
  bool monthlyUnstake;
  bool isActive;
  uint256 minStakeAmount;
  uint16 monthlyPrincipalReturnPercent;
  bool monthlyAPRClaimable;
  uint256 claimableInterval;
  uint256 stakeMultiple;
  bool principalLocked;
}
*/
type OnchainPkgTuple = [
  bigint, // id
  bigint, // durationInDays
  bigint, // apr (bps)
  boolean, // monthlyUnstake
  boolean, // isActive
  bigint, // minStakeAmount (wei)
  bigint, // monthlyPrincipalReturnPercent (bps) - not used here for UI
  boolean, // monthlyAPRClaimable
  bigint, // claimableInterval (sec)
  bigint, // stakeMultiple (wei)
  boolean // principalLocked
];

export function usePackages(enabled: boolean) {
  const publicClient = usePublicClient({ chainId: bsc.id });

  return useQuery({
    queryKey: ["packages:onchain", PROXY, bsc.id],
    enabled: !!publicClient && enabled,
    queryFn: async (): Promise<PackageUI[]> => {
      if (!publicClient) return [];

      // 1) Fetch total number of packages configured
      const nextPackageId = (await publicClient.readContract({
        abi: STAKING_ABI as any,
        address: PROXY,
        functionName: "nextPackageId",
        args: [], // ✅ required even if the function has no params

      })) as bigint;

      const n = Number(nextPackageId ?? 0n);
      if (n <= 0) return [];

      // 2) Read all package structs
      const calls = Array.from({ length: n }, (_, i) => ({
        address: PROXY,
        abi: STAKING_ABI as any,
        // You can use either "getPackageDetails" or the public mapping getter "packages"
        // functionName: "getPackageDetails",
        // args: [BigInt(i)],
        functionName: "packages",
        args: [BigInt(i)],
      }));

      const results = (await publicClient.multicall({
        allowFailure: true, // tolerate holes if any
        contracts: calls,
      })) as { status: "success" | "failure"; result?: OnchainPkgTuple }[];

      // 3) Map to UI
      const ui: PackageUI[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status !== "success" || !r.result) continue;
        const p = r.result;

        const isActive = Boolean(p[4]);
        if (!isActive) continue;

        const idNum = Number(p[0]);
        const durationDays = Number(p[1] ?? 0n);
        const apy = Number(p[2] ?? 0n) / 100; // bps -> %
        const minAmount = Number(formatEther(p[5] ?? 0n));
        const monthlyAPRClaimable = Boolean(p[7]);
        const claimableIntervalSec = Number(p[8] ?? 0n);
        const stakeMultipleTokens = Number(formatEther(p[9] ?? 0n));
        const principalLocked = Boolean(p[10]);
        const monthlyUnstake = Boolean(p[3]);

        const years = Math.max(1, Math.round(durationDays / 365));
        const name = getPackageName(idNum);
        const tag = getPackageTag(idNum);

        const stakeStep = stakeMultipleTokens > 1 ? Math.round(stakeMultipleTokens) : undefined;

        ui.push({
          id: String(idNum),
          name,
          durationYears: years,
          durationLabel: `${years} Year${years > 1 ? "s" : ""}`,
          minAmount,
          apy,
          color: "blue",
          tag,
          monthlyAPRClaimable,
          claimableIntervalSec,
          principalLocked,
          monthlyUnstake,
          stakeStep,
        });
      }

      // 4) Persist a soft cache (like before)
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ t: Date.now(), data: ui }));
      } catch {}

      // Sort by id asc (to match original)
      ui.sort((a, b) => Number(a.id) - Number(b.id));
      return ui;
    },
    initialData: readLS<PackageUI[]>()?.data,
  });
}
