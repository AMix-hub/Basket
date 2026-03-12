import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ClientLayoutWrapper } from "./ClientLayoutWrapper";

export const metadata: Metadata = {
  title: "Basket Träningsplanering",
  description:
    "Träningsplanering för en hel säsong – för coacher med barn 7–9 år",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Basket",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className="antialiased bg-slate-50 text-slate-900">
        <AuthProvider>
          <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        </AuthProvider>

        {/*
         * Google Cast Sender SDK
         * Loading this script tells Chrome that the app supports casting.
         * Chrome will automatically show the Cast icon in the address bar
         * when a compatible device (Chromecast) is on the local network,
         * and will use navigator.presentation.defaultRequest (set by the
         * useCast hook) to know which URL to open on the receiver.
         */}
        <Script
          src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}

