import { useEffect, useState } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { YEARNPASS1155_ABI } from "@/lib/abi";

/**
 * Reads balances for a set of ERC-1155 ids and returns the ids that are owned (>0).
 * If owner is null/undefined, returns [].
 */
export function usePassIds(owner: Address | null, passAddress: Address, tierIds: number[]) {
  const rpc = usePublicClient();
  const [owned, setOwned] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let stop = false;
    (async () => {
      if (!rpc || !owner || !passAddress || !Array.isArray(tierIds) || tierIds.length === 0) {
        setOwned([]);
        return;
      }
      setLoading(true);
      try {
        const balances = await Promise.all(
          tierIds.map((id) =>
            rpc.readContract({
              address: passAddress,
              abi: YEARNPASS1155_ABI,
              functionName: "balanceOf",
              args: [owner, BigInt(id)],
            }) as Promise<bigint>
          )
        );
        if (!stop) {
          const ids = tierIds.filter((_, i) => (balances[i] ?? 0n) > 0n);
          setOwned(ids);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [rpc, owner, passAddress, JSON.stringify(tierIds)]);

  return { owned, loading };
}
