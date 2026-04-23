/**
 * Supabase Admin client — server-side only (uses service role key).
 * Never import this in client components.
 */
import { createClient } from "@supabase/supabase-js";

const url         = process.env.NEXT_PUBLIC_SUPABASE_URL       ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY      ?? "";

export const supabaseAdmin = serviceRole
  ? createClient(url, serviceRole, { auth: { persistSession: false } })
  : null;
