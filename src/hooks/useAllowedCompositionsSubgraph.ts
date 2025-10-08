// src/hooks/useAllowedCompositionsSubgraph.ts
import { useQuery } from "@tanstack/react-query";
import { subgraphRequest, gql } from "@/lib/subgraph";

type CompositionRow = {
  yYearnPct: number;
  sYearnPct: number;
  pYearnPct: number;
};

export function useAllowedCompositionsFromSubgraph() {
  const query = gql`
    query Compositions {
      compositions(orderBy: index, orderDirection: asc) {
        index
        yYearnPct
        sYearnPct
        pYearnPct
      }
    }
  `;

  const { data, isLoading, error } = useQuery({
    queryKey: ["allowedCompositions"],
    queryFn: async () => {
      const res = await subgraphRequest<{ compositions: CompositionRow[] }>(query);
      return (
        res?.compositions?.map((c) => ({
          yYearnPct: Number(c.yYearnPct),
          sYearnPct: Number(c.sYearnPct),
          pYearnPct: Number(c.pYearnPct),
        })) ?? []
      );
    },
    refetchOnWindowFocus: false,
    staleTime: 30_000, // 30s cache freshness
  });

  return { compositions: data ?? [], isLoading, error };
}
