// src/lib/referrer.ts
import { getAddress } from "viem";
import type { Address, PublicClient } from "viem";

const KEY = "yt_ref_qp_v1";

/** Strict 0x40 hex */
export const isAddr = (a?: string): a is `0x${string}` =>
  !!a && /^0x[a-fA-F0-9]{40}$/.test(a);

/** Case-insensitive equality */
export const eqAddr = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Save checksummed referrer (+ timestamp) */
export function setReferrer(addr: string) {
  if (!isAddr(addr)) return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        addr: getAddress(addr as `0x${string}`), // checksum
        t: Date.now(),
      })
    );
  } catch {}
}

/** Read checksummed referrer or null */
export function getReferrer(): `0x${string}` | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return isAddr(v?.addr) ? (getAddress(v.addr) as `0x${string}`) : null;
  } catch {
    return null;
  }
}

/** Remove stored referrer */
export function clearReferrer() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/**
 * Capture from current location's ?ref=… (case-insensitive key), strip quotes,
 * validate & store checksummed value. Returns the checksummed address or null.
 */
export function captureReferrerFromLocation(loc: Location = window.location) {
  try {
    const usp = new URLSearchParams(loc.search);
    // case-insensitive lookup for "ref"
    let qp = usp.get("ref");
    if (!qp) {
      for (const [k, v] of usp.entries()) {
        if (k.toLowerCase() === "ref") {
          qp = v;
          break;
        }
      }
    }
    if (qp) {
      qp = qp.trim().replace(/^"+|"+$/g, ""); // strip any quotes
      if (isAddr(qp)) {
        const checksummed = getAddress(qp as `0x${string}`);
        setReferrer(checksummed);
        return checksummed;
      }
    }
  } catch {}
  return null;
}

/** Convenience: was the stored/typed referrer equal to the connected wallet? */
export function isSelfReferral(
  user?: Address | null,
  ref?: string | null
): boolean {
  return !!user && !!ref && eqAddr(user, ref);
}

/**
 * On-chain eligibility check (shared by Dashboard sticker & StakingModal).
 * Rule: eligible if whitelisted OR userTotalStaked(addr) > 0.
 * If the contract doesn’t expose helpers / read fails, we default to "true".
 */
export async function isReferrerEligible(opts: {
  publicClient: PublicClient;
  stakingContract: Address;
  readsAbi: any; // ABI that includes isWhitelisted(address) and userTotalStaked(address)
  addr: Address;
}): Promise<boolean> {
  const { publicClient, stakingContract, readsAbi, addr } = opts;
  try {
    const [wl, staked] = await Promise.all([
      publicClient.readContract({
        address: stakingContract,
        abi: readsAbi,
        functionName: "isWhitelisted",
        args: [addr],
      }) as Promise<boolean>,
      publicClient.readContract({
        address: stakingContract,
        abi: readsAbi,
        functionName: "userTotalStaked",
        args: [addr],
      }) as Promise<bigint>,
    ]);
    return wl || staked > 0n;
  } catch {
    // Be permissive if helpers aren't available or read fails
    return true;
  }
}

/** Small UI helper: 0x1234…abcd */
export function shortAddr(a: string, tail = 6) {
  return isAddr(a) ? `${a.slice(0, 6)}…${a.slice(-tail)}` : a;
}
