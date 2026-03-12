"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../../lib/roleLabels";
import type { UserRole } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

interface TeamRow {
  id: string;
  name: string;
  age_group: string;
  coach_id: string | null;
  invite_code: string;
  parent_invite_code: string;
  player_invite_code: string;
}

interface ProfileRow {
  id: string;
  name: string;
  roles: string[];
  child_name: string | null;
}

interface TeamWithMembers extends TeamRow {
  members: ProfileRow[];
}

const ALL_ROLES: UserRole[] = ["admin", "coach", "assistant", "parent", "player"];

export default function AdminPage() {
  const { user, createTeam } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  // null = not yet loaded (loading state derived from value)
  const [teams, setTeams] = useState<TeamWithMembers[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null); // userId being removed
  const [changingRole, setChangingRole] = useState<string | null>(null); // userId having role changed

  // Create team form state
  const [newTeamName, setNewTeamName] = useState("");
  const [newAgeGroup, setNewAgeGroup] = useState("≤7 år");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createTeamError, setCreateTeamError] = useState<string | null>(null);

  const loadTeams = useCallback(async (adminId: string) => {
    /* Fetch all teams belonging to this admin */
    const teamSnap = await getDocs(
      query(collection(db, "teams"), where("adminId", "==", adminId))
    );

    if (teamSnap.empty) {
      setTeams([]);
      return;
    }

    const teamRows = teamSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name as string,
      age_group: d.data().ageGroup as string,
      coach_id: (d.data().coachId as string | null) ?? null,
      invite_code: (d.data().inviteCode as string) ?? "",
      parent_invite_code: (d.data().parentInviteCode as string) ?? "",
      player_invite_code: (d.data().playerInviteCode as string) ?? "",
    }));

    /* Fetch members for each team via team_members collection
     * Firestore supports up to 10 items in an "in" query, so we batch. */
    const teamIds = teamRows.map((t) => t.id);

    const allMemberRows: { teamId: string; userId: string }[] = [];
    // Process teamIds in chunks of 10 (Firestore "in" query limit)
    for (let i = 0; i < teamIds.length; i += 10) {
      const chunk = teamIds.slice(i, i + 10);
      const memberSnap = await getDocs(
        query(collection(db, "team_members"), where("teamId", "in", chunk))
      );
      memberSnap.docs.forEach((d) => {
        allMemberRows.push({
          teamId: d.data().teamId as string,
          userId: d.data().userId as string,
        });
      });
    }

    const userIds = [...new Set(allMemberRows.map((m) => m.userId))];

    const profileMap: Record<string, ProfileRow> = {};
    if (userIds.length > 0) {
      const profilePromises = userIds.map((id) => getDoc(doc(db, "profiles", id)));
      const profileSnaps = await Promise.all(profilePromises);
      profileSnaps.forEach((s) => {
        if (s.exists()) {
          const d = s.data();
          profileMap[s.id] = {
            id: s.id,
            name: d.name as string,
            roles:
              d.roles && (d.roles as string[]).length > 0
                ? (d.roles as string[])
                : [d.role as string],
            child_name: (d.childName as string | null) ?? null,
          };
        }
      });
    }

    const enriched: TeamWithMembers[] = teamRows.map((t) => ({
      ...t,
      members: allMemberRows
        .filter((m) => m.teamId === t.id)
        .map((m) => profileMap[m.userId])
        .filter(Boolean),
    }));

    setTeams(enriched);
  }, []);

  useEffect(() => {
    if (!user?.roles.includes("admin")) return;
    loadTeams(user.id);
  }, [user, loadTeams]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const removeMember = async (team: TeamWithMembers, member: ProfileRow) => {
    if (!confirm(`Är du säker på att du vill ta bort ${member.name} från ${team.name}?`)) return;
    setRemoving(member.id);
    try {
      await deleteDoc(doc(db, "team_members", `${team.id}_${member.id}`)); // compound key: {teamId}_{userId}
      await updateDoc(doc(db, "teams", team.id), {
        memberIds: arrayRemove(member.id),
      });
      setTeams((prev) =>
        prev
          ? prev.map((t) =>
              t.id === team.id
                ? { ...t, members: t.members.filter((m) => m.id !== member.id) }
                : t
            )
          : prev
      );
    } catch {
      alert("Det gick inte att ta bort medlemmen. Försök igen.");
    } finally {
      setRemoving(null);
    }
  };

  const toggleRole = async (member: ProfileRow, role: UserRole, checked: boolean) => {
    const current = member.roles as UserRole[];
    let newRoles: UserRole[];
    if (checked) {
      newRoles = [...new Set([...current, role])];
    } else {
      newRoles = current.filter((r) => r !== role);
      if (newRoles.length === 0) return; // must keep at least one role
    }
    // Determine primary role for backward-compat `role` field
    const priority: UserRole[] = ["admin", "coach", "assistant", "parent", "player"];
    const primary = priority.find((r) => newRoles.includes(r)) ?? newRoles[0];

    setChangingRole(member.id);
    try {
      await updateDoc(doc(db, "profiles", member.id), {
        roles: newRoles,
        role: primary,
      });
      setTeams((prev) =>
        prev
          ? prev.map((t) => ({
              ...t,
              members: t.members.map((m) =>
                m.id === member.id ? { ...m, roles: newRoles } : m
              ),
            }))
          : prev
      );
    } catch {
      alert("Det gick inte att ändra rollen. Försök igen.");
    } finally {
      setChangingRole(null);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    setCreateTeamError(null);
    const err = await createTeam(newTeamName.trim(), newAgeGroup);
    if (err) {
      setCreateTeamError(err);
    } else {
      setNewTeamName("");
      setNewAgeGroup("≤7 år");
      // Reload teams list
      if (user) loadTeams(user.id);
    }
    setCreatingTeam(false);
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

  if (!user.roles.includes("admin")) {
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
          Hantera behöriga, bjud in coacher och följ alla lag i din förening.
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
              onClick={() => copyToClipboard(user.coachInviteCode!, "coach")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                copied === "coach"
                  ? "bg-emerald-500 text-white"
                  : "bg-blue-200 text-blue-700 hover:bg-blue-300"
              }`}
            >
              {copied === "coach" ? "✓ Kopierad!" : "📋 Kopiera"}
            </button>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">
            Ingen inbjudningskod hittades. Logga ut och in igen.
          </p>
        )}
      </div>

      {/* Create new team */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="font-bold text-slate-900 mb-1">Skapa nytt lag</h2>
        <p className="text-slate-500 text-sm mb-4">
          Som admin kan du skapa lag direkt. Bjud sedan in en coach med coach-inbjudningskoden ovan, eller dela lagkoderna nedan med spelare och föräldrar.
        </p>
        <form onSubmit={handleCreateTeam} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Lagets namn, t.ex. Röda Laget U9"
              required
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <select
              value={newAgeGroup}
              onChange={(e) => setNewAgeGroup(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            >
              <option value="≤7 år">≤7 år (År 1)</option>
              <option value="8 år">8 år (År 2)</option>
              <option value="9 år">9 år (År 3)</option>
            </select>
          </div>
          {createTeamError && (
            <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">
              {createTeamError}
            </p>
          )}
          <button
            type="submit"
            disabled={creatingTeam || !newTeamName.trim()}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            {creatingTeam ? "Skapar…" : "+ Skapa lag"}
          </button>
        </form>
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
            Inga lag registrerade ännu. Skapa ett lag ovan eller bjud in en coach med koden ovan för att komma igång.
          </p>
        ) : (
          <ul className="space-y-6">
            {(teams ?? []).map((team) => {
              return (
                <li
                  key={team.id}
                  className="border border-slate-100 rounded-xl p-4"
                >
                  {/* Team header */}
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

                  {/* Members list */}
                  {team.members.length === 0 ? (
                    <p className="text-xs text-slate-400">Inga medlemmar ännu.</p>
                  ) : (
                    <ul className="space-y-3 mb-4">
                      {team.members.map((m) => (
                        <li key={m.id} className="text-sm">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-medium text-slate-800 flex-1 min-w-0">
                              {m.name}
                              {m.roles.includes("parent") && m.child_name && (
                                <span className="text-xs text-slate-400 ml-1">
                                  (förälder till {m.child_name})
                                </span>
                              )}
                            </span>
                            <button
                              disabled={removing === m.id}
                              onClick={() => removeMember(team, m)}
                              className="px-2 py-0.5 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                            >
                              {removing === m.id ? "…" : "Ta bort"}
                            </button>
                          </div>
                          {/* Role checkboxes – multiple roles allowed */}
                          <div
                            className="flex flex-wrap gap-x-3 gap-y-1 pl-0.5"
                            aria-label={`Roller för ${m.name}`}
                          >
                            {ALL_ROLES.map((r) => {
                              const isChecked = m.roles.includes(r);
                              const isLast = isChecked && m.roles.length === 1;
                              return (
                                <label
                                  key={r}
                                  title={isLast ? "Minst en roll krävs" : undefined}
                                  className={`flex items-center gap-1 text-xs cursor-pointer select-none ${
                                    changingRole === m.id ? "opacity-50 pointer-events-none" : ""
                                  } ${isLast ? "opacity-60" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={changingRole === m.id || isLast}
                                    onChange={(e) =>
                                      toggleRole(m, r, e.target.checked)
                                    }
                                    className="accent-orange-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span className="text-slate-600">
                                    {roleLabel[r]}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Team invite codes */}
                  <details className="group mt-3 pt-3 border-t border-slate-100">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors list-none flex items-center gap-1">
                      <span className="chevron inline-block transition-transform group-open:rotate-90">▶</span>
                      Inbjudningskoder för laget
                    </summary>
                    <div className="mt-3 space-y-2">
                      {[
                        { label: "👋 Assistent", code: team.invite_code, key: `${team.id}-assistant` },
                        { label: "👪 Förälder", code: team.parent_invite_code, key: `${team.id}-parent` },
                        { label: "🏃 Spelare", code: team.player_invite_code, key: `${team.id}-player` },
                      ].map(({ label, code, key }) => (
                        <div key={key} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-500">{label}</p>
                            <p className="font-mono font-bold text-slate-800 tracking-widest text-sm">{code}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(code, key)}
                            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
                              copied === key
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                            }`}
                          >
                            {copied === key ? "✓" : "📋"}
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Dela dessa koder med nya medlemmar. De registrerar sig via{" "}
                      <Link href="/anslut" className="text-orange-600 hover:underline">
                        Gå med i ett lag
                      </Link>
                      .
                    </p>
                  </details>

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
