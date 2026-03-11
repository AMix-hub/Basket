import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Supabase public credentials (anon / publishable keys – safe for the browser).
    // Supabase supports both classic JWT keys (eyJ...) and the newer
    // Publishable Key format (sb_publishable_...). Both are valid here.
    //
    // These values are baked into the client bundle at build time by Next.js.
    // When the environment variables are already set in the deployment platform
    // (e.g. Vercel project settings), those values take precedence because
    // process.env.NEXT_PUBLIC_* is evaluated first.  The right-hand fallbacks
    // below ensure the app works out-of-the-box even when the variables have
    // not been configured separately in the platform.
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://gkgrilmlqalkysooyrfo.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "sb_publishable_W1H2zrteCOSw-UKBHYrkKQ_FESMCmM2",
  },
};

export default nextConfig;
