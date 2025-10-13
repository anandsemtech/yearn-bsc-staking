import { useEffect, useMemo, useRef, useState } from "react";
import { gql, subgraphRequest, subgraph as subgraphShim } from "@/lib/subgraph";

export type LevelRow = { addr: string; stakes: number; totalYY: bigint };
export type Level = { level: number; totalYY: bigint; rows: LevelRow[] };

const Q = gql/* GraphQL */ `
  query LevelX($me: ID!, $depth: Int!, $first: Int!, $skip: Int!) {
    referralPaths(
      where: { ancestor: $me, depth: $depth }
      first: $first
      skip: $skip
    ) {
      descendant { id totalStaked }
    }
  }
`;

type Options = { perLevel?: number; maxLevels?: number };

export function useReferralLevelsFromSubgraph(
  address?: `0x${string}` | null,
  opts?: Options
) {
  const maxLevels = opts?.maxLevels ?? 15;
  const perLevel = opts?.perLevel ?? 1000;

  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState<Level[]>([]);
  const addrRef = useRef<string | null>(address ? address.toLowerCase() : null);

  useEffect(() => {
    addrRef.current = address ? address.toLowerCase() : null;
  }, [address]);

  useEffect(() => {
    const me = addrRef.current;
    if (!me) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const call =
          (typeof subgraphRequest === "function" && subgraphRequest) ||
          ((subgraphShim as any)?.request as (q: string, v: any) => Promise<any>);
        if (!call) throw new Error("lib/subgraph missing request()");

        // Fetch each depth 1..maxLevels. (Simple & reliable)
        const all: Level[] = [];
        for (let d = 1; d <= maxLevels; d++) {
          const data = await call(Q, { me, depth: d, first: perLevel, skip: 0 });
          const rowsRaw = (data?.referralPaths ?? []) as Array<{ descendant: { id: string; totalStaked: string } }>;

          // Dedupe by address in case of accidental dupes, and sum staked per referee.
          const map = new Map<string, bigint>();
          for (const r of rowsRaw) {
            const id = (r?.descendant?.id || "").toLowerCase();
            const amt = BigInt(r?.descendant?.totalStaked ?? "0");
            map.set(id, (map.get(id) ?? 0n) + amt);
          }

          const rows: LevelRow[] = Array.from(map.entries()).map(([addr, totalYY]) => ({
            addr,
            totalYY,
            // We don’t have stake count per referee in one shot; show 0 for now or
            // replace later with a stakes-count query if you really need it.
            stakes: 0,
          }));

          const totalYY = rows.reduce((acc, r) => acc + r.totalYY, 0n);
          all.push({ level: d, totalYY, rows });
        }

        if (!cancelled) setLevels(all);
      } catch {
        if (!cancelled) setLevels([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [maxLevels, perLevel]);

  return useMemo(() => ({ loading, levels }), [loading, levels]);
}
