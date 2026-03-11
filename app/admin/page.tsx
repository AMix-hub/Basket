"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, Team } from "../context/AuthContext";

const TEAMS_KEY = "basketball_teams";

export default function AdminPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const allTeams: Team[] =
    typeof window !== "undefined"
      ? (JSON.parse(localStorage.getItem(TEAMS_KEY) || "[]") as Team[])
      : [];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🏛</p>
          <p className="text-slate-600 mb-4">
            Du behöver logga in för att se adminsidan.
          </p>
          <Link
            href="/login"
            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600"
          >
            Logga in
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-slate-600">
            Den här sidan är bara tillgänglig för föreningsadmins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🏛</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Föreningsadmin
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          Bjud in coacher och se alla lag i föreningen.
        </p>
      </div>

      {/* Coach invite code */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="font-bold text-slate-900 mb-1">
          Inbjudningskod för coacher
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          Dela denna kod med coacher så de kan registrera sig och skapa sitt lag.
        </p>

        {user.coachInviteCode ? (
          <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-600 mb-0.5">
                🎽 Coach-inbjudningskod
              </p>
              <p className="font-mono text-2xl font-bold text-blue-900 tracking-widest">
                {user.coachInviteCode}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(user.coachInviteCode!)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-blue-200 text-blue-700 hover:bg-blue-300"
              }`}
            >
              {copied ? "✓ Kopierad!" : "📋 Kopiera"}
            </button>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">
            Ingen inbjudningskod hittades. Logga ut och in igen.
          </p>
        )}
      </div>

      {/* All teams */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h2 className="font-bold text-slate-900 mb-4">
          Alla lag ({allTeams.length})
        </h2>
        {allTeams.length === 0 ? (
          <p className="text-slate-400 text-sm">
            Inga lag registrerade ännu. Bjud in en coach för att komma igång.
          </p>
        ) : (
          <ul className="space-y-3">
            {allTeams.map((team) => (
              <li
                key={team.id}
                className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800">
                    {team.name}
                  </p>
                  {team.ageGroup && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {team.ageGroup} · {team.memberIds.length}{" "}
                      {team.memberIds.length === 1 ? "medlem" : "medlemmar"}
                    </p>
                  )}
                </div>
                <span className="text-2xl shrink-0">🏀</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
