import { useQuery } from "@tanstack/react-query";
import { gql, subgraphRequest } from "@/lib/subgraph";
import { formatEther } from "viem";

const Q = gql`
  query Packages {
    packages(orderBy: packageId, orderDirection: asc) {
      packageId
      durationInDays
      aprBps
      isActive
      minStakeAmount
      stakeMultiple
      monthlyUnstake
      monthlyAPRClaimable
      claimableInterval
      principalLocked
    }
  }
`;

type Pkg = {
  packageId: string;
  durationInDays: string;
  aprBps: string;
  isActive: boolean;
  minStakeAmount: string;      // wei
  stakeMultiple: string;       // wei
  monthlyUnstake: boolean;
  monthlyAPRClaimable: boolean;
  claimableInterval: string;   // seconds
  principalLocked: boolean;
};
type Resp = { packages: Pkg[] };

export type PackageUI = {
  id: string;
  name: string;            // configured name
  durationYears: number;
  durationLabel: string;   // e.g., "1 Year" / "3 Years"
  minAmount: number;
  apy: number;
  color: string;
  tag?: string;            // optional tag/badge

  // behavior fields for the card
  monthlyAPRClaimable: boolean;
  claimableIntervalSec: number;
  principalLocked: boolean;
  monthlyUnstake: boolean;
  stakeStep?: number;      // token units (e.g., 10, 1000, 5000) — undefined/1 => hide
};

const LS_KEY = "yy_packages_cache_v2";

/* ========= Configurable Names/Tags =========
   Options:
   1) Single CSV env:
      VITE_PKG_NAMES="Early Bird,10x Community,Founders,Infinity,..." (index = packageId)
      VITE_PKG_TAGS="Popular, ,Long-term, ,Promo,..."                 (optional)

   2) Per-index env (overrides CSV if present):
      VITE_PKG_NAME_0="Early Bird"
      VITE_PKG_NAME_1="10x Community"
      ...
      VITE_PKG_TAG_0="Popular"
      VITE_PKG_TAG_1="Promo"

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

const csv = (v?: string) => (v ? v.split(",").map(s => s.trim()) : []);
const ENV_NAMES = csv((import.meta as any).env?.VITE_PKG_NAMES);
const ENV_TAGS  = csv((import.meta as any).env?.VITE_PKG_TAGS);

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

function readLS<T>(): { t: number; data: T } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function usePackages(enabled: boolean) {
  return useQuery({
    queryKey: ["packages"],
    enabled,
    queryFn: async (): Promise<PackageUI[]> => {
      const res = await subgraphRequest<Resp>(Q, {}, 15_000);
      const pkgs = res.packages.filter((p) => p.isActive);

      const ui: PackageUI[] = pkgs.map((p) => {
        const idNum = Number(p.packageId);
        const apy = Number(p.aprBps) / 100; // bps -> %
        const years = Math.max(1, Math.round(Number(p.durationInDays) / 365));
        const minAmount = Number(formatEther(BigInt(p.minStakeAmount))); // tokens
        const claimableIntervalSec = Number(p.claimableInterval || "0");

        // stakeMultiple (wei -> tokens). If <=1, we hide in UI.
        const step = Number(formatEther(BigInt(p.stakeMultiple || "0")));
        const stakeStep = step > 1 ? Math.round(step) : undefined;

        return {
          id: String(idNum),
          name: getPackageName(idNum),
          durationYears: years,
          durationLabel: `${years} Year${years > 1 ? "s" : ""}`,
          minAmount,
          apy,
          color: "blue",
          tag: getPackageTag(idNum),

          monthlyAPRClaimable: !!p.monthlyAPRClaimable,
          claimableIntervalSec,
          principalLocked: !!p.principalLocked,
          monthlyUnstake: !!p.monthlyUnstake,
          stakeStep,
        };
      });

      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ t: Date.now(), data: ui }));
      } catch {}

      return ui;
    },
    initialData: readLS<PackageUI[]>()?.data,
  });
}
