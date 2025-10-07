// src/components/UserSettingsModal.tsx
import React from "react";
import { X, ArrowRightLeft } from "lucide-react";
import { useWalletClient, useChainId } from "wagmi";
import { bsc } from "viem/chains";

export default function UserSettingsModal({ onClose }: { onClose: () => void }) {
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const ensureBsc = async () => {
    if (!walletClient) return;
    const targetHex = `0x${bsc.id.toString(16)}`;
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
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-5 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-gray-300 hover:bg-gray-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-semibold text-white mb-2">Settings</h3>
        <p className="text-sm text-gray-400 mb-4">Quick wallet and network actions.</p>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-300">
            Current network:{" "}
            <span className="font-semibold">{chainId === bsc.id ? "BSC Mainnet" : `Chain ID ${chainId}`}</span>
          </div>

          <button
            onClick={ensureBsc}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 font-medium"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Switch to BSC
          </button>
        </div>
      </div>
    </div>
  );
}
