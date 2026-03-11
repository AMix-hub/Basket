"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../../lib/roleLabels";
import { supabase } from "../../lib/supabaseClient";

interface TeamRow {
  id: string;
  name: string;
  age_group: string;
  coach_id: string | null;
}

interface ProfileRow {
  id: string;
  name: string;
  role: string;
  child_name: string | null;
}

interface TeamWithMembers extends TeamRow {
  members: ProfileRow[];
}

export default function AdminPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  // null = not yet loaded (loading state derived from value)
  const [teams, setTeams] = useState<TeamWithMembers[] | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;

    (async () => {
      /* Fetch all teams belonging to this admin */
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, name, age_group, coach_id")
        .eq("admin_id", user.id);

      if (!teamRows || teamRows.length === 0) {
        setTeams([]);
        return;
      }

      /* Fetch members for each team via team_members junction */
      const teamIds = teamRows.map((t) => t.id);

      const { data: memberRows } = await supabase
        .from("team_members")
        .select("team_id, user_id")
        .in("team_id", teamIds);

      const userIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];

      const profileMap: Record<string, ProfileRow> = {};
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, name, role, child_name")
          .in("id", userIds);
        (profileRows ?? []).forEach((p) => {
          profileMap[p.id] = p as ProfileRow;
        });
      }

      const enriched: TeamWithMembers[] = teamRows.map((t) => ({
        ...t,
        members: (memberRows ?? [])
          .filter((m) => m.team_id === t.id)
          .map((m) => profileMap[m.user_id])
          .filter(Boolean),
      }));

      setTeams(enriched);
    })();
  }, [user]);

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
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🏛</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {user.clubName ?? "Föreningsadmin"}
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          Bjud in coacher och följ alla lag i din förening.
        </p>
      </div>

      {/* Coach invite code */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="font-bold text-slate-900 mb-1">
          Inbjudningskod för coacher
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          Dela denna kod med coacher så de kan registrera sig och skapa sitt lag
          i <strong>{user.clubName ?? "din förening"}</strong>. Coacher
          registrerar sig via{" "}
          <Link href="/anslut" className="text-orange-600 hover:underline font-medium">
            Gå med i ett lag
          </Link>
          .
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

      {/* All teams in this club */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h2 className="font-bold text-slate-900 mb-4">
          Lag i {user.clubName ?? "föreningen"} ({teams?.length ?? 0})
        </h2>

        {teams === null ? (
          <p className="text-slate-400 text-sm">Laddar lag…</p>
        ) : (teams ?? []).length === 0 ? (
          <p className="text-slate-400 text-sm">
            Inga lag registrerade ännu. Bjud in en coach med koden ovan för att
            komma igång.
          </p>
        ) : (
          <ul className="space-y-4">
            {(teams ?? []).map((team) => {
              const coach   = team.members.find((m) => m.id === team.coach_id);
              const nonCoach = team.members.filter((m) => m.id !== team.coach_id);

              return (
                <li
                  key={team.id}
                  className="border border-slate-100 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-bold text-slate-900">{team.name}</p>
                      {team.age_group && (
                        <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                          {team.age_group}
                        </span>
                      )}
                    </div>
                    <span className="text-2xl shrink-0">🏀</span>
                  </div>

                  {team.members.length === 0 ? (
                    <p className="text-xs text-slate-400">Inga medlemmar ännu.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {coach && (
                        <li className="flex items-center gap-2 text-sm">
                          <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">
                            🎽 Coach
                          </span>
                          <span className="text-slate-800">{coach.name}</span>
                        </li>
                      )}
                      {nonCoach.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 text-sm">
                          <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">
                            {roleLabel[m.role as keyof typeof roleLabel] ?? m.role}
                          </span>
                          <span className="text-slate-700">{m.name}</span>
                          {m.role === "parent" && m.child_name && (
                            <span className="text-xs text-slate-400 ml-1">
                              (förälder till {m.child_name})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
                    {team.members.length}{" "}
                    {team.members.length === 1 ? "medlem" : "medlemmar"} totalt
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
