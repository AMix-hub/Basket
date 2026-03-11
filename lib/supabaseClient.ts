import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] Miljövariabler saknas. " +
    "Kopiera .env.example till .env.local och fyll i dina Supabase-uppgifter."
  );
}

/**
 * Supabase client used throughout the app.
 * Auth, database and realtime all go through this single instance.
 *
 * Fallback placeholder values are used when env-vars are absent (e.g. during
 * `next build` on CI / Vercel without env vars configured) so that the module
 * can be evaluated without throwing.  All actual API calls will fail gracefully
 * in that case — the app requires real credentials at runtime.
 */
export const supabase = createClient(
  supabaseUrl  || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
