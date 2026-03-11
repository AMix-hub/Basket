"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, UserRole } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("coach");
  const [teamName, setTeamName] = useState("");
  const [ageGroup, setAgeGroup] = useState("≤7 år");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
      return;
    }

    const ok = register(
      name.trim(),
      email.trim().toLowerCase(),
      password,
      role,
      role === "coach" ? teamName.trim() : undefined,
      role === "coach" ? ageGroup : undefined
    );

    if (ok) {
      router.push("/");
    } else {
      setError("E-postadressen används redan. Prova en annan.");
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🏀</span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-3">
            Skapa konto
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Registrera dig för att komma igång
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

            {/* Role */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Roll
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "admin", label: "🏛 Föreningsadmin" },
                    { value: "coach", label: "🎽 Coach" },
                    { value: "assistant", label: "👋 Assistent" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                      role === value
                        ? "bg-orange-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Coach-specific: team name + age group */}
            {role === "coach" && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
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
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
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
              </>
            )}

            {/* Assistant-specific: join via invite code */}
            {role === "assistant" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Inbjudningskod (valfri)
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) =>
                    setInviteCode(e.target.value.toUpperCase())
                  }
                  placeholder="XXXXXX"
                  maxLength={6}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 uppercase tracking-widest"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Fråga din coach om koden för att gå med i laget.
                </p>
              </div>
            )}

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl transition-colors"
            >
              Skapa konto
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
