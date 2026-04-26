import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
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
      <head>
        {/* Set theme class before React hydrates to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark');})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ThemeProvider>
            <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
          </ThemeProvider>
        </AuthProvider>

        {/*
         * Google Cast Sender SDK
         *
         * The __onGCastApiAvailable callback MUST be defined before
         * cast_sender.js is loaded.  Without it the Cast API will not
         * initialise and Chrome will not start mDNS discovery for
         * Chromecast devices on the local network, meaning the device
         * picker opened by PresentationRequest.start() will be empty.
         *
         * We use the W3C Presentation API (useCast hook) for session
         * management, so the callback itself can be minimal – its mere
         * existence is what triggers Chrome's Cast initialisation.
         */}
        <Script
          id="cast-api-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window['__onGCastApiAvailable'] = function() {};`,
          }}
        />
        <Script
          src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}

