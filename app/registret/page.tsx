"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import type { Team } from "../context/AuthContext";
import { roleLabel } from "../../lib/roleLabels";
import { supabase } from "../../lib/supabase";

interface PlayerNote {
  id: string;
  teamId: string;
  playerId: string;
  playerName: string;
  coachId: string;
  coachName: string;
  note: string;
  date: string;
  createdAt: string;
}

interface PlayerNotesModalProps {
  member: ProfileRow;
  teamId: string;
  coachId: string;
  coachName: string;
  onClose: () => void;
}

function PlayerNotesModal({ member, teamId, coachId, coachName, onClose }: PlayerNotesModalProps) {
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let mounted = true;
    const load = () =>
      supabase.from("player_notes").select("*")
        .eq("team_id", teamId).eq("player_id", member.id).order("created_at", { ascending: false })
        .then(({ data }) => {
          if (!mounted) return;
          setNotes((data ?? []).map((d) => ({
            id: d.id, teamId: d.team_id, playerId: d.player_id, playerName: d.player_name ?? "",
            coachId: d.coach_id ?? "", coachName: d.coach_name ?? "", note: d.note, date: d.date ?? "", createdAt: d.created_at,
          })));
        });
    load();
    const ch = supabase.channel(`player-notes:${teamId}:${member.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_notes", filter: `team_id=eq.${teamId}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [teamId, member.id]);

  const saveNote = async () => {
    if (!newNote.trim() || saving) return;
    setSaving(true);
    try {
      await supabase.from("player_notes").insert({
        team_id: teamId,
        player_id: member.id,
        player_name: member.name,
        coach_id: coachId,
        coach_name: coachName,
        note: newNote.trim(),
        date: today,
      });
      setNewNote("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-100">Anteckningar</h3>
            <p className="text-sm text-slate-400 mt-0.5">{member.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        {/* Add note */}
        <div className="mb-4">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Skriv en anteckning om spelaren..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
          <button
            disabled={saving || !newNote.trim()}
            onClick={saveNote}
            className="mt-2 w-full py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            {saving ? "Sparar…" : "+ Lägg till anteckning"}
          </button>
        </div>

        {/* Notes list */}
        <div className="overflow-y-auto space-y-3 flex-1">
          {notes.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">Inga anteckningar ännu.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                <p className="text-sm text-slate-200 leading-relaxed">{n.note}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500">{n.coachName}</span>
                  <span className="text-xs text-slate-600">{n.date}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ProfileRow {
  id: string;
  name: string;
  roles: string[];
  child_name: string | null;
}

interface TeamWithMembers {
  id: string;
  name: string;
  ageGroup?: string;
  members: ProfileRow[];
}

interface AddToTeamModalProps {
  member: ProfileRow;
  currentTeamIds: string[];
  allTeams: { id: string; name: string; ageGroup?: string }[];
  onAdd: (memberId: string, teamId: string) => Promise<void>;
  onClose: () => void;
}

function AddToTeamModal({ member, currentTeamIds, allTeams, onAdd, onClose }: AddToTeamModalProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);

  const alreadyInIds = new Set([...currentTeamIds, ...addedIds]);
  const available = allTeams.filter((t) => !alreadyInIds.has(t.id));

  const handleAdd = async (teamId: string) => {
    setAdding(teamId);
    await onAdd(member.id, teamId);
    setAddedIds((prev) => [...prev, teamId]);
    setAdding(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-100">Lägg till i lag</h3>
            <p className="text-sm text-slate-400 mt-0.5">{member.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {available.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">
            {member.name} är redan med i alla lag.
          </p>
        ) : (
          <div className="space-y-2">
            {available.map((team) => (
              <div key={team.id} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">{team.name}</p>
                  {team.ageGroup && (
                    <p className="text-xs text-slate-500">{team.ageGroup}</p>
                  )}
                </div>
                <button
                  onClick={() => handleAdd(team.id)}
                  disabled={adding === team.id}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {adding === team.id ? "…" : "+ Lägg till"}
                </button>
              </div>
            ))}
          </div>
        )}

        {addedIds.length > 0 && (
          <p className="text-xs text-emerald-400 text-center mt-3">✓ Ändringar sparade</p>
        )}

        {allTeams.filter((t) => alreadyInIds.has(t.id)).length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-2">Redan med i:</p>
            <div className="flex flex-wrap gap-1">
              {allTeams
                .filter((t) => alreadyInIds.has(t.id))
                .map((t) => (
                  <span
                    key={t.id}
                    className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full"
                  >
                    {t.name}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegistretPage() {
  const { user, getMyTeams } = useAuth();
  const teams = getMyTeams();

  const [teamData, setTeamData] = useState<TeamWithMembers[] | null>(null);
  const [adminTeams, setAdminTeams] = useState<{ id: string; name: string; ageGroup?: string }[]>([]);
  const [assigningMember, setAssigningMember] = useState<{ member: ProfileRow; teamIds: string[] } | null>(null);
  const [notesTarget, setNotesTarget] = useState<{ member: ProfileRow; teamId: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleTarget, setRoleTarget] = useState<ProfileRow | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  const isAdmin = user?.roles.includes("admin") ?? false;
  const isCoach = user?.roles.includes("coach") ?? false;
  // Co-admins (promoted from coach/other role) have their own adminId pointing
  // to the original club admin. Use that as the effective admin ID so all
  // club-scoped queries resolve correctly for both root admins and co-admins.
  const effectiveAdminId = user?.adminId ?? user?.id;

  useEffect(() => {
    if (!user || (!isAdmin && !isCoach)) return;

    (async () => {
      const results: TeamWithMembers[] = [];
      let teamsToLoad: { id: string; name: string; ageGroup?: string }[];

      if (isAdmin) {
        const adminIds = [...new Set([effectiveAdminId, user.id].filter(Boolean))] as string[];
        const { data: adminTeamsData } = await supabase.from("teams").select("id, name, age_group").in("admin_id", adminIds);
        teamsToLoad = (adminTeamsData ?? []).map((d) => ({ id: d.id, name: d.name, ageGroup: d.age_group ?? undefined }));
        setAdminTeams(teamsToLoad);
      } else {
        teamsToLoad = teams.map((t: Team) => ({ id: t.id, name: t.name, ageGroup: t.ageGroup }));
      }

      const teamIds = teamsToLoad.map((t) => t.id);
      const { data: memberRows } = await supabase.from("team_members").select("team_id, user_id").in("team_id", teamIds);
      const userIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];

      const profileMap: Record<string, ProfileRow> = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase.from("profiles").select("id, name, roles, child_name").in("id", userIds);
        (profileData ?? []).forEach((p) => {
          profileMap[p.id] = { id: p.id, name: p.name, roles: p.roles ?? [], child_name: p.child_name ?? null };
        });
      }

      teamsToLoad.forEach((team) => {
        const members = (memberRows ?? [])
          .filter((m) => m.team_id === team.id)
          .map((m) => profileMap[m.user_id])
          .filter(Boolean);
        results.push({ ...team, members });
      });

      if (isAdmin) {
        const adminIds = [...new Set([effectiveAdminId, user.id].filter(Boolean))] as string[];
        const { data: directProfiles } = await supabase.from("profiles").select("id, name, roles, child_name").in("admin_id", adminIds);
        const existingMemberIds = new Set(results.flatMap((t) => t.members.map((m) => m.id)));
        const unassigned: ProfileRow[] = (directProfiles ?? [])
          .filter((p) => !existingMemberIds.has(p.id))
          .map((p) => ({ id: p.id, name: p.name, roles: p.roles ?? [], child_name: p.child_name ?? null }));
        if (unassigned.length > 0) {
          results.push({ id: "__unassigned__", name: "", members: unassigned });
        }
      }

      results.sort((a, b) => a.name.localeCompare(b.name, "sv"));
      setTeamData(results);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, effectiveAdminId, teams.map((t: Team) => t.id).join(",")]);

  const changeRole = async (memberId: string, newRole: string) => {
    setSavingRole(true);
    await supabase.from("profiles").update({ roles: [newRole], role: newRole }).eq("id", memberId);
    setSavingRole(false);
    setRoleTarget(null);
    // Refresh data
    setTeamData((prev) => prev ? prev.map((t) => ({
      ...t,
      members: t.members.map((m) => m.id === memberId ? { ...m, roles: [newRole] } : m),
    })) : prev);
  };

  const removeMemberFromTeam = async (memberId: string, teamId: string) => {
    if (!confirm("Ta bort personen från laget?")) return;
    await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", memberId);
    setTeamData((prev) => prev ? prev.map((t) =>
      t.id === teamId ? { ...t, members: t.members.filter((m) => m.id !== memberId) } : t
    ) : prev);
  };

  const addMemberToTeam = async (memberId: string, teamId: string) => {
    await supabase.from("team_members").upsert(
      { team_id: teamId, user_id: memberId },
      { onConflict: "team_id,user_id" }
    );
    setTeamData((prev) => {
      if (!prev) return prev;
      const allMembers = prev.flatMap((t) => t.members);
      const memberInfo = allMembers.find((m) => m.id === memberId);
      return prev.map((t) => {
        if (t.id !== teamId) return t;
        if (!memberInfo || t.members.some((m) => m.id === memberId)) return t;
        return { ...t, members: [...t.members, memberInfo] };
      });
    });
  };

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-slate-400 mb-4">
            Du behöver logga in för att se registret.
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

  if (!isAdmin && !isCoach) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-slate-400">
            Den här sidan är bara tillgänglig för admins och coacher.
          </p>
        </div>
      </div>
    );
  }

  // For admins: collect all unique members across all teams
  const allMembersForAdmin = (() => {
    if (!isAdmin || !teamData) return null;
    const map = new Map<string, { member: ProfileRow; teamIds: string[]; teamNames: string[] }>();
    teamData.forEach((t) => {
      t.members.forEach((m) => {
        const existing = map.get(m.id);
        const teamName = t.id === "__unassigned__" ? null : t.name;
        const teamId = t.id === "__unassigned__" ? null : t.id;
        if (existing) {
          if (teamName) existing.teamNames.push(teamName);
          if (teamId) existing.teamIds.push(teamId);
        } else {
          map.set(m.id, {
            member: m,
            teamNames: teamName ? [teamName] : [],
            teamIds: teamId ? [teamId] : [],
          });
        }
      });
    });
    return [...map.values()].sort((a, b) =>
      a.member.name.localeCompare(b.member.name, "sv")
    );
  })();

  return (
    <div>
      {/* Add-to-team modal */}
      {assigningMember && (
        <AddToTeamModal
          member={assigningMember.member}
          currentTeamIds={assigningMember.teamIds}
          allTeams={adminTeams}
          onAdd={addMemberToTeam}
          onClose={() => setAssigningMember(null)}
        />
      )}
      {/* Role change modal */}
      {roleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#1e293b] border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-100">Ändra roll</h3>
                <p className="text-sm text-slate-400 mt-0.5">{roleTarget.name}</p>
              </div>
              <button onClick={() => setRoleTarget(null)} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
            </div>
            <div className="space-y-2">
              {(["player", "parent", "assistant", "coach", "co_admin", "admin"] as const).map((r) => (
                <button
                  key={r}
                  disabled={savingRole || roleTarget.roles[0] === r}
                  onClick={() => changeRole(roleTarget.id, r)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    roleTarget.roles[0] === r
                      ? "bg-orange-500/20 text-orange-400 cursor-default"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                >
                  {savingRole ? "Sparar…" : roleLabel[r]}
                  {roleTarget.roles[0] === r && " ✓"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Player notes modal */}
      {notesTarget && user && (
        <PlayerNotesModal
          member={notesTarget.member}
          teamId={notesTarget.teamId}
          coachId={user.id}
          coachName={user.name}
          onClose={() => setNotesTarget(null)}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">👥</span>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Registret
          </h1>
        </div>
        <p className="text-slate-400 text-sm">
          {isAdmin
            ? `Alla medlemmar i ${user.clubName ?? "föreningen"}.`
            : "Alla medlemmar i ditt lag."}
        </p>
      </div>

      {teamData === null ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <p className="text-slate-400 text-sm">Laddar…</p>
        </div>
      ) : isAdmin ? (
        /* Admin view: flat list of all unique members with team info */
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-slate-100 mb-1">👥 Användarregister</h2>
          <p className="text-slate-400 text-sm mb-3">
            {(allMembersForAdmin ?? []).length} unika medlemmar i {teamData.filter((t) => t.id !== "__unassigned__").length} lag.
          </p>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök namn…"
            className="w-full mb-4 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          {(allMembersForAdmin ?? []).length === 0 ? (
            <p className="text-slate-400 text-sm">Inga medlemmar registrerade ännu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-700">
                    <th className="pb-2 pr-4">Namn</th>
                    <th className="pb-2 pr-4">Roller</th>
                    <th className="pb-2">Lag</th>
                    <th className="pb-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {(allMembersForAdmin ?? []).filter(({ member }) =>
                    !searchQuery.trim() || member.name.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(({ member, teamNames, teamIds }) => (
                    <tr key={member.id} className="hover:bg-slate-700/30">
                      <td className="py-2 pr-4">
                        <span className="font-medium text-slate-200">
                          {member.name}
                        </span>
                        {member.child_name && (
                          <span className="text-xs text-slate-500 block">
                            Förälder till {member.child_name}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {member.roles.map((r) => (
                            <span
                              key={r}
                              className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full font-medium"
                            >
                              {roleLabel[r as keyof typeof roleLabel] ?? r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {teamNames.length === 0 ? (
                            <span className="text-xs text-slate-500 italic">Inget lag</span>
                          ) : (
                            teamNames.map((name) => (
                              <span
                                key={name}
                                className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full font-medium"
                              >
                                {name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-2 pl-2">
                        <div className="flex gap-1 flex-wrap">
                          <button
                            onClick={() => setAssigningMember({ member, teamIds })}
                            className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-orange-500/20 text-slate-400 hover:text-orange-400 rounded-lg transition-colors font-medium"
                            title="Lägg till i lag"
                          >
                            + Lag
                          </button>
                          <button
                            onClick={() => setRoleTarget(member)}
                            className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-lg transition-colors font-medium"
                            title="Ändra roll"
                          >
                            🔑
                          </button>
                          {teamIds.length > 0 && (
                            <>
                              <button
                                onClick={() => setNotesTarget({ member, teamId: teamIds[0] })}
                                className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors font-medium"
                                title="Anteckningar"
                              >
                                📝
                              </button>
                              <button
                                onClick={() => removeMemberFromTeam(member.id, teamIds[0])}
                                className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors font-medium"
                                title="Ta bort från lag"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Coach view: members grouped by team */
        <div className="space-y-4">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök namn…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          {teamData.map((team) => (
            <div
              key={team.id}
              className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
            >
              <h2 className="font-bold text-slate-100 mb-1">
                {team.name}
                {team.ageGroup && (
                  <span className="ml-2 text-xs font-semibold px-2.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full align-middle">
                    {team.ageGroup}
                  </span>
                )}
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                {team.members.length} {team.members.length !== 1 ? "medlemmar" : "medlem"}
              </p>
              {team.members.length === 0 ? (
                <p className="text-slate-500 text-sm">Inga medlemmar i laget ännu.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-700">
                        <th className="pb-2 pr-4">Namn</th>
                        <th className="pb-2 pr-4">Roller</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {team.members
                        .sort((a, b) => a.name.localeCompare(b.name, "sv"))
                        .filter((m) => !searchQuery.trim() || m.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((member) => (
                          <tr key={member.id} className="hover:bg-slate-700/30">
                            <td className="py-2 pr-4">
                              <span className="font-medium text-slate-200">
                                {member.name}
                              </span>
                              {member.child_name && (
                                <span className="text-xs text-slate-500 block">
                                  Förälder till {member.child_name}
                                </span>
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex flex-wrap gap-1">
                                {member.roles.map((r) => (
                                  <span
                                    key={r}
                                    className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full font-medium"
                                  >
                                    {roleLabel[r as keyof typeof roleLabel] ?? r}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2">
                              <button
                                onClick={() => setNotesTarget({ member, teamId: team.id })}
                                className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors font-medium"
                                title="Visa / lägg till anteckningar"
                              >
                                📝
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {teamData.length === 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <p className="text-slate-500 text-sm">Du har inga lag ännu.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
