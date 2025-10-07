// src/components/ui/ToastHub.tsx
import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "warning";
type ToastDetail = {
  title?: string;
  description?: string;
  severity?: "low" | "medium" | "high";
  durationMs?: number;
};
type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
};

const DURATION = { success: 4000, info: 4000, warning: 5000, error: 6500 };

function kindIcon(kind: ToastKind) {
  const cls = "w-5 h-5";
  switch (kind) {
    case "success": return <CheckCircle2 className={`${cls} text-emerald-400`} />;
    case "error":   return <XCircle className={`${cls} text-rose-400`} />;
    case "warning": return <AlertTriangle className={`${cls} text-amber-400`} />;
    default:        return <Info className={`${cls} text-blue-400`} />;
  }
}

export default function ToastHub() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  function push(kind: ToastKind, detail?: ToastDetail) {
    const id = crypto.randomUUID();
    const title =
      detail?.title ??
      (kind === "success" ? "Success" : kind === "error" ? "Error" : kind === "warning" ? "Warning" : "Info");
    const duration = Math.max(1500, detail?.durationMs ?? DURATION[kind]);
    const t: Toast = { id, kind, title, description: detail?.description, duration };
    setToasts((prev) => [...prev, t]);
    const timeout = window.setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timeout);
  }

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      window.clearTimeout(tm);
      timers.current.delete(id);
    }
  }

  useEffect(() => {
    const onSuccess = (e: Event) => push("success", (e as CustomEvent<ToastDetail>).detail);
    const onError   = (e: Event) => push("error",   (e as CustomEvent<ToastDetail>).detail);
    const onInfo    = (e: Event) => push("info",    (e as CustomEvent<ToastDetail>).detail);
    const onWarn    = (e: Event) => push("warning", (e as CustomEvent<ToastDetail>).detail);

    window.addEventListener("toast:success", onSuccess);
    window.addEventListener("toast:error", onError);
    window.addEventListener("toast:info", onInfo);
    window.addEventListener("toast:warning", onWarn);

    return () => {
      window.removeEventListener("toast:success", onSuccess);
      window.removeEventListener("toast:error", onError);
      window.removeEventListener("toast:info", onInfo);
      window.removeEventListener("toast:warning", onWarn);
      // cleanup timers
      timers.current.forEach((tm) => window.clearTimeout(tm));
      timers.current.clear();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col gap-2 items-center sm:items-end sm:right-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className="pointer-events-auto w-[92%] sm:w-[360px] rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur
                     bg-gray-900/90 border-white/10 text-white"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{kindIcon(t.kind)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{t.title}</div>
              {t.description && (
                <div className="text-xs text-white/80 mt-0.5 whitespace-pre-line break-words">
                  {t.description}
                </div>
              )}
            </div>
            <button
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-1 rounded hover:bg-white/10"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
