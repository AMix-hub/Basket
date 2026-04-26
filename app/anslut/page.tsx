"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function AnslutPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [ageGroup, setAgeGroup] = useState("≤7 år");
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

    setBusy(true);
    const result = await register(
      name.trim(),
      email.trim().toLowerCase(),
      password,
      "coach",
      teamName.trim(),
      ageGroup,
      inviteCode.trim(),
      undefined,
      undefined
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
            Vi har skickat ett bekräftelsemail till <strong>{email}</strong>.
            Klicka på länken i mailet för att aktivera ditt konto och sedan{" "}
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
          <span className="text-4xl">🏀</span>
          <h1 className="text-2xl font-extrabold text-slate-100 mt-3">
            Skapa nytt lag
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Registrera dig som coach och skapa ditt lag
          </p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Ditt namn
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

            {/* Team name */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Lagets namn
              </label>
              <input
                type="text"
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="T.ex. Röda Laget U9"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Age group */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Åldersgrupp
              </label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="≤7 år">≤7 år (År 1)</option>
                <option value="8 år">8 år (År 2)</option>
                <option value="9 år">9 år (År 3)</option>
              </select>
            </div>

            {/* Admin invite code */}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Admin-inbjudningskod
              </label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 uppercase tracking-widest font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">
                Fråga din föreningsadmin om koden.
              </p>
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
              {busy ? "Registrerar…" : "Skapa lag"}
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
      </div>
    </div>
  );
}
