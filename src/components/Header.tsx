import { Settings, X, Zap, Copy, Wallet } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  useDisconnect,
  useBalance,
  usePublicClient,
  useChainId,
  useWalletClient,
} from "wagmi";
import { Address, formatUnits } from "viem";
import { bsc } from "viem/chains";
import { useAppKit } from "@reown/appkit/react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import UserSettingsModal from "./UserSettingsModal";
import YearnTogetherMark from "./YearnTogetherMark";
import HonoraryBadgeChip from "./HonoraryBadgeChip";

/* ENV token addresses (optional) */
const YYEARN = (import.meta.env.VITE_YYEARN_ADDRESS ?? "") as Address;
const SYEARN = (import.meta.env.VITE_SYEARN_ADDRESS ?? "") as Address;
const PYEARN = (import.meta.env.VITE_PYEARN_ADDRESS ?? "") as Address;
const USDT = (import.meta.env.VITE_USDT_ADDRESS ?? "") as Address;

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const fmt = (value: bigint, decimals: number, maxFrac = 4) => {
  const raw = formatUnits(value, decimals);
  if (!raw.includes(".")) return Number(raw).toLocaleString();
  const [w, f] = raw.split(".");
  const wf = Number(w).toLocaleString();
  const trimmed = f.slice(0, maxFrac).replace(/0+$/, "");
  return trimmed ? `${wf}.${trimmed}` : wf;
};

type ErcRow = {
  key: "YY" | "SY" | "PY" | "USDT";
  address?: Address;
  fallbackDecimals: number;
  label: string;
};

const TOKENS: ErcRow[] = [
  { key: "YY", address: YYEARN, fallbackDecimals: 18, label: "YY" },
  { key: "SY", address: SYEARN, fallbackDecimals: 18, label: "SY" },
  { key: "PY", address: PYEARN, fallbackDecimals: 18, label: "PY" },
  { key: "USDT", address: USDT, fallbackDecimals: 6, label: "USDT" },
];

const Row: React.FC<{ symbol: string; value: string }> = ({ symbol, value }) => (
  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
        <Wallet className="w-3.5 h-3.5 text-white/80" />
      </div>
      <div className="text-sm text-white/90">{symbol}</div>
    </div>
    <div className="text-sm tabular-nums text-white/90">{value}</div>
  </div>
);

const BalancesPopover: React.FC<{
  anchorRef: React.RefObject<HTMLButtonElement>;
  open: boolean;
  onClose: () => void;
  rows: Array<{ symbol: string; value: string }>;
  native: { symbol: string; value: string };
}> = ({ anchorRef, open, onClose, rows, native }) => {
  const popRef = useRef<HTMLDivElement>(null);

  // Close on outside/ESC (desktop)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!popRef.current || !anchorRef.current) return;
      if (popRef.current.contains(e.target as Node)) return;
      if (anchorRef.current.contains(e.target as Node)) return;
      onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose, anchorRef]);

  // Lock page scroll while the mobile sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // Desktop anchored popover
  const desktop = (
    <div
      ref={popRef}
      className="hidden md:block absolute z-[70] mt-2 w-[360px] right-0 rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur shadow-xl p-4"
      style={{ top: (anchorRef.current?.getBoundingClientRect().bottom ?? 0) + window.scrollY }}
    >
      <div className="mb-3 text-xs uppercase tracking-wide text-white/60">Balances</div>
      <div className="space-y-2">
        <Row symbol={native.symbol} value={native.value} />
        {rows.map((r) => (
          <Row key={r.symbol} symbol={r.symbol} value={r.value} />
        ))}
      </div>
    </div>
  );

  // Mobile bottom sheet — with top-right X, no bottom Close button
  const mobile = (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="bal-bd"
        className="md:hidden fixed inset-0 z-[999] bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ height: "100dvh" }}
      />
      {/* Sheet */}
      <motion.div
        key="bal-sheet"
        className="
          md:hidden fixed inset-x-0 bottom-0 z-[1000]
          rounded-t-[28px] border-t border-white/10
          bg-[#1c1f27] text-white
          shadow-[0_-20px_40px_rgba(0,0,0,0.35)]
          backdrop-blur
          flex flex-col overflow-hidden
        "
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), 12px)",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
          maxHeight: "min(92dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 12px))",
        }}
      >
        {/* Header: grabber + centered title + X */}
        <div className="px-5 pt-2 pb-3 border-b border-white/10">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="justify-self-center h-1.5 w-12 rounded-full bg-white/20" aria-hidden="true" />
            <div className="justify-self-center text-base font-semibold">Balances</div>
            <button
              onClick={onClose}
              className="justify-self-end p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10"
              aria-label="Close balances"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>


        
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4 space-y-2">
          <Row symbol={native.symbol} value={native.value} />
          {rows.map((r) => (
            <Row key={r.symbol} symbol={r.symbol} value={r.value} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <>
      {desktop}
      {createPortal(mobile, document.body)}
    </>
  );
};

const Header: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const navigate = useNavigate();

  const { disconnectAsync } = useDisconnect();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  const activeAddress = address ?? "";
  const shortAddress = activeAddress ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}` : "";

  const [showSettings, setShowSettings] = useState(false);
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);
  const [showBalances, setShowBalances] = useState(false);
  const walletBtnRef = useRef<HTMLButtonElement>(null);

  const [honoraryChip, setHonoraryChip] = useState<null | { imageUrl: string; title: string }>(null);
  useEffect(() => {
    const onMin = (e: Event) => {
      const detail = (e as CustomEvent).detail as { imageUrl: string; title: string };
      if (detail?.imageUrl) setHonoraryChip({ imageUrl: detail.imageUrl, title: detail.title ?? "Honorary Badge" });
    };
    window.addEventListener("honorary:minimize", onMin as EventListener);
    return () => window.removeEventListener("honorary:minimize", onMin as EventListener);
  }, []);

  // 🔗 Listen to footer events
  useEffect(() => {
    const openBalances = () => setShowBalances(true);
    const openSettings = () => setShowSettings(true);
    const openWallet = () => open();

    window.addEventListener("balances:open", openBalances as EventListener);
    window.addEventListener("settings:open", openSettings as EventListener);
    window.addEventListener("wallet:open", openWallet as EventListener);

    return () => {
      window.removeEventListener("balances:open", openBalances as EventListener);
      window.removeEventListener("settings:open", openSettings as EventListener);
      window.removeEventListener("wallet:open", openWallet as EventListener);
    };
  }, [open]);

  const copyAddress = async () => {
    if (!activeAddress) return;
    try {
      await navigator.clipboard.writeText(activeAddress);
      setShowCopiedTooltip(true);
      setTimeout(() => setShowCopiedTooltip(false), 2000);
    } catch {}
  };

  const openAppKit = () => open();

  const handleDisconnect = async () => {
    try { await disconnectAsync(); }
    finally { navigate("/", { replace: true }); }
  };

  async function ensureBsc(): Promise<void> {
    if (!walletClient) return;
    const targetHex = `0x${bsc.id.toString(16)}`;
    let currentHex: string | null = null;
    try { currentHex = (await walletClient.request({ method: "eth_chainId" })) as string; } catch {}
    if (currentHex?.toLowerCase() === targetHex.toLowerCase()) return;
    try {
      await walletClient.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetHex }] });
    } catch (e: any) {
      const needsAdd = e?.code === 4902 || /not added|unrecognized chain/i.test(e?.message || "");
      if (!needsAdd) return;
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

  const { data: nativeBal } = useBalance({
    address, query: { enabled: Boolean(address) },
  });

  const [erc20, setErc20] = useState<
    Record<ErcRow["key"], { symbol: string; decimals: number; value: bigint }>
  >({
    YY: { symbol: "YY", decimals: 18, value: 0n },
    SY: { symbol: "SY", decimals: 18, value: 0n },
    PY: { symbol: "PY", decimals: 18, value: 0n },
    USDT: { symbol: "USDT", decimals: 6, value: 0n },
  });

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      if (!publicClient || !address || !isConnected) return;
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (!online) return;

      try {
        const results = await Promise.all(
          TOKENS.map(async (row) => {
            if (!row.address) return { key: row.key, value: 0n as bigint };
            try {
              const value = (await publicClient.readContract({
                address: row.address,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [address],
              })) as bigint;
              return { key: row.key, value: value ?? 0n };
            } catch {
              return { key: row.key, value: 0n as bigint };
            }
          })
        );
        if (disposed) return;
        setErc20((prev) => {
          const next = { ...prev };
          for (const r of results) {
            const tokenDef = TOKENS.find((t) => t.key === r.key)!;
            next[r.key] = {
              symbol: tokenDef.label,
              decimals: prev[r.key]?.decimals ?? tokenDef.fallbackDecimals,
              value: r.value,
            };
          }
          return next;
        });
      } catch {}
    };

    load();
    const id = setInterval(load, 15_000);
    return () => { disposed = true; clearInterval(id); };
  }, [address, publicClient, isConnected]);

  const popRows = useMemo(
    () =>
      (["YY", "SY", "PY", "USDT"] as const).map((k) => ({
        symbol: erc20[k].symbol,
        value: fmt(erc20[k].value, erc20[k].decimals),
      })),
    [erc20]
  );

  const nativeRow = useMemo(() => {
    const symbol = nativeBal?.symbol || "ETH";
    const value =
      nativeBal?.value && typeof nativeBal.decimals === "number"
        ? fmt(nativeBal.value, nativeBal.decimals)
        : "0";
    return { symbol, value };
  }, [nativeBal]);

  const wrongChain = isConnected && chainId !== bsc.id;

  return (
    <>
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <YearnTogetherMark className="h-7 text-white" />
            </div>

            {/* Desktop */}
            <div className="hidden md:flex items-center space-x-3">
              {isConnected && (
                <>
                  <button
                    ref={walletBtnRef}
                    onClick={() => setShowBalances((v) => !v)}
                    className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    aria-label="Wallet balances" title="Wallet balances"
                  >
                    <Wallet className="w-5 h-5 text-gray-300" />
                  </button>

                  <button
                    onClick={openAppKit}
                    className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    aria-label="Open wallet" title="Open wallet"
                  >
                    <Zap className="w-5 h-5 text-gray-300" />
                  </button>

                  {honoraryChip &&
                    createPortal(
                      <motion.button
                        onClick={() => window.dispatchEvent(new Event("honorary:open"))}
                        className="md:hidden fixed z-[1100] top-[calc(env(safe-area-inset-top,0px)+10px)] right-[calc(env(safe-area-inset-right,0px)+12px)] rounded-full border border-white/20 bg-white/12 backdrop-blur p-1.5 shadow-md active:scale-95"
                        initial={{ opacity: 0, scale: 0.9, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                        aria-label="Open Honorary Badge"
                      >
                        <motion.img
                          src={honoraryChip.imageUrl}
                          alt={honoraryChip.title}
                          className="w-7 h-7 rounded-md ring-1 ring-white/25 object-cover"
                          animate={{ boxShadow: ["0 0 0px rgba(0,0,0,0)", "0 0 10px rgba(255,195,70,0.35)", "0 0 0px rgba(0,0,0,0)"] }}
                          transition={{ repeat: Infinity, duration: 2.8 }}
                        />
                      </motion.button>,
                      document.body
                    )
                  }

                  <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    aria-label="Open settings"
                  >
                    <Settings className="w-5 h-5 text-gray-300" />
                  </button>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 px-3 py-2 bg-green-900/20 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium text-green-300">{shortAddress}</span>
                      <div className="relative">
                        <button
                          onClick={copyAddress}
                          className="p-1 hover:bg-green-800 rounded transition-colors"
                          title="Copy address" aria-label="Copy address"
                        >
                          <Copy className="w-3 h-3 text-green-400" />
                        </button>
                        {showCopiedTooltip && (
                          <div className="absolute top-[110%] left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                            Copied!
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-800" />
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={handleDisconnect}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      Disconnect
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile: no header menu (bottom nav handles actions) */}
            <div className="md:hidden" />
          </div>

          {/* Wrong chain banner */}
          {wrongChain && (
            <div className="mt-2 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm px-3 py-2 flex items-center justify-between">
              <span>You’re on the wrong network. Please switch to BSC Mainnet.</span>
              {walletClient && (
                <button
                  onClick={ensureBsc}
                  className="ml-3 inline-flex items-center rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 px-3 py-1 text-xs font-medium"
                >
                  Switch to BSC
                </button>
              )}
            </div>
          )}
        </div>

        {/* Balances Popover / Sheet */}
        <BalancesPopover
          anchorRef={walletBtnRef}
          open={isConnected ? showBalances : false}
          onClose={() => setShowBalances(false)}
          rows={popRows}
          native={nativeRow}
        />
      </header>

      {/* Settings Modal */}
      {showSettings && isConnected && (
        <UserSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </>
  );
};

export default Header;
