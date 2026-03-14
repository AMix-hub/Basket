import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase public credentials are read from NEXT_PUBLIC_FIREBASE_* environment variables.
  // Set these in your .env.local (local dev) or in your deployment platform's environment
  // settings (e.g. Vercel project settings).
  // See .env.example for the full list of required variables.
  images: {
    remotePatterns: [
      {
        // Firebase Storage download URLs
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
