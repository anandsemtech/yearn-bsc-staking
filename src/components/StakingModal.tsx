// src/components/StakingModal.tsx
// Robust staking modal with: referral UI+validation, env-driven token meta,
// BEP-20-safe approvals (YY = EXACT amount, SY/PY = MAX), resilient optimistic refresh,
// correct 4-arg stake(), multiples/min/balance guards, and bottom-sheet UX on mobile.

import {
  X,
  DollarSign,
  Calendar,
  TrendingUp,
  Zap,
  Plus,
  Check,
  AlertTriangle,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Address, Hex } from "viem";
import { parseUnits } from "viem";
import {
  useAccount,
  usePublicClient as useWagmiPublicClient,
  useWalletClient,
} from "wagmi";
import { useAllowedCompositionsFromSubgraph as useAllowedCompositions } from "@/hooks/useAllowedCompositionsSubgraph";

import { STAKING_ABI } from "@/web3/abi/stakingAbi";
import { bsc } from "viem/chains";
import { createPublicClient, http } from "viem";
import {
  explainTxError,
  showUserSuccess,
  showEvmError,
  normalizeEvmError,
} from "@/lib/errors";

/* ===========================
   Debug
=========================== */
const DBG = false;
const log = (...a: any[]) => { if (DBG) console.log(...a); };
const warn = (...a: any[]) => { if (DBG) console.warn(...a); };
const err  = (...a: any[]) => { if (DBG) console.error(...a); };

/* ===========================
   Tunables
=========================== */
const WAIT_CONFIRMATIONS = 1;
const MAX_UINT256 = 2n ** 256n - 1n;
const ALLOWANCE_POLL_ATTEMPTS = 8;
const ALLOWANCE_POLL_DELAY_MS = 450;

// YY approval = EXACT amount
const APPROVE_YY_MAX = false;

/* ===========================
   Props
=========================== */
interface StakingModalProps {
  package: {
    id: string;
    name: string;
    apy: number;
    durationYears: number;
    minAmount: number;
    stakeMultiple?: number;
  };
  onClose: () => void;
  // Optional extras used by Dashboard; safe to ignore if you don't need them here
  hasAdvanced?: boolean;
  honoraryItems?: { title: string; imageUrl: string | null; address: `0x${string}` }[];
}

/* ===========================
   Env (addresses + static meta)
=========================== */
const stakingContract = (import.meta.env.VITE_BASE_CONTRACT_ADDRESS ?? "") as Address;

const yYearn = (import.meta.env.VITE_YYEARN_TOKEN_ADDRESS ||
  import.meta.env.VITE_YYEARN_ADDRESS || "") as Address;
const sYearn = (import.meta.env.VITE_SYEARN_TOKEN_ADDRESS ||
  import.meta.env.VITE_SYEARN_ADDRESS || "") as Address;
const pYearn = (import.meta.env.VITE_PYEARN_TOKEN_ADDRESS ||
  import.meta.env.VITE_PYEARN_ADDRESS || "") as Address;

const YY_SYMBOL = import.meta.env.VITE_YYEARN_SYMBOL ?? "yYearn";
const SY_SYMBOL = import.meta.env.VITE_SYEARN_SYMBOL ?? "sYearn";
const PY_SYMBOL = import.meta.env.VITE_PYEARN_SYMBOL ?? "pYearn";

const YY_DEC = Number(import.meta.env.VITE_YYEARN_DECIMALS ?? 18);
const SY_DEC = Number(import.meta.env.VITE_SYEARN_DECIMALS ?? 18);
const PY_DEC = Number(import.meta.env.VITE_PYEARN_DECIMALS ?? 18);

// Referral
const DEFAULT_REFERRER = (import.meta.env.VITE_DEFAULT_REFERRER ||
  "0xD2Dd094539cfF0F279078181E43A47fC9764aC0D") as Address;

/* ===========================
   Minimal ABIs
=========================== */
const ERC20_ABI = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",   stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const STAKING_READS_ABI = [
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function", name: "packages", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint16" },
      { name: "durationInDays", type: "uint16" },
      { name: "apr", type: "uint16" },
      { name: "monthlyUnstake", type: "bool" },
      { name: "isActive", type: "bool" },
      { name: "minStakeAmount", type: "uint256" },
      { name: "monthlyPrincipalReturnPercent", type: "uint16" },
      { name: "monthlyAPRClaimable", type: "bool" },
      { name: "claimableInterval", type: "uint256" },
      { name: "stakeMultiple", type: "uint256" },
      { name: "principalLocked", type: "bool" },
    ],
  },
  // Referral validity helpers
  { type: "function", name: "isWhitelisted", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "userTotalStaked", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/* ===========================
   Helpers
=========================== */
const addCommas = (n: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const prettyFixed = (v: bigint, decimals: number, places = 2) => {
  const s = v.toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const whole = s.slice(0, i) || "0";
  let frac = s.slice(i);
  if (places <= 0) return addCommas(whole);
  if (frac.length < places) frac = frac.padEnd(places, "0");
  else frac = frac.slice(0, places);
  return `${addCommas(whole)}.${frac}`;
};
const prettyUSD = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 6 });

const eqAddr = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

function emitRefreshBursts(payload?: any) {
  if (payload) {
    window.dispatchEvent(new CustomEvent("active-packages:add-optimistic", { detail: payload }));
    window.dispatchEvent(new CustomEvent("stake:optimistic", { detail: payload }));
  }
  const fire = () => {
    window.dispatchEvent(new Event("active-packages:refresh"));
    window.dispatchEvent(new Event("stakes:changed"));
    window.dispatchEvent(new Event("staking:updated"));
    window.dispatchEvent(new Event("staked")); // some listeners use this
  };
  fire();
  setTimeout(fire, 1000);
  setTimeout(fire, 3000);
  setTimeout(fire, 7000);
}

function msgFromUnknown(e: unknown, fallback = "Something went wrong") {
  try {
    const n = normalizeEvmError(e);
    return n?.message || (e as any)?.shortMessage || (e as any)?.message || fallback;
  } catch {
    return (e as any)?.shortMessage || (e as any)?.message || fallback;
  }
}

/* ===========================
   Component
=========================== */
const StakingModal: React.FC<StakingModalProps> = ({ package: pkg, onClose }) => {
  const { address, chainId: connectedChainId, isConnected } = useAccount();
  const wagmiPublic = useWagmiPublicClient({ chainId: bsc.id });
  const { data: walletClient } = useWalletClient();

  const publicClient = useMemo(
    () =>
      wagmiPublic ??
      createPublicClient({
        chain: bsc,
        transport: http(
          import.meta.env.VITE_BSC_RPC_URL || "https://bsc-dataseed1.bnbchain.org"
        ),
      }),
    [wagmiPublic]
  );

  /* ===========================
     Chain guard
  =========================== */
  const [chainIssue, setChainIssue] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!isConnected || !walletClient) return setChainIssue(null);
      try {
        const hex = (await walletClient.request({ method: "eth_chainId" })) as string;
        const onBsc = hex?.toLowerCase() === `0x${bsc.id.toString(16)}`.toLowerCase();
        if (!stop) setChainIssue(onBsc ? null : "Please switch your wallet to BSC Mainnet");
      } catch { if (!stop) setChainIssue("Please switch your wallet to BSC Mainnet"); }
    })();
    return () => { stop = true; };
  }, [isConnected, walletClient]);

  async function ensureBsc() {
    if (!walletClient) throw new Error("Connect wallet.");
    const targetHex = `0x${bsc.id.toString(16)}`;
    const cur = (await walletClient.request({ method: "eth_chainId" })) as string;
    if (cur?.toLowerCase() === targetHex.toLowerCase()) return;
    try {
      await walletClient.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetHex }] });
    } catch (e: any) {
      if (e?.code !== 4902) throw new Error("Please switch your wallet to BSC Mainnet.");
      await walletClient.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: targetHex,
          chainName: "BSC Mainnet",
          rpcUrls: [import.meta.env.VITE_BSC_RPC_URL || "https://bsc-dataseed1.bnbchain.org"],
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          blockExplorerUrls: ["https://bscscan.com"],
        }],
      });
      await walletClient.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetHex }] });
    }
  }

  /* ===========================
     Compositions
  =========================== */
  const { compositions: compRows, isLoading: compLoading, error: compError } =
    useAllowedCompositions();
  const validCompositions = useMemo<number[][]>(() => {
    const rows = compRows.map((r) => [r.yYearnPct, r.sYearnPct, r.pYearnPct]);
    return rows.length ? rows : [[100, 0, 0]];
  }, [compRows]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  useEffect(() => {
    if (selectedIdx >= validCompositions.length) setSelectedIdx(0);
  }, [validCompositions.length, selectedIdx]);
  const selected = validCompositions[selectedIdx] ?? [100, 0, 0];

  /* ===========================
     Amount & multiples UX
  =========================== */
  const initialAmount = useMemo(() => {
    const m = pkg.stakeMultiple || 0;
    if (!m) return String(Math.max(pkg.minAmount, 0));
    const k = Math.ceil(Math.max(pkg.minAmount, 0) / m);
    return String(k * m);
  }, [pkg.minAmount, pkg.stakeMultiple]);

  const [amount, setAmount] = useState(initialAmount);

  const amountNum = useMemo(() => {
    const n = Number(amount || 0);
    return !isFinite(n) || n < 0 ? 0 : n;
  }, [amount]);

  const min = pkg.minAmount;
  const mStep = pkg.stakeMultiple && pkg.stakeMultiple > 0 ? pkg.stakeMultiple : 1;

  const meetsMin = amountNum >= min;
  const isMultipleOk = amountNum % mStep === 0;

  const toNextMultipleDelta = useMemo(() => {
    if (mStep <= 1) return 0;
    if (amountNum <= 0) return mStep;
    const next = Math.ceil(amountNum / mStep) * mStep;
    const d = next - amountNum;
    return d === 0 ? mStep : d;
  }, [amountNum, mStep]);

  const bumpByMultiples = (count: number) => {
    if (count <= 0) return;
    setAmount(String(amountNum + mStep * count));
  };
  const nudgeToNextValid = () => {
    setAmount(String(amountNum + toNextMultipleDelta));
  };
  const nudgeToMin = () => {
    const k = Math.ceil(Math.max(min, 0) / mStep);
    setAmount(String(k * mStep));
  };

  /* ===========================
     Split -> wei using env decimals
  =========================== */
  const humanPerToken = useMemo<[number, number, number]>(() => {
    const [yy, sy, py] = selected;
    if (yy + sy + py !== 100) return [0, 0, 0];
    return [(amountNum * yy) / 100, (amountNum * sy) / 100, (amountNum * py) / 100];
  }, [amountNum, selected]);

  const yWei = useMemo(() => parseUnits(String(humanPerToken[0] || 0), YY_DEC), [humanPerToken]);
  const sWei = useMemo(() => parseUnits(String(humanPerToken[1] || 0), SY_DEC), [humanPerToken]);
  const pWei = useMemo(() => parseUnits(String(humanPerToken[2] || 0), PY_DEC), [humanPerToken]);

  const tokensAll: Address[] = [yYearn, sYearn, pYearn];
  const amtsAll: bigint[]   = [yWei,  sWei,  pWei ];

  /* ===========================
     Balances (needed for gating)
  =========================== */
  const [haveWei, setHaveWei] = useState<[bigint, bigint, bigint]>([0n, 0n, 0n]);
  useEffect(() => {
    (async () => {
      if (!address) return setHaveWei([0n, 0n, 0n]);
      try {
        const [by, bs, bp] = await Promise.all([
          publicClient.readContract({ address: yYearn, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
          publicClient.readContract({ address: sYearn, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
          publicClient.readContract({ address: pYearn, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
        ]);
        setHaveWei([by, bs, bp]);
      } catch (e) {
        err("balanceOf failed", e);
        setHaveWei([0n, 0n, 0n]);
      }
    })();
  }, [address, publicClient, connectedChainId]);

  const decs: [number, number, number] = [YY_DEC, SY_DEC, PY_DEC];
  const syms: [string, string, string] = [YY_SYMBOL, SY_SYMBOL, PY_SYMBOL];

  const hasSufficientBalances =
    (amtsAll[0] <= haveWei[0]) &&
    (amtsAll[1] <= haveWei[1]) &&
    (amtsAll[2] <= haveWei[2]);

  /* ===========================
     Referrer UI + validation
  =========================== */
  const [referrerInput, setReferrerInput] = useState<string>(DEFAULT_REFERRER);
  const [refValid, setRefValid] = useState<boolean | null>(null);
  const [refChecking, setRefChecking] = useState(false);
  const [showFullRef, setShowFullRef] = useState(false);
  const refInputEl = useRef<HTMLInputElement>(null);

  const isAddr = (a?: string): a is Address => !!a && /^0x[a-fA-F0-9]{40}$/.test(a);

  async function isReferrerEligible(addr: Address): Promise<boolean> {
    try {
      const [wl, staked] = await Promise.all([
        publicClient.readContract({
          address: stakingContract,
          abi: STAKING_READS_ABI,
          functionName: "isWhitelisted",
          args: [addr],
        }) as Promise<boolean>,
        publicClient.readContract({
          address: stakingContract,
          abi: STAKING_READS_ABI,
          functionName: "userTotalStaked",
          args: [addr],
        }) as Promise<bigint>,
      ]);
      return wl || staked > 0n;
    } catch {
      return true; // accept if contract doesn't expose these
    }
  }

  useEffect(() => {
    const val = referrerInput?.trim();
    if (!val) {
      setRefValid(null);
      setRefChecking(false);
      return;
    }
    if (!isAddr(val)) {
      setRefValid(false);
      setRefChecking(false);
      return;
    }
    setRefChecking(true);
    const t = setTimeout(async () => {
      try {
        const ok = await isReferrerEligible(val as Address);
        setRefValid(ok);
      } finally {
        setRefChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [referrerInput]);

  function finalReferrer(): Address {
    const v = (referrerInput || "").trim();
    return isAddr(v) && (refValid !== false) ? (v as Address) : DEFAULT_REFERRER;
  }

  /* ===========================
     Paused & package info
  =========================== */
  async function isPaused(): Promise<boolean | null> {
    try { return (await publicClient.readContract({ address: stakingContract, abi: STAKING_READS_ABI, functionName: "paused" })) as boolean; }
    catch { return null; }
  }
  async function readPackageInfo(pid: bigint) {
    try { return await publicClient.readContract({ address: stakingContract, abi: STAKING_READS_ABI, functionName: "packages", args: [pid] }) as any; }
    catch { return null; }
  }

  /* ===========================
     Allowances & approvals
  =========================== */
  async function readAllowance(owner: Address, token: Address) {
    return (await publicClient.readContract({
      address: token, abi: ERC20_ABI, functionName: "allowance", args: [owner, stakingContract]
    })) as bigint;
  }

  async function writeApprove(owner: Address, token: Address, amount: bigint) {
    try {
      const sim = await publicClient.simulateContract({
        chain: bsc, address: token, abi: ERC20_ABI, functionName: "approve",
        args: [stakingContract, amount], account: owner,
      });
      const tx = await walletClient!.writeContract({ ...sim.request, chain: bsc });
      await publicClient.waitForTransactionReceipt({ hash: tx, confirmations: WAIT_CONFIRMATIONS });
    } catch {
      const tx = await walletClient!.writeContract({
        address: token, abi: ERC20_ABI, functionName: "approve",
        args: [stakingContract, amount], account: owner, chain: bsc,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx, confirmations: WAIT_CONFIRMATIONS });
    }
  }

  async function approveWithRetries(owner: Address, token: Address, need: bigint) {
    const isYY = eqAddr(token, yYearn);
    const target = isYY && !APPROVE_YY_MAX ? need : MAX_UINT256;

    const before = await readAllowance(owner, token);
    if (before >= need && (!isYY || (APPROVE_YY_MAX ? before > 0n : true))) return;

    if (before > 0n) {
      try { await writeApprove(owner, token, 0n); } catch {}
    }

    const delays = [0, 400, 800];
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
      try {
        await writeApprove(owner, token, target);
      } catch (e) {
        if (i === delays.length - 1) throw e;
      }
      let ok = false;
      for (let t = 0; t < ALLOWANCE_POLL_ATTEMPTS; t++) {
        const a = await readAllowance(owner, token);
        if (a >= need) { ok = true; break; }
        await new Promise(r => setTimeout(r, ALLOWANCE_POLL_DELAY_MS));
      }
      if (ok) return;
    }
    const a = await readAllowance(owner, token);
    throw new Error(`${isYY ? "YY" : eqAddr(token, sYearn) ? "SY" : "PY"} approval not sufficient. Have ${a.toString()}, need ${need.toString()}`);
  }

  async function ensureApprovalBundle(owner: Address) {
    const tokens = [yYearn, sYearn, pYearn];
    const needs = [yWei, sWei, pWei];
    for (let i = 0; i < 3; i++) {
      const need = needs[i]; if (need === 0n) continue;
      await approveWithRetries(owner, tokens[i], need);
    }
  }

  /* ===========================
     Pre-stake validation
  =========================== */
  function validateEnv(): string | null {
    const isAddr = (a?: string) => !!a && /^0x[a-fA-F0-9]{40}$/.test(a);
    if (!isAddr(stakingContract)) return "Invalid staking contract address (env).";
    if (!isAddr(yYearn) || !isAddr(sYearn) || !isAddr(pYearn)) return "Invalid token address (env).";
    if (eqAddr(yYearn, sYearn) || eqAddr(yYearn, pYearn) || eqAddr(sYearn, pYearn)) return "Token addresses must be distinct.";
    return null;
  }

  async function preStakeSanityCheck(finalRef: Address): Promise<string | null> {
    const envIssue = validateEnv();
    if (envIssue) return envIssue;
    if (!address) return "Connect wallet.";

    try {
      if (walletClient) {
        const hex = (await walletClient.request({ method: "eth_chainId" })) as string;
        if (hex?.toLowerCase() !== `0x${bsc.id.toString(16)}`.toLowerCase()) return "Please switch your wallet to BSC Mainnet.";
      }
    } catch { return "Please switch your wallet to BSC Mainnet."; }

    if (selected[0] + selected[1] + selected[2] !== 100) return "Composition must sum to 100%.";
    if (!meetsMin) return `Amount must be at least ${min}.`;
    if (!isMultipleOk && mStep > 1) return `Amount must be a multiple of ${mStep}.`;
    if (yWei + sWei + pWei === 0n) return "Total amount is zero.";

    const paused = await isPaused(); if (paused === true) return "Contract is paused.";
    const onPkg = await readPackageInfo(BigInt(pkg.id));
    if (onPkg?.isActive === false) return "Package is inactive on-chain.";
    if (onPkg?.minStakeAmount) {
      const total = yWei + sWei + pWei;
      if (total < BigInt(onPkg.minStakeAmount)) return "Total stake below on-chain minimum.";
      if (onPkg.stakeMultiple && BigInt(onPkg.stakeMultiple) > 0n && total % BigInt(onPkg.stakeMultiple) !== 0n)
        return "Total stake must respect on-chain multiple.";
    }

    if (!finalRef) return "Referrer missing.";
    const refOK = await isReferrerEligible(finalRef);
    if (!refOK) return "Referrer is not eligible (must be whitelisted or have staked before).";

    const names = syms;
    const addrs = [yYearn, sYearn, pYearn];
    const needs = [yWei, sWei, pWei];
    for (let i = 0; i < 3; i++) {
      const need = needs[i]; if (need === 0n) continue;
      const bal = (await publicClient.readContract({ address: addrs[i], abi: ERC20_ABI, functionName: "balanceOf", args: [address] })) as bigint;
      if (bal < need) return `${names[i]}: insufficient balance. Need ${need.toString()}, have ${bal.toString()}`;
    }
    return null;
  }

  /* ===========================
     Stake TX (4 args)
  =========================== */
  const [stakeTxHash, setStakeTxHash] = useState<Hex | null>(null);
  const [stakeConfirmed, setStakeConfirmed] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const lastStakeKeyRef = useRef<string | null>(null);

  async function sendStakeTx(finalRef: Address): Promise<Hex> {
    if (!walletClient || !address) throw new Error("Wallet not ready");

    const pid = BigInt(pkg.id);
    const call = {
      address: stakingContract,
      abi: STAKING_ABI,
      functionName: "stake" as const,
      args: [pid, [yYearn, sYearn, pYearn] as Address[], [yWei, sWei, pWei] as bigint[], finalRef],
      account: address,
      chain: bsc,
    };

    let hash: Hex;
    try {
      const sim = await publicClient.simulateContract(call);
      hash = await walletClient.writeContract(sim.request);
    } catch {
      hash = await walletClient.writeContract(call);
    }
    setStakeTxHash(hash);
    return hash;
  }

  useEffect(() => {
    if (!stakeTxHash || stakeConfirmed) return;
    (async () => {
      try {
        const rcpt = await publicClient.waitForTransactionReceipt({ hash: stakeTxHash, confirmations: WAIT_CONFIRMATIONS });
        if (rcpt.status === "reverted") {
          const appErr = explainTxError("stake", new Error("Transaction reverted"));
          window.dispatchEvent(new CustomEvent("toast:error", { detail: appErr }));
          setActionMsg(appErr.message);
          setIsStaking(false);
          lastStakeKeyRef.current = null;
          return;
        }
        setStakeConfirmed(true);
        showUserSuccess("Stake submitted", "Refreshing your positions…");
        emitRefreshBursts({ txHash: stakeTxHash });
        setIsStaking(false);
        onClose();
      } catch (e) {
        showEvmError(msgFromUnknown(e), { context: "Stake" });
        setActionMsg(normalizeEvmError(e)?.message || (e as any)?.message || "Stake failed");
        setIsStaking(false);
        lastStakeKeyRef.current = null;
      }
    })();
  }, [publicClient, onClose, stakeTxHash, stakeConfirmed]);

  /* ===========================
     CTA handler
  =========================== */
  async function handleApproveAndStake() {
    setActionMsg(null);
    try {
      if (!walletClient || !address) throw new Error("Connect wallet.");
      await ensureBsc();

      if (!meetsMin) throw new Error(`Amount must be at least ${min}.`);
      if (!isMultipleOk && mStep > 1) {
        throw new Error(`Amount must be a multiple of ${mStep}. Tip: tap “+${toNextMultipleDelta}” to fix.`);
      }

      const ref = finalReferrer();
      const key = JSON.stringify({
        pid: pkg.id,
        y: yWei.toString(),
        s: sWei.toString(),
        p: pWei.toString(),
        ref,
      });
      if (isStaking || isApproving || lastStakeKeyRef.current === key) return;
      lastStakeKeyRef.current = key;

      const sanity = await preStakeSanityCheck(ref);
      if (sanity) throw new Error(sanity);

      // approvals (YY EXACT, SY/PY MAX)
      setIsApproving(true);
      await ensureApprovalBundle(address as Address);
      setIsApproving(false);

      // stake
      setIsStaking(true);
      const hash = await sendStakeTx(ref);

      // optimistic row immediately
      const totalHuman =
        (humanPerToken[0] + humanPerToken[1] + humanPerToken[2])
          .toLocaleString(undefined, { maximumFractionDigits: 6 });

      emitRefreshBursts({
        key: `opt-${hash}`,
        txHash: hash,
        user: address,
        packageId: Number(pkg.id),
        packageName: pkg.name,
        startTs: Math.floor(Date.now() / 1000),
        status: "Pending",
        totalAmountLabel: totalHuman,
        compositionPct: [selected[0], selected[1], selected[2]],
        referrer: ref,
      });

    } catch (e: unknown) {
      lastStakeKeyRef.current = null;
      setIsApproving(false);
      setIsStaking(false);
      showEvmError(msgFromUnknown(e), { context: "Stake" });
      setActionMsg(normalizeEvmError(e)?.message || (e as any)?.message || "Something went wrong");
    }
  }

  /* ===========================
     UI state
  =========================== */
  const projectedEarnings = amountNum * (pkg.apy / 100);
  const mainDisabled =
    isApproving || isStaking || !!stakeTxHash || !address ||
    amountNum < min || (!isMultipleOk && mStep > 1) ||
    validCompositions.length === 0 || !!chainIssue ||
    (yWei + sWei + pWei === 0n) || !hasSufficientBalances || refValid === false;

  const mainBtnText =
    isApproving ? "Approving…" :
    isStaking && !stakeTxHash ? "Sending stake…" :
    stakeTxHash ? "Confirming…" :
    stakeConfirmed ? "Staked" :
    "Approve & Stake";

  const formatWei = (wei: bigint, dec: number) => prettyFixed(wei, dec, 2);

  /* ===========================
     Render
  =========================== */
  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Dialog (bottom sheet on mobile, centered on ≥sm) */}
      <div className="bg-white dark:bg-gray-900 w-full max-w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl
                      h-[88vh] sm:h-auto sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 sm:px-6 py-3
                        border-b border-gray-200/60 dark:border-white/10
                        bg-white/90 dark:bg-gray-900/90 backdrop-blur">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
            Stake {pkg.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 sm:p-4 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border border-violet-100 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 shrink-0 text-violet-500" />
                <span className="text-gray-600 dark:text-gray-400">Duration</span>
                <span className="ml-auto font-medium text-gray-900 dark:text-white">
                  {pkg.durationYears} {pkg.durationYears === 1 ? "Year" : "Years"}
                </span>
              </div>
            </div>
            <div className="rounded-xl p-3 sm:p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-100 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="text-gray-600 dark:text-gray-400">APY</span>
                <span className="ml-auto font-medium text-emerald-700 dark:text-emerald-400">{pkg.apy}%</span>
              </div>
            </div>
          </div>

          {/* Amount + Multiples */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">Stake Amount</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={min}
                step={mStep}
                inputMode="decimal"
                className={`w-full pl-11 pr-4 py-3 rounded-xl border text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:border-transparent
                  ${(!isMultipleOk && mStep > 1) || !meetsMin
                    ? "bg-rose-50/60 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 focus:ring-rose-500"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-white/10 focus:ring-violet-500"}`}
                aria-invalid={(!isMultipleOk && mStep > 1) || !meetsMin}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Minimum: {prettyUSD(min)}
                {mStep > 1 ? ` • Multiples of ${prettyUSD(mStep)}` : ""}
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                {mStep > 1 && !isMultipleOk && (
                  <button
                    type="button"
                    onClick={nudgeToNextValid}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                               bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 hover:opacity-90"
                  >
                    <Plus className="w-3 h-3" />
                    Fix +{toNextMultipleDelta}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => bumpByMultiples(1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                             bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200 hover:opacity-90"
                >
                  <Plus className="w-3 h-3" />
                  +1×
                </button>
                <button
                  type="button"
                  onClick={() => bumpByMultiples(5)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                             bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 hover:opacity-90"
                >
                  <Plus className="w-3 h-3" />
                  +5×
                </button>
                <button
                  type="button"
                  onClick={nudgeToMin}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                             bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-200 hover:opacity-90"
                >
                  Set to Min
                </button>
              </div>
            </div>
          </div>

          {/* Referrer */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">Referrer Address</label>
            <div className="relative flex items-center gap-2">
              <div
                className={`absolute inset-y-0 left-0 flex items-center px-3 font-mono text-gray-800 dark:text-gray-100 transition-opacity
                  ${showFullRef ? "opacity-0 pointer-events-none" : "opacity-100"}`}
                style={{ whiteSpace: "nowrap" }}
              >
                {isAddr(referrerInput)
                  ? `${referrerInput.slice(0, 6)}...${referrerInput.slice(-6)}`
                  : referrerInput || DEFAULT_REFERRER}
              </div>

              <input
                ref={refInputEl}
                type="text"
                value={referrerInput}
                onChange={(e) => { setReferrerInput(e.target.value.trim()); setRefValid(null); }}
                onFocus={() => {
                  setShowFullRef(true);
                  requestAnimationFrame(() => {
                    if (refInputEl.current) {
                      refInputEl.current.scrollLeft = refInputEl.current.scrollWidth;
                    }
                  });
                }}
                onBlur={() => setShowFullRef(false)}
                placeholder={DEFAULT_REFERRER}
                className={`w-full px-3 py-3 rounded-xl border font-mono focus:ring-2 focus:border-transparent
                  ${refValid === false ? "bg-rose-50/60 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 focus:ring-rose-500"
                                       : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-white/10 focus:ring-violet-500"}
                  ${showFullRef ? "text-gray-900 dark:text-gray-100" : "text-transparent caret-gray-900 dark:caret-white"}`}
                style={{ whiteSpace: "nowrap", overflowX: "auto", overflowY: "hidden" }}
              />

              {refChecking && <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />}
              {refValid === true && !refChecking && <Check className="w-5 h-5 text-emerald-500" />}
              {refValid === false && !refChecking && <AlertTriangle className="w-5 h-5 text-rose-500" />}
            </div>

            {refValid === false && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Referrer is not eligible (must be whitelisted or have staked before).
              </p>
            )}
          </div>

          {/* Composition */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Choose a composition</h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {compLoading ? "Loading…" : compError ? "Failed to load" : `${validCompositions.length} options`}
              </span>
            </div>

            <div className="grid grid-template gap-2.5"
                 style={{ gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
              {validCompositions.map((c, i) => {
                const active = i === selectedIdx;
                return (
                  <button
                    key={`${c.join("-")}-${i}`}
                    onClick={() => setSelectedIdx(i)}
                    className={`px-3.5 py-2 rounded-2xl border text-sm transition-all touch-manipulation ${
                      active
                        ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                        : "bg-white/60 dark:bg-white/5 text-gray-800 dark:text-gray-200 border-gray-300/60 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10"
                    }`}
                  >
                    [{c.join(", ")}]
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allocation */}
          <div className="rounded-xl p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Allocation</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: YY_SYMBOL, need: amtsAll[0], have: haveWei[0], dec: decs[0] },
                { label: SY_SYMBOL, need: amtsAll[1], have: haveWei[1], dec: decs[1] },
                { label: PY_SYMBOL, need: amtsAll[2], have: haveWei[2], dec: decs[2] },
              ].map((r) => {
                const lacking = r.need > r.have;
                return (
                  <div
                    key={r.label}
                    className={`rounded-lg px-3 py-2 border min-w-0
                      ${lacking
                        ? "bg-rose-50/60 dark:bg-rose-900/20 border-rose-200/60 dark:border-rose-900/40"
                        : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"}`}
                  >
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">{r.label}</div>

                    <div className="mt-0.5 flex items-baseline justify-between gap-2 min-w-0 font-variant-numeric tabular-nums">
                      <div className="shrink-0 text-[11px] text-gray-500">Need</div>
                      <div
                        className="ml-auto font-semibold text-gray-900 dark:text-white truncate
                                   text-[clamp(12px,3.7vw,14px)]"
                        title={`Need ${formatWei(r.need ?? 0n, r.dec)}`}
                      >
                        {formatWei(r.need ?? 0n, r.dec)}
                      </div>
                    </div>

                    <div className="mt-0.5 flex items-baseline justify-between gap-2 min-w-0 font-variant-numeric tabular-nums">
                      <div className="shrink-0 text-[11px] text-gray-500">Have</div>
                      <div
                        className="ml-auto font-medium truncate text-[clamp(11px,3.5vw,13px)]"
                        title={`Have ${formatWei(r.have, r.dec)}`}
                      >
                        {formatWei(r.have, r.dec)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!hasSufficientBalances && (
              <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
                Insufficient balance for the selected allocation. Reduce amount or adjust composition.
              </p>
            )}
          </div>

          {/* Earnings */}
          <div className="rounded-xl p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Projected Annual Earnings</h3>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {prettyUSD(projectedEarnings)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Based on {pkg.apy}% APY</p>
          </div>

          {chainIssue && <div className="text-xs text-amber-600 dark:text-amber-400">{chainIssue}</div>}
          {actionMsg && <div className="text-sm text-rose-500">{actionMsg}</div>}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 p-4 sm:p-5 bg-white/90 dark:bg-gray-900/90 backdrop-blur
                        border-t border-gray-200/60 dark:border-white/10
                        pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleApproveAndStake}
              disabled={
                isApproving || isStaking || !!stakeTxHash || !address ||
                amountNum < min || (!isMultipleOk && mStep > 1) ||
                validCompositions.length === 0 || !!chainIssue ||
                (yWei + sWei + pWei === 0n) || !hasSufficientBalances || refValid === false
              }
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                (isApproving || isStaking || !!stakeTxHash || !address ||
                 amountNum < min || (!isMultipleOk && mStep > 1) ||
                 validCompositions.length === 0 || !!chainIssue ||
                 (yWei + sWei + pWei === 0n) || !hasSufficientBalances || refValid === false)
                  ? "bg-gradient-to-r from-violet-900/30 to-indigo-900/30 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-sm"}`}
            >
              {isApproving || isStaking || !!stakeTxHash ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (<Zap className="w-4 h-4" />)}
              <span>{mainBtnText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StakingModal;
