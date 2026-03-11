import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";
import CoachClipboard from "./components/CoachClipboard";
import { AuthProvider } from "./context/AuthContext";

export const metadata: Metadata = {
  title: "Basket Träningsplanering",
  description:
    "Träningsplanering för en hel säsong – för coacher med barn 7–9 år",
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
          <Navbar />
          <main className="max-w-5xl mx-auto px-4 py-10">{children}</main>
          <CoachClipboard />
        </AuthProvider>
      </body>
    </html>
  );
}
