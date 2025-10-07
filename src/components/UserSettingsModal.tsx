import { X, Mail, Phone, Save, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import React, { useMemo, useState } from "react";

import { upsertMyProfile } from "@/services/profiles.supabase";
import { useWallet } from "@/contexts/hooks/useWallet";


interface UserSettingsModalProps {
  onClose: () => void;
}

const isValidEmail = (value: string) => {
  if (!value) return false;
  // Simple but effective RFC5322-lite pattern for typical emails
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ onClose }) => {
  const { user, updateUserProfile } = useWallet();
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [loading, setLoading] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const emailInvalid = useMemo(() => {
    if (!touchedEmail) return false;
    if (email.trim().length === 0) return true;
    return !isValidEmail(email);
  }, [email, touchedEmail]);

  const handleSave = async () => {
    setTouchedEmail(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user?.address) {
      setErrorMsg("Wallet not connected.");
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      const saved = await upsertMyProfile({
        address: user.address,
        email: email.trim(),
        phone: phone.trim() || null,
      });

      // Update local context so header/other parts reflect new info immediately
      updateUserProfile?.(saved.email || "", saved.phone || "");

      setSuccessMsg("Your settings were saved successfully.");
      // Optional: auto-close after a brief delay
      // setTimeout(onClose, 900);
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            User Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Wallet Address
            </label>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
              {user?.address ?? "—"}
            </div>
          </div>

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
                placeholder="Enter your email"
                className={`w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border rounded-lg focus:ring-2 focus:border-transparent transition-all placeholder:text-gray-900 dark:placeholder:text-white
                ${
                  emailInvalid
                    ? "border-rose-400 focus:ring-rose-400"
                    : "border-gray-200 dark:border-gray-600 focus:ring-purple-500"
                }`}
                aria-invalid={emailInvalid}
                aria-describedby="email-help"
              />
            </div>
            {emailInvalid && (
              <p id="email-help" className="mt-1 text-xs text-rose-500">
                Please enter a valid email (e.g., name@domain.com).
              </p>
            )}
          </div>

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
                placeholder="Enter your phone number"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !user?.address || emailInvalid || email.trim().length === 0}
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
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettingsModal;
