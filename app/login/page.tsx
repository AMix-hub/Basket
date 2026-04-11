"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [busy, setBusy]             = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);

  // After a successful login the auth state updates asynchronously.
  // Redirect to the dashboard once the user object is populated.
  // If loading finishes but user is still null, something went wrong after
  // Firebase auth succeeded (e.g. Firestore unreachable) – show an error.
  useEffect(() => {
    if (!loginAttempted || loading) return;
    if (user) {
      router.push("/");
    } else {
      setError(
        "Inloggning lyckades men profilen kunde inte laddas. " +
        "Kontrollera din internetanslutning och försök igen."
      );
      setLoginAttempted(false);
    }
  }, [loginAttempted, loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const err = await login(email.trim().toLowerCase(), password);
    setBusy(false);
    if (err === null) {
      setLoginAttempted(true);
    } else {
      setError(err);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🏆</span>
          <h1 className="text-2xl font-extrabold text-slate-100 mt-3">
            Logga in
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Välkommen tillbaka!
          </p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                E-post
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@epost.se"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Lösenord
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-900/30 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || (loginAttempted && loading)}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors"
            >
              {busy || (loginAttempted && loading) ? "Loggar in…" : "Logga in"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Inget konto?{" "}
            <Link
              href="/registrera"
              className="text-orange-600 font-semibold hover:underline"
            >
              Registrera dig
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

