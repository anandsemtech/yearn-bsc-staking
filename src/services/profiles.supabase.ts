import { supabase } from "@/lib/supabaseClient";

export type UserProfile = {
  address: string;
  email: string | null;
  phone: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Upsert by primary key (address). Always lowercases address. */
export async function upsertMyProfile(p: UserProfile) {
  const payload: UserProfile = {
    ...p,
    address: p.address.toLowerCase(),
  };

  const { data, error } = await supabase
    .from("profiles") // ← keep table name consistent with the modal
    .upsert(payload, { onConflict: "address" })
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

/** Returns null if not found. Address is normalized to lowercase. */
export async function getMyProfile(address: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("address", address.toLowerCase())
    .maybeSingle();

  // PGRST116 = "Results contain 0 rows" (supabase-js maps this to null with maybeSingle)
  if (error) throw error;
  return (data as UserProfile) || null;
}
