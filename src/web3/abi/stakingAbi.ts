// src/web3/abi/stakingAbi.ts
import rawAbi from "./abi.json";


import type { Abi, AbiEvent, AbiFunction, AbiParameter } from "viem";
import type { AbiError } from "abitype";

/**
 * Custom errors from YearnTogetherEventsAndErrors.
 * IMPORTANT: Solidity enums (TransferContext) are encoded as uint8 in ABI.
 */
const CUSTOM_ERRORS: AbiError[] = [
  { type: "error", name: "InvalidGoldenStarMinReferrals", inputs: [] },
  { type: "error", name: "InvalidGoldenStarTimeWindow", inputs: [] },
  { type: "error", name: "InvalidGoldenStarRewardPercent", inputs: [] },
  { type: "error", name: "InvalidGoldenStarRewardDuration", inputs: [] },
  { type: "error", name: "InvalidGoldenStarCapMultiplier", inputs: [] },
  { type: "error", name: "InvalidMaxStarLevel", inputs: [] },
  { type: "error", name: "InvalidMaxReferralLevel", inputs: [] },

  { type: "error", name: "InvalidStarLevelCount", inputs: [] },
  { type: "error", name: "NonSequentialStarLevels", inputs: [] },
  { type: "error", name: "InvalidStarRewardPercent", inputs: [] },

  { type: "error", name: "MismatchedStakeInputs", inputs: [] },
  { type: "error", name: "InactivePackage", inputs: [] },
  { type: "error", name: "UnsupportedToken", inputs: [{ name: "token", type: "address" }] },
  { type: "error", name: "BelowMinimumStakeAmount", inputs: [] },
  { type: "error", name: "InvalidStakeMultiple", inputs: [] },
  { type: "error", name: "InvalidTokenComposition", inputs: [] },
  { type: "error", name: "NoReferrerFound", inputs: [] },
  { type: "error", name: "ZeroRewardAmount", inputs: [] },
  { type: "error", name: "NoReferralRewardsToClaim", inputs: [] },
  { type: "error", name: "APRNotYetClaimable", inputs: [] },

  { type: "error", name: "NoStarLevelRewardsToClaim", inputs: [] },

  { type: "error", name: "NotGoldenStar", inputs: [] },
  { type: "error", name: "NoGoldenStarRewardsToClaim", inputs: [] },

  { type: "error", name: "NothingToUnstake", inputs: [] },
  {
    type: "error",
    name: "InsufficientYYearn",
    inputs: [
      { name: "context", type: "uint8" }, // TransferContext enum -> uint8
      { name: "required", type: "uint256" },
      { name: "available", type: "uint256" },
    ],
  },
  { type: "error", name: "InvalidReferralStartLevel", inputs: [] },
  { type: "error", name: "InvalidReferralEndLevel", inputs: [] },
  { type: "error", name: "InvalidReferralRewardPercent", inputs: [] },
  { type: "error", name: "InvalidReferralRewardToken", inputs: [] },

  { type: "error", name: "MonthlyUnstakePercentMissing", inputs: [] },
  { type: "error", name: "InvalidMinStakeAmount", inputs: [] },
  { type: "error", name: "InvalidPackageId", inputs: [] },
  { type: "error", name: "InvalidCompositionSum", inputs: [] },
  { type: "error", name: "DuplicateComposition", inputs: [] },

  { type: "error", name: "APRZeroAmount", inputs: [] },
  { type: "error", name: "NetRewardZero", inputs: [] },
  { type: "error", name: "APRClaimNotAllowed", inputs: [] },
  { type: "error", name: "APRAlreadyClaimed", inputs: [] },

  { type: "error", name: "InvalidReferrer", inputs: [] },
  { type: "error", name: "ReferrerAlreadySet", inputs: [] },

  { type: "error", name: "InvalidStake", inputs: [] },
  { type: "error", name: "InvalidClaimableInterval", inputs: [] },
  { type: "error", name: "InvalidPrincipalLockForUnstake", inputs: [] },
  { type: "error", name: "UnstakeNotAllowedYet", inputs: [] },

  { type: "error", name: "InvalidUnstakeComputation", inputs: [] },
  { type: "error", name: "InvalidPackage", inputs: [] },
  { type: "error", name: "InvalidDuration", inputs: [] },
];

/** Type guards */
function isError(f: any): f is AbiError {
  return f && f.type === "error" && typeof f.name === "string";
}
function isFunction(f: any): f is AbiFunction {
  return f && f.type === "function" && typeof f.name === "string";
}
function isEvent(f: any): f is AbiEvent {
  return f && f.type === "event" && typeof f.name === "string";
}

/** Build a stable key for ABI entry de-duping. */
function keyOf(entry: any): string {
  const name = entry?.name ?? "";
  const inputs = Array.isArray(entry?.inputs) ? (entry.inputs as AbiParameter[]) : [];
  const types = inputs.map((i) => (typeof i?.type === "string" ? i.type : "")).join(",");

  switch (entry?.type) {
    case "error":
      return `error:${name}(${types})`;
    case "function":
      return `function:${name}(${types})`;
    case "event":
      return `event:${name}(${types})`;
    case "constructor":
      return `constructor(${types})`;
    case "fallback":
      return "fallback";
    case "receive":
      return "receive";
    default:
      return `other:${JSON.stringify({ t: entry?.type, n: name, types })}`;
  }
}

/** Merge + dedupe ABI arrays */
function mergeAbi(a: any[], b: any[]) {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const item of [...a, ...b]) {
    const k = keyOf(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

/** Base ABI + inject CUSTOM_ERRORS, then dedupe */
const baseAbi = (rawAbi as any[]) ?? [];
const STAKING_ABI = mergeAbi(baseAbi, CUSTOM_ERRORS) as Abi;

/** Optional: quick lookup of error signatures "Name(type,...)" */
const ERROR_SIGNATURES = new Map<string, AbiError>(
  STAKING_ABI.filter(isError).map((e) => [
    `${e.name}(${(e.inputs ?? []).map((i: AbiParameter) => i.type).join(",")})`,
    
    e as AbiError,
  ])
);

export default STAKING_ABI;
export { STAKING_ABI, ERROR_SIGNATURES };
export type { Abi, AbiError, AbiEvent, AbiFunction };
