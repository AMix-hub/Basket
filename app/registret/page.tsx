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
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

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

  const isAdmin = user?.roles.includes("admin") ?? false;
  const isCoach = user?.roles.includes("coach") ?? false;
  // Co-admins (promoted from coach/other role) have their own adminId pointing
  // to the original club admin. Use that as the effective admin ID so all
  // club-scoped queries resolve correctly for both root admins and co-admins.
  const effectiveAdminId = user?.adminId ?? user?.id;

  useEffect(() => {
    if (!user) return;
    if (!isAdmin && !isCoach) return;

    (async () => {
      const results: TeamWithMembers[] = [];

      // For admins: load ALL teams they administer (may include teams not in getMyTeams)
      // For coaches: use teams from getMyTeams()
      let teamsToLoad: { id: string; name: string; ageGroup?: string }[];

      if (isAdmin) {
        // Build the set of admin IDs to query by. For root admins (adminId ==
        // null) this is just their own UID. For co-admins it includes both
        // their own UID and the club's root admin UID so that teams are found
        // even when the profile's adminId was incorrectly set or not yet healed.
        const adminIds = [...new Set([effectiveAdminId, user.id].filter(Boolean))] as string[];

        const adminTeamsSnap = await getDocs(
          adminIds.length === 1
            ? query(collection(db, "teams"), where("adminId", "==", adminIds[0]))
            : query(collection(db, "teams"), where("adminId", "in", adminIds))
        );
        teamsToLoad = adminTeamsSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name as string,
          ageGroup: (d.data().ageGroup as string | undefined) ?? undefined,
        }));
        setAdminTeams(teamsToLoad);
      } else {
        // Coach: only their own teams
        teamsToLoad = teams.map((t: Team) => ({
          id: t.id,
          name: t.name,
          ageGroup: t.ageGroup,
        }));
      }

      await Promise.all(
        teamsToLoad.map(async (team) => {
          const memberSnap = await getDocs(
            query(collection(db, "team_members"), where("teamId", "==", team.id))
          );
          const ids = memberSnap.docs.map((d) => d.data().userId as string);
          if (ids.length === 0) {
            results.push({ ...team, members: [] });
            return;
          }
          const profileSnaps = await Promise.all(
            ids.map((id) => getDoc(doc(db, "profiles", id)))
          );
          const members: ProfileRow[] = profileSnaps
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
          results.push({ ...team, members });
        })
      );

      // For admins: also include users linked directly via adminId in their profile.
      // This covers users who were invited by the admin but not assigned to a team.
      if (isAdmin) {
        const adminIds = [...new Set([effectiveAdminId, user.id].filter(Boolean))] as string[];
        const directProfilesSnap = await getDocs(
          adminIds.length === 1
            ? query(collection(db, "profiles"), where("adminId", "==", adminIds[0]))
            : query(collection(db, "profiles"), where("adminId", "in", adminIds))
        );
        const existingMemberIds = new Set(
          results.flatMap((t) => t.members.map((m) => m.id))
        );
        const unassigned: ProfileRow[] = [];
        directProfilesSnap.docs.forEach((s) => {
          if (!existingMemberIds.has(s.id)) {
            const d = s.data();
            unassigned.push({
              id: s.id,
              name: d.name as string,
              roles:
                d.roles && (d.roles as string[]).length > 0
                  ? (d.roles as string[])
                  : [d.role as string],
              child_name: (d.childName as string | null) ?? null,
            });
          }
        });
        if (unassigned.length > 0) {
          // Add unassigned members as a virtual group so they appear in allMembersForAdmin
          results.push({ id: "__unassigned__", name: "", members: unassigned });
        }
      }

      // Sort teams by name
      results.sort((a, b) => a.name.localeCompare(b.name, "sv"));
      setTeamData(results);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, effectiveAdminId, teams.map((t: Team) => t.id).join(",")]);

  const addMemberToTeam = async (memberId: string, teamId: string) => {
    await setDoc(doc(db, "team_members", `${teamId}_${memberId}`), {
      teamId,
      userId: memberId,
      joinedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, "teams", teamId), {
      memberIds: arrayUnion(memberId),
    });
    // Update local teamData to reflect the new membership
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
          <p className="text-slate-400 text-sm mb-4">
            {(allMembersForAdmin ?? []).length} unika medlemmar i {teamData.filter((t) => t.id !== "__unassigned__").length} lag.
          </p>
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
                  {(allMembersForAdmin ?? []).map(({ member, teamNames, teamIds }) => (
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
                        <button
                          onClick={() =>
                            setAssigningMember({ member, teamIds })
                          }
                          className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-orange-500/20 text-slate-400 hover:text-orange-400 rounded-lg transition-colors font-medium"
                          title="Lägg till i lag"
                        >
                          + Lag
                        </button>
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
                        <th className="pb-2">Roller</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {team.members
                        .sort((a, b) => a.name.localeCompare(b.name, "sv"))
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
                            <td className="py-2">
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
