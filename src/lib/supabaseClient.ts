import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn("[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

// Cache on globalThis to avoid multiple instances during HMR
const g = globalThis as any;

export const supabase: SupabaseClient =
  g.__ytSupabase ??
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Dedicated storage key prevents clashes with other apps in the same origin
      storageKey: "yt_settings_auth",
      // If you don’t need persisted sessions, you could disable it:
      // persistSession: false,
    },
  });

g.__ytSupabase = supabase;
