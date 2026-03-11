import { createClient } from "@supabase/supabase-js";

const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "";
const supabaseAnonKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] Miljövariabler saknas. " +
    "Kopiera .env.example till .env.local och fyll i dina Supabase-uppgifter."
  );
}

/**
 * Supabase client used throughout the app.
 * Auth, database and realtime all go through this single instance.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
