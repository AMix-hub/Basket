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

interface TeamWithMembers {
  id: string;
  name: string;
  ageGroup?: string;
  members: ProfileRow[];
}

export default function RegistretPage() {
  const { user, getMyTeams } = useAuth();
  const teams = getMyTeams();

  const [teamData, setTeamData] = useState<TeamWithMembers[] | null>(null);

  const isAdmin = user?.roles.includes("admin") ?? false;
  const isCoach = user?.roles.includes("coach") ?? false;

  useEffect(() => {
    if (!user) return;
    if (!isAdmin && !isCoach) return;

    (async () => {
      const results: TeamWithMembers[] = [];

      // For admins: load ALL teams they administer (may include teams not in getMyTeams)
      // For coaches: use teams from getMyTeams()
      let teamsToLoad: { id: string; name: string; ageGroup?: string }[];

      if (isAdmin) {
        // Fetch all teams where adminId == user.id
        const adminTeamsSnap = await getDocs(
          query(collection(db, "teams"), where("adminId", "==", user.id))
        );
        teamsToLoad = adminTeamsSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name as string,
          ageGroup: (d.data().ageGroup as string | undefined) ?? undefined,
        }));
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
        const directProfilesSnap = await getDocs(
          query(collection(db, "profiles"), where("adminId", "==", user.id))
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
  }, [user, teams.map((t: Team) => t.id).join(",")]);

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-slate-600 mb-4">
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
          <p className="text-slate-600">
            Den här sidan är bara tillgänglig för admins och coacher.
          </p>
        </div>
      </div>
    );
  }

  // For admins: collect all unique members across all teams
  const allMembersForAdmin = (() => {
    if (!isAdmin || !teamData) return null;
    const map = new Map<string, { member: ProfileRow; teamNames: string[] }>();
    teamData.forEach((t) => {
      t.members.forEach((m) => {
        const existing = map.get(m.id);
        // Skip the virtual "__unassigned__" group's empty name
        const teamName = t.id === "__unassigned__" ? null : t.name;
        if (existing) {
          if (teamName) existing.teamNames.push(teamName);
        } else {
          map.set(m.id, { member: m, teamNames: teamName ? [teamName] : [] });
        }
      });
    });
    return [...map.values()].sort((a, b) =>
      a.member.name.localeCompare(b.member.name, "sv")
    );
  })();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">👥</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Registret
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          {isAdmin
            ? `Alla medlemmar i ${user.clubName ?? "föreningen"}.`
            : "Alla medlemmar i ditt lag."}
        </p>
      </div>

      {teamData === null ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <p className="text-slate-400 text-sm">Laddar…</p>
        </div>
      ) : isAdmin && allMembersForAdmin ? (
        /* Admin view: flat list of all unique members with team info */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-slate-900 mb-1">👥 Användarregister</h2>
          <p className="text-slate-500 text-sm mb-4">
            {allMembersForAdmin.length} unika medlemmar i {teamData.filter((t) => t.id !== "__unassigned__").length} lag.
          </p>
          {allMembersForAdmin.length === 0 ? (
            <p className="text-slate-400 text-sm">Inga medlemmar registrerade ännu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-100">
                    <th className="pb-2 pr-4">Namn</th>
                    <th className="pb-2 pr-4">Roller</th>
                    <th className="pb-2">Lag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allMembersForAdmin.map(({ member, teamNames }) => (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="py-2 pr-4">
                        <span className="font-medium text-slate-800">
                          {member.name}
                        </span>
                        {member.child_name && (
                          <span className="text-xs text-slate-400 block">
                            Förälder till {member.child_name}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {member.roles.map((r) => (
                            <span
                              key={r}
                              className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium"
                            >
                              {roleLabel[r as keyof typeof roleLabel] ?? r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {teamNames.map((name) => (
                            <span
                              key={name}
                              className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium"
                            >
                              {name}
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
      ) : (
        /* Coach view: members grouped by team */
        <div className="space-y-4">
          {teamData.map((team) => (
            <div
              key={team.id}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6"
            >
              <h2 className="font-bold text-slate-900 mb-1">
                {team.name}
                {team.ageGroup && (
                  <span className="ml-2 text-xs font-semibold px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full align-middle">
                    {team.ageGroup}
                  </span>
                )}
              </h2>
              <p className="text-slate-500 text-sm mb-4">
                {team.members.length} {team.members.length !== 1 ? "medlemmar" : "medlem"}
              </p>
              {team.members.length === 0 ? (
                <p className="text-slate-400 text-sm">Inga medlemmar i laget ännu.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-100">
                        <th className="pb-2 pr-4">Namn</th>
                        <th className="pb-2">Roller</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {team.members
                        .sort((a, b) => a.name.localeCompare(b.name, "sv"))
                        .map((member) => (
                          <tr key={member.id} className="hover:bg-slate-50">
                            <td className="py-2 pr-4">
                              <span className="font-medium text-slate-800">
                                {member.name}
                              </span>
                              {member.child_name && (
                                <span className="text-xs text-slate-400 block">
                                  Förälder till {member.child_name}
                                </span>
                              )}
                            </td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-1">
                                {member.roles.map((r) => (
                                  <span
                                    key={r}
                                    className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium"
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
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <p className="text-slate-400 text-sm">Du har inga lag ännu.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
