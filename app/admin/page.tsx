"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
  setDoc,
  deleteDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
  addDoc,
  onSnapshot,
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

interface Hall {
  id: string;
  name: string;
  address?: string;
}

interface TrainingFreePeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

const ALL_ROLES: UserRole[] = ["admin", "coach", "assistant", "parent", "player"];

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

export default function AdminPage() {
  const { user, createTeam, updateClubLogo, updateClubLogoUrl, updateClubWebsiteUrl } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  // null = not yet loaded (loading state derived from value)
  const [teams, setTeams] = useState<TeamWithMembers[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null); // userId being removed
  const [changingRole, setChangingRole] = useState<string | null>(null); // userId having role changed

  // Halls state
  const [halls, setHalls] = useState<Hall[]>([]);
  const [newHallName, setNewHallName] = useState("");
  const [newHallAddress, setNewHallAddress] = useState("");
  const [addingHall, setAddingHall] = useState(false);

  // Training-free periods state
  const [freePeriods, setFreePeriods] = useState<TrainingFreePeriod[]>([]);
  const [newPeriodName, setNewPeriodName] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");
  const [addingPeriod, setAddingPeriod] = useState(false);

  // Create team form state
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createTeamError, setCreateTeamError] = useState<string | null>(null);

  // Club logo state
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [logoUrlSaving, setLogoUrlSaving] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  // Club website URL state
  const [websiteUrlInput, setWebsiteUrlInput] = useState(user?.clubWebsiteUrl ?? "");
  const [websiteUrlSaving, setWebsiteUrlSaving] = useState(false);
  const [websiteUrlError, setWebsiteUrlError] = useState<string | null>(null);
  const [websiteUrlSuccess, setWebsiteUrlSuccess] = useState(false);

  // Invite user by email state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("player");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  /* Real-time listener: any change to the admin's teams (create / update / delete)
   * automatically refreshes the list, including the member + profile resolution. */
  useEffect(() => {
    if (!user?.roles.includes("admin")) return;

    // Co-admins have adminId pointing to the original club admin; use that so
    // they see all club teams rather than an empty list.
    const effectiveAdminId = user.adminId ?? user.id;

    const q = query(collection(db, "teams"), where("adminId", "==", effectiveAdminId));

    const unsub = onSnapshot(q, async (teamSnap) => {
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
    });

    return () => unsub();
  }, [user]);

  // Load halls for this admin
  useEffect(() => {
    if (!user?.roles.includes("admin")) return;
    const effectiveAdminId = user.adminId ?? user.id;
    const q = query(collection(db, "halls"), where("adminId", "==", effectiveAdminId));
    const unsub = onSnapshot(q, (snap) => {
      setHalls(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name as string,
          address: (d.data().address as string | undefined) ?? undefined,
        }))
      );
    });
    return () => unsub();
  }, [user]);

  // Load training-free periods for this admin
  useEffect(() => {
    if (!user?.roles.includes("admin")) return;
    const effectiveAdminId = user.adminId ?? user.id;
    const q = query(collection(db, "training_free_periods"), where("adminId", "==", effectiveAdminId));
    const unsub = onSnapshot(q, (snap) => {
      setFreePeriods(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name as string,
          startDate: d.data().startDate as string,
          endDate: d.data().endDate as string,
        }))
      );
    });
    return () => unsub();
  }, [user]);

  const handleAddHall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHallName.trim() || !user) return;
    setAddingHall(true);
    try {
      await addDoc(collection(db, "halls"), {
        name: newHallName.trim(),
        address: newHallAddress.trim() || null,
        adminId: user.id,
        createdAt: new Date().toISOString(),
      });
      setNewHallName("");
      setNewHallAddress("");
    } catch {
      alert("Kunde inte lägga till hall. Försök igen.");
    } finally {
      setAddingHall(false);
    }
  };

  const handleDeleteHall = async (hallId: string) => {
    if (!confirm("Är du säker på att du vill ta bort denna hall?")) return;
    try {
      await deleteDoc(doc(db, "halls", hallId));
    } catch {
      alert("Kunde inte ta bort hall. Försök igen.");
    }
  };

  const handleAddFreePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodName.trim() || !newPeriodStart || !newPeriodEnd || !user) return;
    if (newPeriodEnd < newPeriodStart) {
      alert("Slutdatum måste vara efter startdatum.");
      return;
    }
    setAddingPeriod(true);
    try {
      await addDoc(collection(db, "training_free_periods"), {
        name: newPeriodName.trim(),
        startDate: newPeriodStart,
        endDate: newPeriodEnd,
        adminId: user.id,
        createdAt: new Date().toISOString(),
      });
      setNewPeriodName("");
      setNewPeriodStart("");
      setNewPeriodEnd("");
    } catch {
      alert("Kunde inte lägga till träningsfri period. Försök igen.");
    } finally {
      setAddingPeriod(false);
    }
  };

  const handleDeleteFreePeriod = async (periodId: string) => {
    if (!confirm("Är du säker på att du vill ta bort denna period?")) return;
    try {
      await deleteDoc(doc(db, "training_free_periods", periodId));
    } catch {
      alert("Kunde inte ta bort period. Försök igen.");
    }
  };

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

      // Auto-enroll in all teams if the member is being given the "admin" role
      if (checked && role === "admin" && user && teams) {
        for (const t of teams) {
          const memberDocId = `${t.id}_${member.id}`;
          const memberDocRef = doc(db, "team_members", memberDocId);
          const existing = await getDoc(memberDocRef);
          if (!existing.exists()) {
            await setDoc(memberDocRef, {
              teamId: t.id,
              userId: member.id,
              role: "admin",
              joinedAt: new Date().toISOString(),
            });
            await updateDoc(doc(db, "teams", t.id), {
              memberIds: arrayUnion(member.id),
            });
          }
        }
      }

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

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim() || !user) return;
    setInviteBusy(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          name: inviteName.trim(),
          teamId: inviteTeamId || undefined,
          role: inviteRole,
          // Co-admins invite under the club's root admin so all invited users
          // appear in the correct club registry.
          adminId: user.adminId ?? user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "Något gick fel. Försök igen.");
      } else {
        setInviteSuccess(
          `✓ Inbjudan skickad till ${inviteEmail.trim()}. Användaren kan nu logga in via länken i mailet.`
        );
        setInviteEmail("");
        setInviteName("");
        setInviteTeamId("");
        setInviteRole("player");
      }
    } catch {
      setInviteError("Nätverksfel. Kontrollera anslutningen och försök igen.");
    } finally {
      setInviteBusy(false);
    }
  };

  const clearLogoPreview = () => {
    setSelectedLogoFile(null);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearLogoPreview();
    setSelectedLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setLogoError(null);
    setLogoSuccess(false);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleLogoUpload = async () => {
    if (!selectedLogoFile) return;
    setLogoUploading(true);
    setLogoError(null);
    setLogoSuccess(false);
    const err = await updateClubLogo(selectedLogoFile);
    if (err) {
      setLogoError(err);
    } else {
      setLogoSuccess(true);
      setTimeout(() => setLogoSuccess(false), 3000);
    }
    setLogoUploading(false);
    clearLogoPreview();
  };

  const handleLogoCancelSelect = () => {
    clearLogoPreview();
    setLogoError(null);
  };

  const handleLogoUrlSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoUrlInput.trim()) return;
    setLogoUrlSaving(true);
    setLogoError(null);
    setLogoSuccess(false);
    const err = await updateClubLogoUrl(logoUrlInput);
    if (err) {
      setLogoError(err);
    } else {
      setLogoSuccess(true);
      setLogoUrlInput("");
      setTimeout(() => setLogoSuccess(false), 3000);
    }
    setLogoUrlSaving(false);
  };

  const handleWebsiteUrlSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrlInput.trim()) return;
    setWebsiteUrlSaving(true);
    setWebsiteUrlError(null);
    setWebsiteUrlSuccess(false);
    const err = await updateClubWebsiteUrl(websiteUrlInput);
    if (err) {
      setWebsiteUrlError(err);
    } else {
      setWebsiteUrlSuccess(true);
      setTimeout(() => setWebsiteUrlSuccess(false), 3000);
    }
    setWebsiteUrlSaving(false);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    setCreateTeamError(null);
    const err = await createTeam(newTeamName.trim());
    if (err) {
      setCreateTeamError(err);
    } else {
      setNewTeamName("");
      // onSnapshot listener will automatically refresh the teams list
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
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            {user.clubName ?? "Föreningsadmin"}
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          Hantera behöriga, bjud in coacher och följ alla lag i din förening.
        </p>
      </div>

      {/* Club logo */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-slate-100 mb-1">Klubblogga</h2>
        <p className="text-slate-500 text-sm mb-4">
          Ladda upp din förenings logga. Den visas i navigeringsmenyn för alla
          coacher, spelare och föräldrar i {user.clubName ?? "din förening"}.
        </p>
        <div className="flex items-center gap-4 flex-wrap mb-4">
          {user.clubLogoUrl ? (
            <div className="flex items-center gap-3">
              <Image
                src={user.clubLogoUrl}
                alt="Klubblogga"
                width={64}
                height={64}
                unoptimized
                className="rounded-xl object-cover border border-slate-200"
              />
              <span className="text-xs text-slate-500">Nuvarande logga</span>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-2xl border border-dashed border-slate-300">
              🏛
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label
              className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                logoUploading
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
            >
              📷 Välj bild
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={logoUploading}
                onChange={handleLogoFileSelect}
              />
            </label>
            <p className="text-xs text-slate-400">
              JPG, PNG, GIF eller WebP · max 2 MB
            </p>
          </div>
        </div>

        {/* Selected file preview – shown after file is chosen, before upload */}
        {selectedLogoFile && (
          <div className="mb-4 flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex-wrap">
            {logoPreviewUrl && (
              <Image
                src={logoPreviewUrl}
                alt="Förhandsvisning"
                width={56}
                height={56}
                unoptimized
                className="rounded-lg object-cover border border-slate-200 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">
                {selectedLogoFile.name}
              </p>
              <p className="text-xs text-slate-500">
                {selectedLogoFile.size < BYTES_PER_MB
                  ? `${(selectedLogoFile.size / BYTES_PER_KB).toFixed(1)} KB`
                  : `${(selectedLogoFile.size / BYTES_PER_MB).toFixed(1)} MB`}
                {" · "}
                {selectedLogoFile.type}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLogoUpload}
                disabled={logoUploading}
                className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                  logoUploading
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-orange-500 hover:bg-orange-600 text-white"
                }`}
              >
                {logoUploading ? "Laddar upp…" : "⬆ Ladda upp"}
              </button>
              <button
                type="button"
                onClick={handleLogoCancelSelect}
                disabled={logoUploading}
                className="px-3 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}

        {/* Link logo via URL */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">
            Eller länka till en webbadress
          </p>
          <form onSubmit={handleLogoUrlSave} className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              inputMode="url"
              pattern="https://.*"
              placeholder="https://example.com/logo.png"
              value={logoUrlInput}
              onChange={(e) => setLogoUrlInput(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300"
              disabled={logoUrlSaving}
            />
            <button
              type="submit"
              disabled={logoUrlSaving || !logoUrlInput.trim()}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                logoUrlSaving || !logoUrlInput.trim()
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
            >
              {logoUrlSaving ? "Sparar…" : "Spara URL"}
            </button>
          </form>
        </div>

        {logoError && (
          <p className="mt-3 text-red-600 text-sm bg-red-900/30 px-3 py-2 rounded-xl">
            {logoError}
          </p>
        )}
        {logoSuccess && (
          <p className="mt-3 text-emerald-400 text-sm bg-emerald-900/30 px-3 py-2 rounded-xl">
            ✓ Loggan har uppdaterats!
          </p>
        )}
      </div>

      {/* Club website URL */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-slate-100 mb-1">Föreningens webbplats</h2>
        <p className="text-slate-500 text-sm mb-4">
          Ange din förenings webbplats så att alla i{" "}
          <strong className="text-slate-300">{user.clubName ?? "föreningen"}</strong> kan se
          nyheter direkt i appen via menyn <strong className="text-slate-300">Nyheter</strong>.
        </p>
        {user.clubWebsiteUrl && (
          <p className="text-sm text-slate-400 mb-3">
            Nuvarande:{" "}
            <a
              href={user.clubWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline break-all"
            >
              {user.clubWebsiteUrl}
            </a>
          </p>
        )}
        <form onSubmit={handleWebsiteUrlSave} className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            inputMode="url"
            placeholder="https://www.dinförening.se"
            value={websiteUrlInput}
            onChange={(e) => setWebsiteUrlInput(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-600 bg-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-slate-400"
            disabled={websiteUrlSaving}
          />
          <button
            type="submit"
            disabled={websiteUrlSaving || !websiteUrlInput.trim()}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              websiteUrlSaving || !websiteUrlInput.trim()
                ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                : "bg-orange-500 hover:bg-orange-600 text-white"
            }`}
          >
            {websiteUrlSaving ? "Sparar…" : "Spara"}
          </button>
        </form>
        {websiteUrlError && (
          <p className="mt-3 text-red-400 text-sm bg-red-900/30 px-3 py-2 rounded-xl">
            {websiteUrlError}
          </p>
        )}
        {websiteUrlSuccess && (
          <p className="mt-3 text-emerald-400 text-sm bg-emerald-900/30 px-3 py-2 rounded-xl">
            ✓ Webbplatsen har sparats!
          </p>
        )}
      </div>

      {/* Coach invite code */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-slate-100 mb-1">
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
          <div className="flex items-center gap-3 bg-blue-900/30 rounded-xl px-4 py-3">
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
                  : "bg-blue-900/30 text-blue-300 hover:bg-blue-800/30"
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
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-slate-100 mb-1">Skapa nytt lag</h2>
        <p className="text-slate-500 text-sm mb-4">
          Som admin kan du skapa lag direkt. Bjud sedan in en coach med coach-inbjudningskoden ovan, eller dela lagkoderna nedan med spelare och föräldrar.
        </p>
        <form onSubmit={handleCreateTeam} className="space-y-3">
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Lagets namn, t.ex. Röda Laget U9"
            required
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {createTeamError && (
            <p className="text-red-600 text-sm bg-red-900/30 px-3 py-2 rounded-xl">
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
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
        <h2 className="font-bold text-slate-100 mb-4">
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
                      <p className="font-bold text-slate-100">{team.name}</p>
                      {team.age_group && (
                        <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
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
                            <span className="font-medium text-slate-200 flex-1 min-w-0">
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
                              className="px-2 py-0.5 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 shrink-0"
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
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors list-none flex items-center gap-1">
                      <span className="chevron inline-block transition-transform group-open:rotate-90">▶</span>
                      Inbjudningskoder för laget
                    </summary>
                    <div className="mt-3 space-y-2">
                      {[
                        { label: "👋 Assistent", code: team.invite_code, key: `${team.id}-assistant` },
                        { label: "👪 Förälder", code: team.parent_invite_code, key: `${team.id}-parent` },
                        { label: "🏃 Spelare", code: team.player_invite_code, key: `${team.id}-player` },
                      ].map(({ label, code, key }) => (
                        <div key={key} className="flex items-center gap-3 bg-slate-900/30 rounded-lg px-3 py-2">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-500">{label}</p>
                            <p className="font-mono font-bold text-slate-200 tracking-widest text-sm">{code}</p>
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

      {/* Hall management */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mt-6">
        <h2 className="font-bold text-slate-100 mb-1">🏟 Hallar</h2>
        <p className="text-slate-500 text-sm mb-4">
          Lägg till träningshallar som coacher kan välja när de schemalägger träningar.
        </p>

        <form onSubmit={handleAddHall} className="space-y-2 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newHallName}
              onChange={(e) => setNewHallName(e.target.value)}
              placeholder="Hallens namn, t.ex. Kristineberg Arena"
              required
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newHallAddress}
              onChange={(e) => setNewHallAddress(e.target.value)}
              placeholder="Adress (valfritt)"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              type="submit"
              disabled={addingHall || !newHallName.trim()}
              className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors shrink-0"
            >
              {addingHall ? "…" : "+ Lägg till"}
            </button>
          </div>
        </form>

        {halls.length === 0 ? (
          <p className="text-slate-400 text-sm">Inga hallar tillagda ännu.</p>
        ) : (
          <ul className="space-y-2">
            {halls.map((hall) => (
              <li key={hall.id} className="flex items-center gap-3 bg-slate-900/30 rounded-xl px-3 py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">{hall.name}</p>
                  {hall.address && (
                    <p className="text-xs text-slate-400">{hall.address}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteHall(hall.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold shrink-0"
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Training-free periods */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mt-6">
        <h2 className="font-bold text-slate-100 mb-1">🚫 Träningsfria perioder</h2>
        <p className="text-slate-500 text-sm mb-4">
          Lägg till perioder då det inte är träning (t.ex. höstlov, jullov). Träningar skapas inte
          automatiskt på dessa datum när du schemalägger återkommande pass.
        </p>

        <form onSubmit={handleAddFreePeriod} className="space-y-2 mb-4">
          <input
            type="text"
            value={newPeriodName}
            onChange={(e) => setNewPeriodName(e.target.value)}
            placeholder="Periodens namn, t.ex. Jullov"
            required
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-0.5">Startdatum</label>
              <input
                type="date"
                value={newPeriodStart}
                onChange={(e) => setNewPeriodStart(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-0.5">Slutdatum</label>
              <input
                type="date"
                value={newPeriodEnd}
                min={newPeriodStart}
                onChange={(e) => setNewPeriodEnd(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={addingPeriod || !newPeriodName.trim() || !newPeriodStart || !newPeriodEnd}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            {addingPeriod ? "…" : "+ Lägg till period"}
          </button>
        </form>

        {freePeriods.length === 0 ? (
          <p className="text-slate-400 text-sm">Inga träningsfria perioder tillagda ännu.</p>
        ) : (
          <ul className="space-y-2">
            {freePeriods
              .slice()
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((period) => (
                <li key={period.id} className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-900">{period.name}</p>
                    <p className="text-xs text-purple-500">
                      {new Date(period.startDate + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}
                      {" – "}
                      {new Date(period.endDate + "T12:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteFreePeriod(period.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold shrink-0"
                  >
                    Ta bort
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Invite user by email */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mt-6">
        <h2 className="font-bold text-slate-100 mb-1">✉️ Bjud in användare via e-post</h2>
        <p className="text-slate-500 text-sm mb-4">
          Skapa ett konto för en ny användare direkt. Personen får ett mail med en länk för att
          sätta sitt eget lösenord.
        </p>
        <form onSubmit={handleInviteUser} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Namn</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Personens namn"
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600 block mb-1">E-post</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="epost@exempel.se"
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Roll</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="player">🏃 Spelare</option>
                <option value="parent">👪 Förälder</option>
                <option value="assistant">👋 Assistent</option>
                <option value="coach">🎽 Coach</option>
                <option value="admin">🏛 Admin</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600 block mb-1">Lag (valfritt)</label>
              <select
                value={inviteTeamId}
                onChange={(e) => setInviteTeamId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="">— Inget lag —</option>
                {(teams ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          {inviteError && (
            <p className="text-red-600 text-sm bg-red-900/30 px-3 py-2 rounded-xl">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-emerald-400 text-sm bg-emerald-900/30 px-3 py-2 rounded-xl">{inviteSuccess}</p>
          )}
          <button
            type="submit"
            disabled={inviteBusy || !inviteEmail.trim() || !inviteName.trim()}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            {inviteBusy ? "Skickar inbjudan…" : "✉️ Skicka inbjudan"}
          </button>
        </form>
      </div>

      {/* User register – all members across all teams */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mt-6">
        <h2 className="font-bold text-slate-100 mb-1">👥 Användarregister</h2>
        <p className="text-slate-500 text-sm mb-4">
          Alla medlemmar i {user.clubName ?? "föreningen"} – du kan redigera deras grupptillhörighet och roller direkt här.
        </p>
        {teams === null ? (
          <p className="text-slate-400 text-sm">Laddar…</p>
        ) : (teams ?? []).length === 0 ? (
          <p className="text-slate-400 text-sm">Inga lag registrerade ännu.</p>
        ) : (() => {
          // Collect all unique members across teams
          const allMembers = new Map<string, { member: ProfileRow; teamIds: string[] }>();
          (teams ?? []).forEach((t) => {
            t.members.forEach((m) => {
              const existing = allMembers.get(m.id);
              if (existing) {
                existing.teamIds.push(t.id);
              } else {
                allMembers.set(m.id, { member: m, teamIds: [t.id] });
              }
            });
          });
          const memberList = [...allMembers.values()];
          if (memberList.length === 0) {
            return <p className="text-slate-400 text-sm">Inga medlemmar ännu.</p>;
          }
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 border-b border-slate-700">
                    <th className="pb-2 pr-4">Namn</th>
                    <th className="pb-2 pr-4">Roller</th>
                    <th className="pb-2">Lag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {memberList
                    .sort((a, b) => a.member.name.localeCompare(b.member.name, "sv"))
                    .map(({ member, teamIds }) => (
                      <tr key={member.id} className="hover:bg-slate-700/30">
                        <td className="py-2 pr-4">
                          <span className="font-medium text-slate-200">{member.name}</span>
                          {member.child_name && (
                            <span className="text-xs text-slate-400 block">
                              Förälder till {member.child_name}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <div
                            className={`flex flex-wrap gap-x-3 gap-y-1 ${changingRole === member.id ? "opacity-50 pointer-events-none" : ""}`}
                          >
                            {ALL_ROLES.map((r) => {
                              const isChecked = member.roles.includes(r);
                              const isLast = isChecked && member.roles.length === 1;
                              return (
                                <label
                                  key={r}
                                  title={isLast ? "Minst en roll krävs" : undefined}
                                  className={`flex items-center gap-1 text-xs cursor-pointer select-none ${isLast ? "opacity-60" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={changingRole === member.id || isLast}
                                    onChange={(e) => toggleRole(member, r, e.target.checked)}
                                    className="accent-orange-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span className="text-slate-600">{roleLabel[r]}</span>
                                </label>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {(teams ?? []).map((t) => {
                              const isInTeam = teamIds.includes(t.id);
                              return (
                                <button
                                  key={t.id}
                                  title={isInTeam ? `Ta bort från ${t.name}` : `Lägg till i ${t.name}`}
                                  onClick={async () => {
                                    if (isInTeam) {
                                      // Remove from team
                                      if (!confirm(`Ta bort ${member.name} från ${t.name}?`)) return;
                                      try {
                                        await deleteDoc(doc(db, "team_members", `${t.id}_${member.id}`));
                                        await updateDoc(doc(db, "teams", t.id), {
                                          memberIds: arrayRemove(member.id),
                                        });

                                      } catch {
                                        alert("Kunde inte ta bort. Försök igen.");
                                      }
                                    } else {
                                      // Add to team
                                      try {
                                        const memberDocRef = doc(db, "team_members", `${t.id}_${member.id}`);
                                        await setDoc(memberDocRef, {
                                          teamId: t.id,
                                          userId: member.id,
                                          role: member.roles[0],
                                          joinedAt: new Date().toISOString(),
                                        });
                                        await updateDoc(doc(db, "teams", t.id), {
                                          memberIds: arrayUnion(member.id),
                                        });

                                      } catch {
                                        alert("Kunde inte lägga till. Försök igen.");
                                      }
                                    }
                                  }}
                                  className={`text-xs px-2 py-0.5 rounded-full font-semibold transition-colors ${
                                    isInTeam
                                      ? "bg-orange-500/20 text-orange-400 hover:bg-orange-200"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  }`}
                                >
                                  {t.name} {isInTeam ? "✓" : "+"}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
