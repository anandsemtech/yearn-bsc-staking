import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export type UserProfile = {
  address: string;
  email: string | null;
  phone: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function upsertMyProfile(p: UserProfile) {
  // address is the PK
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(p, { onConflict: "address" })
    .select()
    .single();
  if (error) throw error;
  return data as UserProfile;
}

export async function getMyProfile(address: string) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("address", address)
    .single();
  if (error && error.code !== "PGRST116") throw error; // not found is ok
  return (data as UserProfile) || null;
}
