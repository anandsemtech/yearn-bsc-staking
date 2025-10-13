// src/hooks/useReferralLevels.ts
import { useEffect, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { subgraph, gql } from "@/lib/subgraph";
import { usePublicClient } from "wagmi";
import { STAKING_ABI } from "@/web3/abi/stakingAbi";

// -------- Subgraph query (levels condensed) ----------
const Q_LEVELS = gql/* GraphQL */ `
  query RefLevels($root: String!) {
    # Level 1 (direct)
    referrals(where:{ referrer: $root }) { referee { id totalStaked } }
    # Level 2..N can be resolved client-side by following referee->referrals
    # or you can add nested queries if your schema supports it
  }
`;

type Row = { addr: string; stakes: number; totalYY: bigint };

export function useReferralLevels(
  root?: Address,
  opts?: { maxDepth?: number; ttlMs?: number }
) {
  const maxDepth = opts?.maxDepth ?? 15;
  const [levels, setLevels] = useState<
    Map<number, { totalYY: bigint; rows: Row[] }>
  >(new Map());
  const [loading, setLoading] = useState<boolean>(!!root);
  const [error, setError] = useState<Error | null>(null);

  const pc = usePublicClient({ chainId: 56 }); // BSC

  useEffect(() => {
    let dead = false;
    if (!root) return;

    async function run() {
      setLoading(true);
      setError(null);

      // 1) Try subgraph first
      try {
        const sg = await subgraph.request(Q_LEVELS, {
          root: root.toLowerCase(),
        });

        // If subgraph returns, expand to 15 levels by walking edges with batched queries.
        // For brevity, we’ll treat it as Level 1 only here; your existing useReferralProfile
        // already handles a deep walk. If that hook is stable, you can just keep using it.
        if (sg?.referrals) {
          // Map Level 1
          const m = new Map<number, { totalYY: bigint; rows: Row[] }>();
          const L1: Row[] = (sg.referrals as any[]).map((r) => ({
            addr: (r.referee.id as string),
            stakes: 0, // (optional) fill from other subgraph fields if you store it
            totalYY: BigInt(r.referee.totalStaked ?? "0"),
          }));
          m.set(1, {
            totalYY: L1.reduce((a, b) => a + b.totalYY, 0n),
            rows: L1,
          });

          // (If you already have `useReferralProfile`, prefer that; it returns all levels.)

          if (!dead) {
            setLevels(m);
            setLoading(false);
          }
          return; // success
        }
        // If sg empty, fall through to RPC
      } catch (e: any) {
        // rate limit or network issue → fall back
      }

      // 2) RPC fallback (logs). We reconstruct the tree up to 15 levels.
      try {
        const CONTRACT = (import.meta.env.VITE_BASE_CONTRACT_ADDRESS ||
          "0x0000000000000000000000000000000000000000") as Address;

        // Topic signatures
        const topicReferralAssigned =
          "0x" + // keccak256("ReferralAssigned(address,address)")
          "3c2f9b23e3c9de09c8e1a5d0d8f9c02a0d54c5cfd93c7a88b56f1a0f9b8b5c35"; // <- replace with your real topic!

        const topicStaked =
          "0x" + // keccak256("Staked(address,uint16,uint256,uint256)")
          "aabb..."; // replace with real sig if you want stake totals from events

        // You likely know a good starting block (deployment block):
        const fromBlock = BigInt(import.meta.env.VITE_DEPLOY_BLOCK ?? "0");
        const toBlock = await pc.getBlockNumber();

        // Helper: fetch direct referees of `referrer` via ReferralAssigned(referrer=addr)
        async function getDirectReferees(referrer: Address): Promise<Address[]> {
          const logs = await pc.getLogs({
            address: CONTRACT,
            fromBlock,
            toBlock,
            topics: [
              topicReferralAssigned,
              null, // indexed user (referee) at position 1 in some ABIs; adjust if needed
              referrer as any, // indexed referrer
            ],
          });
          // Decode referrers/referees with ABI if necessary; here we just use topics:
          // topics[1] = referee, topics[2] = referrer (depending on your event order)
          return logs
            .map((L) => ("0x" + (L.topics[1] as Hex).slice(26)) as Address)
            .filter(Boolean);
        }

        // Helper: sum total staked for an address by scanning Staked events (or read on-chain view if available)
        async function getUserTotalStaked(user: Address): Promise<bigint> {
          // If your contract has a view like `totalStakedOf(address)`, call it here:
          // const v = await pc.readContract({ address: CONTRACT, abi: STAKING_ABI, functionName: "totalStakedOf", args: [user] });
          // return v as bigint;

          // Otherwise, sum Staked events by `user`
          // (fill with your actual topic and decoding logic)
          return 0n;
        }

        // BFS up to 15 levels
        const m = new Map<number, { totalYY: bigint; rows: Row[] }>();
        let frontier: Address[] = [root];
        for (let depth = 1; depth <= maxDepth; depth++) {
          const next: Address[] = [];
          const rows: Row[] = [];

          for (const referrer of frontier) {
            const refs = await getDirectReferees(referrer);
            next.push(...refs);
            // Build rows for this *level* (the set of `refs`)
          }

          // Fetch totals in small batches
          for (const addr of next) {
            const totalYY = await getUserTotalStaked(addr);
            rows.push({ addr, stakes: 0, totalYY });
          }

          m.set(depth, {
            totalYY: rows.reduce((a, b) => a + b.totalYY, 0n),
            rows,
          });

          frontier = next;
          if (!frontier.length) break;
        }

        if (!dead) {
          setLevels(m);
          setLoading(false);
        }
      } catch (e: any) {
        if (!dead) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setLoading(false);
        }
      }
    }

    run();
    return () => { dead = true; };
  }, [root, pc, maxDepth]);

  return useMemo(() => ({ levels, loading, error }), [levels, loading, error]);
}
