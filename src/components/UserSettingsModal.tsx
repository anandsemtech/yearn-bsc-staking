import {
  X, Mail, Phone, Save, CheckCircle2, AlertTriangle, Loader2, Copy,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  address: string;
  email: string | null;
  phone: string | null;
  updated_at?: string | null;
};

interface UserSettingsModalProps {
  onClose: () => void;
}

const isValidEmail = (v: string) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const fmtAddress = (addr?: string | null) =>
  (addr && addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr || "—");
const clipCopy = async (text: string) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };

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

  const emailInvalid = useMemo(
    () => touchedEmail && (email.trim().length === 0 || !isValidEmail(email)),
    [email, touchedEmail]
  );
  const changed = useMemo(
    () => email.trim() !== initialEmail || phone.trim() !== initialPhone,
    [email, phone, initialEmail, initialPhone]
  );

  // Load profile
  useEffect(() => {
    let active = true;
    const load = async () => {
      setErrorMsg(null); setSuccessMsg(null); setLoadingProfile(true);
      try {
        if (!isConnected || !address) {
          setEmail(""); setPhone(""); setInitialEmail(""); setInitialPhone(""); return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("address,email,phone,updated_at")
          .eq("address", address.toLowerCase())
          .maybeSingle<ProfileRow>();
        if (error) throw error;
        const em = data?.email ?? ""; const ph = data?.phone ?? "";
        if (!active) return;
        setEmail(em); setPhone(ph); setInitialEmail(em); setInitialPhone(ph); setTouchedEmail(false);
      } catch (err: any) {
        if (!active) return;
        setErrorMsg(err?.message || "Could not fetch your profile. Please try again.");
      } finally { if (active) setLoadingProfile(false); }
    };
    load();
    return () => { active = false; };
  }, [address, isConnected]);

  // Save
  const handleSave = async () => {
    setTouchedEmail(true); setErrorMsg(null); setSuccessMsg(null);
    if (!isConnected || !address) { setErrorMsg("Please connect your wallet first."); return; }
    if (!isValidEmail(email)) { setErrorMsg("Please enter a valid email address."); return; }
    if (!changed) { setSuccessMsg("No changes to save."); return; }

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
      const msg = err?.message || err?.error_description || "Failed to save settings. Please try again.";
      setErrorMsg(msg);
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="settings-backdrop"
        className="fixed inset-0 z-[2100] bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      {/* Sheet (mobile) / Centered card (desktop) */}
      <motion.div
        key="settings-panel"
        className="fixed inset-x-0 bottom-0 md:inset-0 z-[2101] md:flex md:items-center md:justify-center"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
      >
        <div className="mx-auto w-full md:max-w-lg rounded-t-3xl md:rounded-2xl border border-white/10 bg-[#151922]/95 text-white shadow-[0_-20px_60px_rgba(0,0,0,.45)] md:shadow-[0_20px_80px_-20px_rgba(0,0,0,.6)] overflow-hidden">
          <div className="px-5 md:px-6 pt-3 md:pt-5 pb-3 border-b border-white/10 flex items-center gap-3">
            <div className="mx-auto md:mx-0 md:mr-2 h-1.5 w-12 md:hidden rounded-full bg-white/20" />
            <h2 className="text-base md:text-lg font-semibold">User Settings</h2>
            <button onClick={onClose} className="ml-auto p-2 rounded-lg hover:bg-white/10" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 md:p-6 space-y-5">
            {successMsg && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-200 border border-emerald-400/30">
                <CheckCircle2 className="w-5 h-5 mt-0.5" />
                <div className="text-sm">{successMsg}</div>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-200 border border-amber-400/30">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <div className="text-sm">{errorMsg}</div>
              </div>
            )}

            {/* Wallet */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Wallet Address</label>
              <div className="flex items-center gap-2">
                <div className="px-4 py-3 bg-white/[0.06] rounded-lg text-sm font-mono text-white/90 break-all flex-1 select-all ring-1 ring-white/10">
                  {address || "—"}
                </div>
                {address && (
                  <button
                    className="px-3 py-2 rounded-lg ring-1 ring-white/10 hover:bg-white/10 transition"
                    onClick={async () => { const ok = await clipCopy(address); setCopied(ok); setTimeout(() => setCopied(false), 1200); }}
                    title="Copy address"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-white/60">
                {fmtAddress(address)} {isConnected ? "• Connected" : "• Not connected"}
              </p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouchedEmail(true)}
                  placeholder="name@domain.com"
                  className={`w-full pl-12 pr-4 py-3 rounded-lg bg-white/[0.06] text-white placeholder:text-white/40 ring-1 focus:ring-2 transition
                  ${emailInvalid ? "ring-rose-400/60 focus:ring-rose-400/80" : "ring-white/10 focus:ring-indigo-400/60"}`}
                  aria-invalid={emailInvalid}
                  disabled={!isConnected || loadingProfile}
                />
              </div>
              {emailInvalid && <p className="mt-1 text-xs text-rose-300">Please enter a valid email.</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Phone Number <span className="text-xs text-white/40">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-12 pr-4 py-3 rounded-lg bg-white/[0.06] text-white placeholder:text-white/40 ring-1 ring-white/10 focus:ring-2 focus:ring-indigo-400/60 transition"
                  disabled={!isConnected || loadingProfile}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-lg ring-1 ring-white/15 text-white/90 hover:bg-white/10 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || loadingProfile || !isConnected || !address || emailInvalid || email.trim().length === 0 || !changed}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700 transition disabled:opacity-60"
              >
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>Saving…</span></>)
                          : (<><Save className="w-4 h-4" /><span>{changed ? "Save" : "Saved"}</span></>)}
              </button>
            </div>

            {loadingProfile && (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading your profile…
              </div>
            )}
            {copied && <div className="text-xs text-emerald-300">Address copied!</div>}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UserSettingsModal;
