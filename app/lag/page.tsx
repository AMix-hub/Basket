"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import type { Team } from "../context/AuthContext";
import { roleLabel } from "../../lib/roleLabels";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

interface ProfileRow {
  id: string;
  name: string;
  roles: string[];
  child_name: string | null;
}

export default function LagPage() {
  const { user, getMyTeams, joinTeam } = useAuth();
  const teams = getMyTeams();

  // Members keyed by teamId
  const [membersByTeam, setMembersByTeam] = useState<Record<string, ProfileRow[]>>({});
  const [copied, setCopied]         = useState<string | null>(null);
  const [joinCode, setJoinCode]     = useState("");
  const [joinChildName, setJoinChildName] = useState("");
  const [joinError, setJoinError]   = useState("");
  const [joinSuccess, setJoinSuccess] = useState(false);
  // Which team panels are expanded
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  /* Load team members for each team */
  useEffect(() => {
    if (teams.length === 0) return;
    (async () => {
      const results: Record<string, ProfileRow[]> = {};
      await Promise.all(
        teams.map(async (team: Team) => {
          const memberSnap = await getDocs(
            query(collection(db, "team_members"), where("teamId", "==", team.id))
          );
          const ids = memberSnap.docs.map((d) => d.data().userId as string);
          if (ids.length === 0) { results[team.id] = []; return; }

          const profileSnaps = await Promise.all(
            ids.map((id) => getDoc(doc(db, "profiles", id)))
          );
          results[team.id] = profileSnaps
            .filter((s) => s.exists())
            .map((s) => {
              const d = s.data()!;
              return {
                id: s.id,
                name: d.name as string,
                roles:
                  d.roles && (d.roles as string[]).length > 0
                    ? (d.roles as string[])
                    : [d.role as string],
                child_name: (d.childName as string | null) ?? null,
              };
            });
        })
      );
      setMembersByTeam(results);
      // Auto-expand all teams on first load
      setExpandedTeams(new Set(teams.map((t: Team) => t.id)));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.map((t) => t.id).join(",")]); // re-run when team IDs change

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
      user?.roles.includes("parent") ? joinChildName.trim() : undefined
    );
    if (ok) {
      setJoinSuccess(true);
      setJoinCode("");
    } else {
      setJoinError("Ogiltig kod. Kontrollera att du skrivit rätt.");
    }
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
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
            Mina lag
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          Laginfo, inbjudningskoder och medlemmar. Du kan vara med i flera lag
          samtidigt.
        </p>
      </div>

      {/* No team notice */}
      {teams.length === 0 && !joinSuccess && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-800">
          Du är inte med i något lag ännu. Ange en inbjudningskod nedan för att
          gå med.
        </div>
      )}

      {joinSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-700 text-sm font-medium">
          ✓ Du har gått med i laget! Laginformationen visas nedan.
        </div>
      )}

      {/* Team cards */}
      {teams.map((team: Team) => {
        const members = membersByTeam[team.id] ?? [];
        const isExpanded = expandedTeams.has(team.id);
        const isCoach = user.roles.includes("coach") && team.coachId === user.id;
        const isAdmin = user.roles.includes("admin") && team.adminId === user.id;
        const canSeeInvites = isCoach || isAdmin;

        return (
          <div key={team.id} className="mb-4">
            {/* Team header card */}
            <button
              onClick={() => toggleTeam(team.id)}
              className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center justify-between gap-4 hover:border-orange-300 transition-colors"
            >
              <div className="text-left">
                <h2 className="text-lg font-extrabold text-slate-900">
                  {team.name}
                </h2>
                {team.ageGroup && (
                  <span className="inline-block mt-0.5 text-xs font-semibold px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                    {team.ageGroup}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-2xl">🏀</span>
                <span className="text-slate-400 text-sm">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="mt-1 space-y-3">
                {/* Invite codes (coach / admin only) */}
                {canSeeInvites && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                    <h3 className="font-bold text-slate-900 mb-3">
                      Inbjudningskoder
                    </h3>
                    <p className="text-slate-500 text-sm mb-4">
                      Dela dessa koder med rätt person.
                    </p>
                    <div className="space-y-3">
                      {[
                        { key: `${team.id}-staff`,  label: "👋 Assistenter / personal", code: team.inviteCode,        bg: "bg-slate-50",    text: "text-slate-500",   mono: "text-slate-900",   btn: "bg-slate-200 text-slate-700 hover:bg-slate-300" },
                        { key: `${team.id}-parent`, label: "👪 Föräldrar",               code: team.parentInviteCode,  bg: "bg-orange-50",   text: "text-orange-600",  mono: "text-orange-800",  btn: "bg-orange-200 text-orange-700 hover:bg-orange-300" },
                        { key: `${team.id}-player`, label: "🏃 Spelare",                 code: team.playerInviteCode,  bg: "bg-emerald-50",  text: "text-emerald-600", mono: "text-emerald-800", btn: "bg-emerald-200 text-emerald-700 hover:bg-emerald-300" },
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
                      💡 <strong>Tips:</strong> Dela rätt kod med rätt person. De
                      registrerar sig via{" "}
                      <Link href="/anslut" className="underline font-medium">
                        Gå med i ett lag
                      </Link>
                      .
                    </div>
                  </div>
                )}

                {/* Members list */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                  <h3 className="font-bold text-slate-900 mb-3">
                    Lagmedlemmar ({members.length})
                  </h3>
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
                            {m.roles.includes("parent") && m.child_name && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                Förälder till {m.child_name}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-slate-500 shrink-0">
                            {m.roles
                              .map((r) => roleLabel[r as keyof typeof roleLabel] ?? r)
                              .join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Join an additional team */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mt-2">
        <h2 className="font-bold text-slate-900 mb-1">
          {teams.length === 0 ? "Gå med i ett lag" : "Gå med i ytterligare ett lag"}
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          {teams.length === 0
            ? "Ange en inbjudningskod från din coach för att gå med."
            : "Har du en kod till ett annat lag? Du kan vara med i flera lag samtidigt."}
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
          {user.roles.includes("parent") && (
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
    </div>
  );
}
