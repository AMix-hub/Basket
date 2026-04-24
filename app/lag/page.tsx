"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import type { Team } from "../context/AuthContext";
import { roleLabel } from "../../lib/roleLabels";
import { supabase } from "../../lib/supabase";

interface ProfileRow {
  id: string;
  name: string;
  roles: string[];
  child_name: string | null;
}

interface PlayerGroup {
  id: string;
  teamId: string;
  name: string;
  memberIds: string[];
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

  // Player groups
  const [groupsByTeam, setGroupsByTeam] = useState<Record<string, PlayerGroup[]>>({});
  const [newGroupName, setNewGroupName] = useState<Record<string, string>>({});
  const [addingGroup, setAddingGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  /* Load team members for each team */
  useEffect(() => {
    if (teams.length === 0) return;
    (async () => {
      const results: Record<string, ProfileRow[]> = {};
      await Promise.all(
        teams.map(async (team: Team) => {
          const { data: memberships } = await supabase
            .from("team_members").select("user_id").eq("team_id", team.id);
          const ids = (memberships ?? []).map((m: { user_id: string }) => m.user_id);
          if (ids.length === 0) { results[team.id] = []; return; }
          const { data: profiles } = await supabase.from("profiles").select("id, name, roles, role, child_name").in("id", ids);
          results[team.id] = (profiles ?? []).map((p) => ({
            id: p.id, name: p.name,
            roles: p.roles?.length > 0 ? p.roles : [p.role],
            child_name: p.child_name ?? null,
          }));
        })
      );
      setMembersByTeam(results);
      setExpandedTeams(new Set(teams.map((t: Team) => t.id)));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.map((t) => t.id).join(",")]);

  /* Subscribe to player groups for all teams */
  useEffect(() => {
    if (teams.length === 0) return;
    let mounted = true;
    const teamIds = teams.map((t: Team) => t.id);

    const loadGroups = () =>
      supabase.from("player_groups").select("*").in("team_id", teamIds)
        .then(({ data }) => {
          if (!mounted) return;
          const byTeam: Record<string, PlayerGroup[]> = {};
          (data ?? []).forEach((g) => {
            if (!byTeam[g.team_id]) byTeam[g.team_id] = [];
            byTeam[g.team_id].push({ id: g.id, teamId: g.team_id, name: g.name, memberIds: g.player_ids ?? [] });
          });
          setGroupsByTeam(byTeam);
        });

    loadGroups();
    const channels = teamIds.map((tid) =>
      supabase.channel(`groups:${tid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "player_groups", filter: `team_id=eq.${tid}` }, loadGroups)
        .subscribe()
    );
    return () => { mounted = false; channels.forEach((c) => supabase.removeChannel(c)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.map((t: Team) => t.id).join(",")]);

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

  const createGroup = async (teamId: string) => {
    const name = (newGroupName[teamId] ?? "").trim();
    if (!name) return;
    setAddingGroup(teamId);
    try {
      await supabase.from("player_groups").insert({ team_id: teamId, name, player_ids: [] });
      setNewGroupName((prev) => ({ ...prev, [teamId]: "" }));
    } catch {
      alert("Det gick inte att skapa gruppen. Försök igen.");
    } finally {
      setAddingGroup(null);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm("Ta bort gruppen?")) return;
    try {
      await supabase.from("player_groups").delete().eq("id", groupId);
    } catch {
      alert("Det gick inte att ta bort gruppen. Försök igen.");
    }
  };

  const toggleGroupMember = async (group: PlayerGroup, memberId: string) => {
    const isMember = group.memberIds.includes(memberId);
    try {
      const newIds = isMember
        ? group.memberIds.filter((id) => id !== memberId)
        : [...group.memberIds, memberId];
      await supabase.from("player_groups").update({ player_ids: newIds }).eq("id", group.id);
    } catch {
      alert("Det gick inte att uppdatera gruppmedlemmar. Försök igen.");
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
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
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
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
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-2xl p-4 mb-6 text-sm text-amber-300">
          Du är inte med i något lag ännu. Ange en inbjudningskod nedan för att
          gå med.
        </div>
      )}

      {joinSuccess && (
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-2xl p-4 mb-6 text-emerald-400 text-sm font-medium">
          ✓ Du har gått med i laget! Laginformationen visas nedan.
        </div>
      )}

      {/* Team cards */}
      {teams.map((team: Team) => {
        const members = membersByTeam[team.id] ?? [];
        const groups = groupsByTeam[team.id] ?? [];
        const isExpanded = expandedTeams.has(team.id);
        const isCoach = user.roles.includes("coach") && team.coachId === user.id;
        // Co-admins have adminId pointing to the original club admin; treat them
        // as admin for any team that belongs to the same club.
        const effectiveAdminId = (user.roles.includes("admin") && user.adminId) ? user.adminId : user.id;
        const isAdmin = user.roles.includes("admin") && team.adminId === effectiveAdminId;
        const canSeeInvites = isCoach || isAdmin;
        const canManageGroups = isCoach || isAdmin;

        return (
          <div key={team.id} className="mb-4">
            {/* Team header card */}
            <button
              onClick={() => toggleTeam(team.id)}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-orange-300 transition-colors"
            >
              <div className="text-left">
                <h2 className="text-lg font-extrabold text-slate-100">
                  {team.name}
                </h2>
                {team.ageGroup && (
                  <span className="inline-block mt-0.5 text-xs font-semibold px-2.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
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
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                    <h3 className="font-bold text-slate-100 mb-3">
                      Inbjudningskoder
                    </h3>
                    <p className="text-slate-500 text-sm mb-4">
                      Dela dessa koder med rätt person.
                    </p>
                    <div className="space-y-3">
                      {[
                        { key: `${team.id}-staff`,  label: "👋 Assistenter / personal", code: team.inviteCode,        bg: "bg-slate-900/30",    text: "text-slate-400",   mono: "text-slate-200",   btn: "bg-slate-700 text-slate-300 hover:bg-slate-600" },
                        { key: `${team.id}-parent`, label: "👪 Föräldrar",               code: team.parentInviteCode,  bg: "bg-orange-500/10",   text: "text-orange-400",  mono: "text-orange-300",  btn: "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30" },
                        { key: `${team.id}-player`, label: "🏃 Spelare",                 code: team.playerInviteCode,  bg: "bg-emerald-900/30",  text: "text-emerald-400", mono: "text-emerald-300", btn: "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" },
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
                    <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-xl text-xs text-blue-300">
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
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                  <h3 className="font-bold text-slate-100 mb-3">
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
                          className="flex items-center gap-3 bg-slate-900/30 rounded-xl px-4 py-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-200">
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

                {/* Player groups */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                  <h3 className="font-bold text-slate-100 mb-3">
                    Träningsgrupper ({groups.length})
                  </h3>
                  <p className="text-slate-500 text-sm mb-4">
                    Spelare kan vara med i flera grupper samtidigt.
                  </p>

                  {groups.length === 0 && !canManageGroups && (
                    <p className="text-slate-400 text-sm">Inga grupper skapade ännu.</p>
                  )}

                  {groups.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {groups.map((group) => {
                        const isGroupExpanded = expandedGroups.has(group.id);
                        const groupMembers = members.filter((m) =>
                          group.memberIds.includes(m.id)
                        );
                        return (
                          <div key={group.id} className="border border-slate-200 rounded-xl overflow-hidden">
                            <button
                              onClick={() => toggleGroup(group.id)}
                              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base">👥</span>
                                <span className="font-semibold text-sm text-slate-200">
                                  {group.name}
                                </span>
                                <span className="text-xs text-slate-500">
                                  ({groupMembers.length} spelare)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {canManageGroups && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteGroup(group.id);
                                    }}
                                    className="text-slate-300 hover:text-red-500 transition-colors text-xs px-1"
                                    aria-label="Ta bort grupp"
                                  >
                                    ✕
                                  </button>
                                )}
                                <span className="text-slate-400 text-xs">
                                  {isGroupExpanded ? "▲" : "▼"}
                                </span>
                              </div>
                            </button>
                            {isGroupExpanded && (
                              <div className="px-4 py-3 space-y-2">
                                {members.length === 0 ? (
                                  <p className="text-slate-400 text-xs">Inga lagmedlemmar att lägga till.</p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {members.map((m) => {
                                      const inGroup = group.memberIds.includes(m.id);
                                      return (
                                        <li key={m.id} className="flex items-center gap-3">
                                          {canManageGroups ? (
                                            <label className="flex items-center gap-3 cursor-pointer flex-1">
                                              <input
                                                type="checkbox"
                                                checked={inGroup}
                                                onChange={() => toggleGroupMember(group, m.id)}
                                                className="accent-orange-500 w-4 h-4 shrink-0"
                                              />
                                              <span className="text-sm text-slate-200">{m.name}</span>
                                              <span className="text-xs text-slate-400">
                                                {m.roles
                                                  .map((r) => roleLabel[r as keyof typeof roleLabel] ?? r)
                                                  .join(", ")}
                                              </span>
                                            </label>
                                          ) : (
                                            inGroup && (
                                              <span className="text-sm text-slate-200">{m.name}</span>
                                            )
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Create new group (coach/admin only) */}
                  {canManageGroups && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newGroupName[team.id] ?? ""}
                        onChange={(e) =>
                          setNewGroupName((prev) => ({ ...prev, [team.id]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && createGroup(team.id)}
                        placeholder="Namn på ny grupp…"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                      />
                      <button
                        onClick={() => createGroup(team.id)}
                        disabled={addingGroup === team.id || !(newGroupName[team.id] ?? "").trim()}
                        className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 shrink-0"
                      >
                        {addingGroup === team.id ? "…" : "+ Skapa"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Join an additional team */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mt-2">
        <h2 className="font-bold text-slate-100 mb-1">
          {teams.length === 0 ? "Gå med i ett lag" : "Gå med i ytterligare ett lag"}
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          {teams.length === 0
            ? "Ange en inbjudningskod från din coach för att gå med."
            : "Har du en kod till ett annat lag? Du kan vara med i flera lag samtidigt."}
        </p>
        <form onSubmit={handleJoin} className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">
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
              <label className="block text-sm font-semibold text-slate-300 mb-1">
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
