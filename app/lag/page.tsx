"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, User } from "../context/AuthContext";

const USERS_KEY = "basketball_users";

export default function LagPage() {
  const { user, getMyTeam, joinTeam } = useAuth();
  const team = getMyTeam();

  // Load users once from localStorage (read-only for member list display)
  const allUsers: User[] =
    typeof window !== "undefined"
      ? (JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as User[])
      : [];

  const [copied, setCopied] = useState<string | null>(null);

  // For joining a team without one
  const [joinCode, setJoinCode] = useState("");
  const [joinChildName, setJoinChildName] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState(false);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback: select text
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    const ok = joinTeam(
      joinCode.trim().toUpperCase(),
      user?.role === "parent" ? joinChildName.trim() : undefined
    );
    if (ok) {
      setJoinSuccess(true);
      setJoinCode("");
    } else {
      setJoinError("Ogiltig kod. Kontrollera att du skrivit rätt.");
    }
  };

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🏀</p>
          <p className="text-slate-600 mb-4">
            Du behöver logga in för att se laginfo.
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

  // Members of the team
  const members = team
    ? allUsers.filter((u) => team.memberIds.includes(u.id))
    : [];

  const roleLabel: Record<string, string> = {
    admin: "🏛 Admin",
    coach: "🎽 Coach",
    assistant: "👋 Assistent",
    parent: "👪 Förälder",
    player: "🏃 Spelare",
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🏀</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Mitt lag
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          Laginfo, inbjudningskoder och medlemmar.
        </p>
      </div>

      {/* No team: join form */}
      {!team && !joinSuccess && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="font-bold text-slate-900 mb-1">
            Du är inte med i något lag
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Ange en inbjudningskod från din coach för att gå med.
          </p>
          <form onSubmit={handleJoin} className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Inbjudningskod
              </label>
              <input
                type="text"
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full max-w-xs px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 uppercase tracking-widest font-mono"
              />
            </div>
            {user.role === "parent" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Barnets namn
                </label>
                <input
                  type="text"
                  required
                  value={joinChildName}
                  onChange={(e) => setJoinChildName(e.target.value)}
                  placeholder="Barnets namn i spelarlistan"
                  className="w-full max-w-xs px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            )}
            {joinError && (
              <p className="text-red-600 text-sm">{joinError}</p>
            )}
            <button
              type="submit"
              className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Gå med i laget
            </button>
          </form>
        </div>
      )}

      {joinSuccess && !team && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-700 text-sm font-medium">
          ✓ Du har gått med i laget! Ladda om sidan för att se laginformationen.
        </div>
      )}

      {/* Team info (if in a team) */}
      {team && (
        <>
          {/* Team card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {team.name}
                </h2>
                {team.ageGroup && (
                  <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                    {team.ageGroup}
                  </span>
                )}
              </div>
              <span className="text-3xl">🏀</span>
            </div>
          </div>

          {/* Invite codes – only visible to coach */}
          {user.role === "coach" && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="font-bold text-slate-900 mb-4">
                Inbjudningskoder
              </h2>
              <p className="text-slate-500 text-sm mb-4">
                Dela dessa koder med rätt person. Assistenter och föräldrar
                använder olika koder.
              </p>
              <div className="space-y-3">
                {/* Staff code */}
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-500 mb-0.5">
                      👋 Assistenter / personal
                    </p>
                    <p className="font-mono text-xl font-bold text-slate-900 tracking-widest">
                      {team.inviteCode}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(team.inviteCode, "staff")
                    }
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                      copied === "staff"
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    {copied === "staff" ? "✓ Kopierad!" : "📋 Kopiera"}
                  </button>
                </div>

                {/* Parent code */}
                <div className="flex items-center gap-3 bg-orange-50 rounded-xl px-4 py-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-orange-600 mb-0.5">
                      👪 Föräldrar
                    </p>
                    <p className="font-mono text-xl font-bold text-orange-800 tracking-widest">
                      {team.parentInviteCode}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(team.parentInviteCode, "parent")
                    }
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                      copied === "parent"
                        ? "bg-emerald-500 text-white"
                        : "bg-orange-200 text-orange-700 hover:bg-orange-300"
                    }`}
                  >
                    {copied === "parent" ? "✓ Kopierad!" : "📋 Kopiera"}
                  </button>
                </div>

                {/* Player code */}
                <div className="flex items-center gap-3 bg-emerald-50 rounded-xl px-4 py-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-emerald-600 mb-0.5">
                      🏃 Spelare
                    </p>
                    <p className="font-mono text-xl font-bold text-emerald-800 tracking-widest">
                      {team.playerInviteCode}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(team.playerInviteCode, "player")
                    }
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                      copied === "player"
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-200 text-emerald-700 hover:bg-emerald-300"
                    }`}
                  >
                    {copied === "player" ? "✓ Kopierad!" : "📋 Kopiera"}
                  </button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                💡 <strong>Tips:</strong> Dela rätt kod med rätt person — assistentkod (grå) till assistenter,
                föräldrainbjudningskod (orange) till föräldrar och spelarkod (grön) till spelare.
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-slate-900 mb-4">
              Lagmedlemmar ({members.length})
            </h2>
            {members.length === 0 ? (
              <p className="text-slate-400 text-sm">
                Inga medlemmar i laget ännu.
              </p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800">
                        {m.name}
                      </p>
                      {m.role === "parent" && m.childName && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Förälder till {m.childName}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500 shrink-0">
                      {roleLabel[m.role] ?? m.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
