import { useEffect, useMemo, useState } from "react";
import { captureReferrerFromLocation, getReferrer, clearReferrer, isAddr } from "@/lib/referrer";
import type { Address } from "viem";
import { bsc } from "viem/chains";
import { createPublicClient, http } from "viem";

const STAKING_READS_ABI = [
  { type: "function", name: "isWhitelisted", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "userTotalStaked", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const stakingContract = (import.meta.env.VITE_BASE_CONTRACT_ADDRESS ?? "") as Address;

const pc = createPublicClient({
  chain: bsc,
  transport: http(import.meta.env.VITE_BSC_RPC_URL || "https://bsc-dataseed1.bnbchain.org"),
});

export function useStickyReferrer(options?: { autorunCapture?: boolean }) {
  const { autorunCapture = true } = options ?? {};
  const [referrer, setReferrer] = useState<`0x${string}` | null>(() => getReferrer());
  const [checking, setChecking] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);

  // 1) capture from current URL once (welcome or dashboard, connected or not)
  useEffect(() => {
    if (!autorunCapture) return;
    const v = captureReferrerFromLocation();
    if (v) setReferrer(v);
  }, [autorunCapture]);

  // 2) validate (whitelisted OR has staked before)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!referrer || !isAddr(referrer) || !stakingContract) {
        setValid(null);
        return;
      }
      setChecking(true);
      try {
        const [wl, staked] = await Promise.all([
          pc.readContract({ address: stakingContract, abi: STAKING_READS_ABI, functionName: "isWhitelisted", args: [referrer] }) as Promise<boolean>,
          pc.readContract({ address: stakingContract, abi: STAKING_READS_ABI, functionName: "userTotalStaked", args: [referrer] }) as Promise<bigint>,
        ]);
        if (!cancelled) setValid(Boolean(wl || (staked ?? 0n) > 0n));
      } catch {
        // If helpers not available on-chain, do not block UX
        if (!cancelled) setValid(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [referrer]);

  return useMemo(() => ({
    referrer, setReferrer, checking, valid,
    clear: () => { clearReferrer(); setReferrer(null); setValid(null); },
  }), [referrer, checking, valid]);
}
