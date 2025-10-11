import React from "react";
import { Check, AlertTriangle, X } from "lucide-react";

type Props = {
  addr: `0x${string}`;
  valid: boolean | null;     // null = pending/unknown
  checking?: boolean;
  onClear?: () => void;
};

export default function ReferrerBadge({ addr, valid, checking, onClear }: Props) {
  const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  return (
    <div className="mb-4 rounded-xl px-3 py-2 bg-white/6 dark:bg-white/10 border border-white/15 backdrop-blur flex items-center gap-2 text-sm text-white">
      <span className="opacity-80">You’re referred by</span>
      <code className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono">{short}</code>
      {checking ? (
        <div className="ml-1 w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
      ) : valid === true ? (
        <Check className="text-emerald-400 w-4 h-4" />
      ) : valid === false ? (
        <AlertTriangle className="text-rose-400 w-4 h-4" />
      ) : null}
      {onClear && (
        <button
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 active:bg-white/20 transition"
          onClick={onClear}
          title="Clear referrer"
        >
          <X className="w-3.5 h-3.5" />
          <span className="text-xs">Clear</span>
        </button>
      )}
    </div>
  );
}
