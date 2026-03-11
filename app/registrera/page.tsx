"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [error, setError]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
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
      clubName.trim()
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
          <h1 className="text-2xl font-extrabold text-slate-900 mt-4 mb-2">
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
          <h1 className="text-2xl font-extrabold text-slate-900 mt-3">
            Skapa föreningskonto
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Registrera dig som föreningsadmin för att komma igång
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
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
              <label className="block text-sm font-semibold text-slate-700 mb-1">
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
              <label className="block text-sm font-semibold text-slate-700 mb-1">
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

            {/* Club name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
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

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">
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
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-700 text-center">
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
