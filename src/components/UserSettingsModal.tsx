// src/components/UserSettingsModal.tsx
import {
  X,
  Mail,
  Phone,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAppKitAccount } from "@reown/appkit/react";

/* ========= Supabase (simple local client) ========= */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Soft guard to help during dev
  // eslint-disable-next-line no-console
  console.warn(
    "[UserSettingsModal] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY"
  );
}
const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "");

type ProfileRow = {
  address: string;
  email: string | null;
  phone: string | null;
  updated_at?: string | null;
};

interface UserSettingsModalProps {
  onClose: () => void;
}

/* ========= Utils ========= */
const isValidEmail = (value: string) => {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

const fmtAddress = (addr?: string | null) =>
  addr && addr.length > 10
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : addr || "—";

const clipCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ onClose }) => {
  const { address, isConnected } = useAppKitAccount();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [initialEmail, setInitialEmail] = useState("");
  const [initialPhone, setInitialPhone] = useState("");

  const [touchedEmail, setTouchedEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const emailInvalid = useMemo(() => {
    if (!touchedEmail) return false;
    if (email.trim().length === 0) return true;
    return !isValidEmail(email);
  }, [email, touchedEmail]);

  const changed = useMemo(
    () => email.trim() !== initialEmail || phone.trim() !== initialPhone,
    [email, phone, initialEmail, initialPhone]
  );

  /* ========= Load existing profile when address changes ========= */
  useEffect(() => {
    let active = true;

    const load = async () => {
      setErrorMsg(null);
      setSuccessMsg(null);
      setLoadingProfile(true);

      try {
        if (!isConnected || !address) {
          setEmail("");
          setPhone("");
          setInitialEmail("");
          setInitialPhone("");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("address,email,phone,updated_at")
          .eq("address", address.toLowerCase())
          .maybeSingle<ProfileRow>();

        if (error) throw error;

        const em = data?.email ?? "";
        const ph = data?.phone ?? "";

        if (!active) return;
        setEmail(em);
        setPhone(ph);
        setInitialEmail(em);
        setInitialPhone(ph);
        setTouchedEmail(false);
      } catch (err: any) {
        if (!active) return;
        setErrorMsg(
          err?.message ||
            "Could not fetch your profile from Supabase. Please try again."
        );
      } finally {
        if (active) setLoadingProfile(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [address, isConnected]);

  /* ========= Save/upsert handler ========= */
  const handleSave = async () => {
    setTouchedEmail(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isConnected || !address) {
      setErrorMsg("Please connect your wallet first.");
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!changed) {
      setSuccessMsg("No changes to save.");
      return;
    }

    try {
      setLoading(true);
      const payload: ProfileRow = {
        address: address.toLowerCase(),
        email: email.trim(),
        phone: phone.trim() || null,
      };

      const { data, error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "address" })
        .select()
        .maybeSingle<ProfileRow>();

      if (error) throw error;

      setInitialEmail(data?.email ?? payload.email ?? "");
      setInitialPhone(data?.phone ?? payload.phone ?? "");
      setSuccessMsg("Your settings were saved successfully.");
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.error_description ||
        "Failed to save settings. Please try again.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ========= UI ========= */
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Bottom-up sheet on mobile; card on desktop */}
      <div className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/70 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 opacity-90" />
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              User Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Alerts */}
          {successMsg && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 text-green-800 border border-green-200">
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
              <div className="text-sm">{successMsg}</div>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <AlertTriangle className="w-5 h-5 mt-0.5" />
              <div className="text-sm">{errorMsg}</div>
            </div>
          )}

          {/* Wallet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Wallet Address
            </label>
            <div className="flex items-center gap-2">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm font-mono text-gray-700 dark:text-gray-300 break-all flex-1 select-all">
                {address || "—"}
              </div>
              {address && (
                <button
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  onClick={async () => {
                    const ok = await clipCopy(address);
                    setCopied(ok);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                  title="Copy address"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {fmtAddress(address)} {isConnected ? "• Connected" : "• Not connected"}
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                onBlur={() => setTouchedEmail(true)}
                placeholder="name@domain.com"
                className={`w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border rounded-lg focus:ring-2 focus:border-transparent transition-all placeholder:text-gray-500 dark:placeholder:text-gray-400
                ${
                  emailInvalid
                    ? "border-rose-400 focus:ring-rose-400"
                    : "border-gray-200 dark:border-gray-700 focus:ring-purple-500"
                }`}
                aria-invalid={emailInvalid}
                aria-describedby="email-help"
                disabled={!isConnected || loadingProfile}
              />
            </div>
            {emailInvalid && (
              <p id="email-help" className="mt-1 text-xs text-rose-500">
                Please enter a valid email (e.g., name@domain.com).
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                disabled={!isConnected || loadingProfile}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                loading ||
                loadingProfile ||
                !isConnected ||
                !address ||
                emailInvalid ||
                email.trim().length === 0 ||
                !changed
              }
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{changed ? "Save" : "Saved"}</span>
                </>
              )}
            </button>
          </div>

          {/* Loading overlay when fetching profile */}
          {loadingProfile && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your profile…
            </div>
          )}

          {/* Copy toast-ish */}
          {copied && (
            <div className="text-xs text-green-600 dark:text-green-400">
              Address copied!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSettingsModal;
