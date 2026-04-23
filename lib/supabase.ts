import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url || !anon) {
  console.warn(
    "[Supabase] Miljövariabler saknas. Sätt NEXT_PUBLIC_SUPABASE_URL och " +
    "NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local"
  );
}

// Singleton browser client — safe to import in client components.
export const supabase = createClient(url || "https://placeholder.supabase.co", anon || "placeholder");
