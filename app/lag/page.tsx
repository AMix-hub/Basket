"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../../lib/roleLabels";
import { supabase } from "../../lib/supabaseClient";

interface ProfileRow {
  id: string;
  name: string;
  role: string;
  child_name: string | null;
}

export default function LagPage() {
  const { user, getMyTeam, joinTeam } = useAuth();
  const team = getMyTeam();

  const [members, setMembers]       = useState<ProfileRow[]>([]);
  const [copied, setCopied]         = useState<string | null>(null);
  const [joinCode, setJoinCode]     = useState("");
  const [joinChildName, setJoinChildName] = useState("");
  const [joinError, setJoinError]   = useState("");
  const [joinSuccess, setJoinSuccess] = useState(false);

  /* Load team members from Supabase */
  useEffect(() => {
    if (!team) return;
    (async () => {
      const { data: memberRows } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", team.id);

      const ids = (memberRows ?? []).map((m) => m.user_id);
      if (ids.length === 0) { setMembers([]); return; }

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, name, role, child_name")
        .in("id", ids);

      setMembers((profileRows ?? []) as ProfileRow[]);
    })();
  }, [team]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    const ok = await joinTeam(
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

      {/* Team info */}
      {team && (
        <>
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

          {/* Invite codes (coach only) */}
          {user.role === "coach" && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
              <h2 className="font-bold text-slate-900 mb-4">Inbjudningskoder</h2>
              <p className="text-slate-500 text-sm mb-4">
                Dela dessa koder med rätt person. Assistenter och föräldrar
                använder olika koder.
              </p>
              <div className="space-y-3">
                {[
                  { key: "staff",  label: "👋 Assistenter / personal", code: team.inviteCode,        bg: "bg-slate-50",    text: "text-slate-500",   mono: "text-slate-900",   btn: "bg-slate-200 text-slate-700 hover:bg-slate-300" },
                  { key: "parent", label: "👪 Föräldrar",               code: team.parentInviteCode,  bg: "bg-orange-50",   text: "text-orange-600",  mono: "text-orange-800",  btn: "bg-orange-200 text-orange-700 hover:bg-orange-300" },
                  { key: "player", label: "🏃 Spelare",                 code: team.playerInviteCode,  bg: "bg-emerald-50",  text: "text-emerald-600", mono: "text-emerald-800", btn: "bg-emerald-200 text-emerald-700 hover:bg-emerald-300" },
                ].map(({ key, label, code, bg, text, mono, btn }) => (
                  <div key={key} className={`flex items-center gap-3 ${bg} rounded-xl px-4 py-3`}>
                    <div className="flex-1">
                      <p className={`text-xs font-semibold ${text} mb-0.5`}>{label}</p>
                      <p className={`font-mono text-xl font-bold ${mono} tracking-widest`}>{code}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(code, key)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                        copied === key ? "bg-emerald-500 text-white" : btn
                      }`}
                    >
                      {copied === key ? "✓ Kopierad!" : "📋 Kopiera"}
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                💡 <strong>Tips:</strong> Dela rätt kod med rätt person — assistentkod (grå) till
                assistenter, föräldrainbjudningskod (orange) till föräldrar och spelarkod (grön)
                till spelare. De registrerar sig via{" "}
                <Link href="/anslut" className="underline font-medium">Gå med i ett lag</Link>.
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h2 className="font-bold text-slate-900 mb-4">
              Lagmedlemmar ({members.length})
            </h2>
            {members.length === 0 ? (
              <p className="text-slate-400 text-sm">Inga medlemmar i laget ännu.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800">{m.name}</p>
                      {m.role === "parent" && m.child_name && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Förälder till {m.child_name}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500 shrink-0">
                      {roleLabel[m.role as keyof typeof roleLabel] ?? m.role}
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
