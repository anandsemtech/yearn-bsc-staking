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
  packageId: string; durationInDays: string; aprBps: string; isActive: boolean;
  minStakeAmount: string; stakeMultiple: string; monthlyUnstake: boolean;
  monthlyAPRClaimable: boolean; claimableInterval: string; principalLocked: boolean;
};
type Resp = { packages: Pkg[] };

const LS_KEY = "yy_packages_cache_v2";

function readLS(): { t: number; data: any[] } | null {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function usePackages(enabled: boolean) {
  return useQuery({
    queryKey: ["packages"],
    enabled,
    queryFn: async () => {
      const res = await subgraphRequest<Resp>(Q, {}, 15_000);
      const pkgs = res.packages.filter(p => p.isActive);
      const ui = pkgs.map((p) => {
        const apy = Number(p.aprBps) / 100; // bps -> %
        const years = Math.max(1, Math.round(Number(p.durationInDays) / 365));
        const min = Number(formatEther(BigInt(p.minStakeAmount)));
        return {
          id: String(Number(p.packageId)),
          name: `${years} Year Package`,
          durationYears: years,
          minAmount: min,
          apy,
          color: "blue",
          tag: "Popular",
        };
      });
      try { localStorage.setItem(LS_KEY, JSON.stringify({ t: Date.now(), data: ui })); } catch {}
      return ui;
    },
    // Use LS as "initialData" (renders instantly if user visited before)
    initialData: (() => readLS()?.data)(),
  });
}
