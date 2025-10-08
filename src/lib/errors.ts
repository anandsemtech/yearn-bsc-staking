// src/lib/errors.ts
import { BaseError, Hex, decodeErrorResult } from "viem";
import { STAKING_ABI } from "@/web3/abi/stakingAbi";

/* ------------------------------------------------------------------ */
/*                      Minimal ERC20 error ABI                        */
/* ------------------------------------------------------------------ */
const ERC20_ERROR_ABI = [
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "needed", type: "uint256" },
      { name: "balance", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address" },
      { name: "needed", type: "uint256" },
      { name: "allowance", type: "uint256" },
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/*                               Types                                */
/* ------------------------------------------------------------------ */
export type TxOp = "stake" | "claim" | "unstake" | "claimReferral" | string;

export type AppError = {
  title: string;
  message: string;
  severity: "error" | "warning" | "info";
  reason?: string;
};

type ToastDetail = { title: string; description?: string; severity?: string };

/* ------------------------------------------------------------------ */
/*                          Toast helpers                              */
/* ------------------------------------------------------------------ */
export function showUserSuccess(title: string, description?: string) {
  try {
    window.dispatchEvent(
      new CustomEvent<ToastDetail>("toast:success", { detail: { title, description, severity: "success" } })
    );
  } catch {
    // noop
  }
}

export function showUserWarning(title: string, description?: string) {
  try {
    window.dispatchEvent(
      new CustomEvent<ToastDetail>("toast:warn", { detail: { title, description, severity: "warning" } })
    );
  } catch {}
}

export function showUserError(title: string, description?: string) {
  try {
    window.dispatchEvent(
      new CustomEvent<ToastDetail>("toast:error", { detail: { title, description, severity: "error" } })
    );
  } catch {}
}

/* ------------------------------------------------------------------ */
/*                      EVM error normalization                        */
/* ------------------------------------------------------------------ */
export function normalizeEvmError(err: unknown): { message: string; code?: number | string } {
  // viem BaseError
  if (err instanceof BaseError) {
    const msg = String(err.shortMessage || err.message || "Transaction failed");
    const code = (err as any)?.walk?.()?.code ?? (err as any)?.code;
    return { message: msg, code };
  }

  const anyErr = err as any;
  const msg =
    anyErr?.shortMessage ||
    anyErr?.data?.message ||
    anyErr?.error?.message ||
    anyErr?.message ||
    "Transaction failed";

  const code = anyErr?.code ?? anyErr?.error?.code;
  return { message: String(msg), code };
}

/* ------------------------------------------------------------------ */
/*                     Revert reason decoding (ABI)                    */
/* ------------------------------------------------------------------ */
function tryDecodeWithAbi(data?: Hex, abi?: any) {
  if (!data) return null;
  try {
    const decoded = decodeErrorResult({
      abi: abi as any,
      data,
    });
    return decoded; // { errorName, args }
  } catch {
    return null;
  }
}

function firstHexLike(err: any): Hex | undefined {
  // viem/BaseError often nests revert data at err.details or err.cause.data
  const candidates: any[] = [
    err?.data,
    err?.cause?.data,
    err?.details,
    err?.cause?.meta?.data,
    err?.meta?.data,
    err?.error?.data,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("0x")) return c as Hex;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*                     Human-friendly explanations                     */
/* ------------------------------------------------------------------ */
export function explainTxError(op: TxOp, err: unknown): AppError {
  // Normalize first
  const { message: normMsg } = normalizeEvmError(err);

  // Try to decode revert data via our ABIs
  const data = firstHexLike(err);
  const stakingDec = tryDecodeWithAbi(data, STAKING_ABI);
  const erc20Dec = tryDecodeWithAbi(data, ERC20_ERROR_ABI);

  // Map common cases
  if (stakingDec?.errorName) {
    const en = stakingDec.errorName as string;

    if (/Paused/i.test(en)) {
      return {
        title: "Contract is paused",
        message: "The staking contract is currently paused. Please try again later.",
        severity: "warning",
        reason: en,
      };
    }
    if (/OnlyOwner|Unauthorized|Access/i.test(en)) {
      return {
        title: "Not authorized",
        message: "You don't have permission to perform this action.",
        severity: "error",
        reason: en,
      };
    }
    if (/Invalid|Insufficient|Exceeded|Overflow/i.test(en)) {
      return {
        title: "Invalid request",
        message: normMsg,
        severity: "error",
        reason: en,
      };
    }

    // Fallback for named staking errors
    return {
      title: `Failed to ${op}`,
      message: `${en}${stakingDec.args?.length ? `: ${JSON.stringify(stakingDec.args)}` : ""}`,
      severity: "error",
      reason: en,
    };
  }

  if (erc20Dec?.errorName === "ERC20InsufficientAllowance") {
    return {
      title: "Insufficient allowance",
      message:
        "Token approval is not high enough. Please approve a higher amount and try again.",
      severity: "warning",
      reason: "ERC20InsufficientAllowance",
    };
  }
  if (erc20Dec?.errorName === "ERC20InsufficientBalance") {
    return {
      title: "Insufficient balance",
      message: "Your token balance is not enough for this transaction.",
      severity: "warning",
      reason: "ERC20InsufficientBalance",
    };
  }

  // Network/rpc-ish hints
  const msgLower = normMsg.toLowerCase();
  if (msgLower.includes("user rejected")) {
    return {
      title: "Transaction rejected",
      message: "You rejected the transaction in your wallet.",
      severity: "info",
      reason: "UserRejected",
    };
  }
  if (msgLower.includes("nonce too low")) {
    return {
      title: "Nonce too low",
      message: "Please try again or reset your account nonce in wallet settings.",
      severity: "warning",
      reason: "NonceTooLow",
    };
  }
  if (msgLower.includes("insufficient funds")) {
    return {
      title: "Insufficient gas funds",
      message: "You need more BNB to pay gas for this transaction.",
      severity: "warning",
      reason: "InsufficientFunds",
    };
  }

  // Generic fallback
  return {
    title: `Failed to ${op}`,
    message: normMsg,
    severity: "error",
  };
}

/* ------------------------------------------------------------------ */
/*                     Display (toast) for EVM errors                  */
/* ------------------------------------------------------------------ */
export function showEvmError(op: TxOp, err: unknown) {
  const appErr = explainTxError(op, err);
  const detail: ToastDetail = {
    title: appErr.title,
    description: appErr.message,
    severity: appErr.severity,
  };

  try {
    const evt = appErr.severity === "warning" ? "toast:warn" : "toast:error";
    window.dispatchEvent(new CustomEvent<ToastDetail>(evt, { detail }));
  } catch {
    // As a last resort log to console
    // eslint-disable-next-line no-console
    console.error(`[${op}]`, appErr.title, appErr.message);
  }
}

/* ------------------------------------------------------------------ */
/*                     Tiny wrappers (for your modal)                  */
/* ------------------------------------------------------------------ */
export const safeShowEvmError = (e: unknown, op: TxOp = "Tx") => {
  try {
    return showEvmError(op, e);
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[${op}]`, e);
  }
};

export const safeNormalizeMsg = (e: any, fallback?: string) =>
  normalizeEvmError(e)?.message ??
  e?.shortMessage ??
  e?.message ??
  fallback ??
  "Something went wrong";
