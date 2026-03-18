"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { SPORTS } from "../../lib/sports";
import type { SportId } from "../../lib/sports";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [sport, setSport]       = useState<SportId>("basket");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const passwordsMatch = !confirmPassword || password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Lösenorden matchar inte.");
      return;
    }
    if (!clubName.trim()) {
      setError("Ange föreningens namn.");
      return;
    }

    setBusy(true);
    const result = await register(
      name.trim(),
      email.trim().toLowerCase(),
      password,
      "admin",
      undefined,
      undefined,
      undefined,
      undefined,
      clubName.trim(),
      sport
    );
    setBusy(false);

    if (result === null) {
      router.push("/");
    } else if (result === "CONFIRM_EMAIL") {
      setEmailSent(true);
    } else {
      setError(result);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-sm text-center">
          <span className="text-5xl">📧</span>
          <h1 className="text-2xl font-extrabold text-slate-100 mt-4 mb-2">
            Bekräfta din e-post
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Vi har skickat ett bekräftelsemail till{" "}
            <strong>{email}</strong>. Klicka på länken i mailet för att
            aktivera ditt konto och sedan{" "}
            <Link href="/login" className="text-orange-600 font-semibold hover:underline">
              logga in
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🏛</span>
          <h1 className="text-2xl font-extrabold text-slate-100 mt-3">
            Skapa föreningskonto
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Registrera dig som föreningsadmin för att komma igång
          </p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Namn
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ditt namn"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Email */}
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

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Lösenord
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minst 6 tecken"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Bekräfta lösenord
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Upprepa lösenordet"
                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 ${
                  confirmPassword && !passwordsMatch
                    ? "border-red-400 focus:ring-red-400"
                    : confirmPassword && passwordsMatch
                    ? "border-emerald-400 focus:ring-emerald-400"
                    : "border-slate-200 focus:ring-orange-400"
                }`}
              />
              {confirmPassword && (
                <p className={`text-xs mt-1 ${passwordsMatch ? "text-emerald-600" : "text-red-600"}`}>
                  {passwordsMatch ? "✓ Lösenorden matchar" : "✗ Lösenorden matchar inte"}
                </p>
              )}
            </div>

            {/* Club name */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Föreningens namn
              </label>
              <input
                type="text"
                required
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="T.ex. Borlänge Basket"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Sport selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Sport
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SPORTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSport(s.id)}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 ${
                      sport === s.id
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-slate-50 text-slate-300 border-slate-200 hover:border-orange-300"
                    }`}
                  >
                    <span>{s.emoji}</span>
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-900/30 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors"
            >
              {busy ? "Skapar konto…" : "Skapa konto"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Har du redan ett konto?{" "}
            <Link
              href="/login"
              className="text-orange-600 font-semibold hover:underline"
            >
              Logga in
            </Link>
          </p>
        </div>

        {/* Invite-code join link */}
        <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700/50 rounded-2xl text-sm text-blue-300 text-center">
          <p className="font-semibold mb-1">Har du fått en inbjudningskod?</p>
          <p className="text-blue-600 text-xs mb-2">
            Coacher, assistenter, föräldrar och spelare registrerar sig via
            inbjudningskoden de fått av admin eller coach.
          </p>
          <Link
            href="/anslut"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Gå med med inbjudningskod →
          </Link>
        </div>
      </div>
    </div>
  );
}

