"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import type { SportId } from "../../lib/sports";

/* ─── Types ──────────────────────────────────────────────── */

export type UserRole = "admin" | "co_admin" | "coach" | "assistant" | "parent" | "player";

export interface User {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  teamId: string | null;
  teamIds: string[];
  childName?: string;
  coachInviteCode?: string;
  clubName?: string;
  clubLogoUrl?: string;
  clubWebsiteUrl?: string;
  avatarUrl?: string;
  sport?: SportId;
  createdAt: string;
  adminId?: string | null;
}

export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  coachId: string;
  adminId: string;
  clubName: string;
  clubLogoUrl?: string;
  clubWebsiteUrl?: string;
  sport: SportId;
  memberIds: string[];
  inviteCode: string;
  parentInviteCode: string;
  playerInviteCode: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login:    (email: string, password: string) => Promise<string | null>;
  logout:   () => Promise<void>;
  register: (
    name: string, email: string, password: string, role: UserRole,
    teamName?: string, ageGroup?: string, inviteCode?: string,
    childName?: string, clubName?: string, sport?: SportId
  ) => Promise<string | null>;
  joinTeam:             (inviteCode: string, childName?: string) => Promise<boolean>;
  getMyTeam:            () => Team | null;
  getMyTeams:           () => Team[];
  getAllTeams:           () => Promise<Team[]>;
  createTeam:           (teamName: string, ageGroup?: string) => Promise<string | null>;
  updateClubLogo:       (file: File) => Promise<string | null>;
  updateClubLogoUrl:    (url: string) => Promise<string | null>;
  updateClubWebsiteUrl: (url: string) => Promise<string | null>;
  updateAvatar:         (file: File) => Promise<string | null>;
  requestPushPermission: () => Promise<void>;
}

/* ─── Row shapes ─────────────────────────────────────────── */

interface DbProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  roles: string[];
  admin_id: string | null;
  sport: string;
  club_name: string | null;
  club_logo_url: string | null;
  club_website_url: string | null;
  coach_invite_code: string | null;
  child_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface DbTeam {
  id: string;
  name: string;
  age_group: string;
  coach_id: string | null;
  admin_id: string;
  club_name: string;
  club_logo_url: string | null;
  club_website_url: string | null;
  sport: string;
  member_ids: string[];
  invite_code: string;
  parent_invite_code: string;
  player_invite_code: string;
}

/* ─── Converters ─────────────────────────────────────────── */

function toUser(p: DbProfile): User {
  const roles: UserRole[] =
    p.roles && p.roles.length > 0 ? (p.roles as UserRole[]) : [p.role as UserRole];
  return {
    id:              p.id,
    name:            p.name,
    email:           p.email,
    roles,
    teamId:          null,
    teamIds:         [],
    childName:       p.child_name    ?? undefined,
    coachInviteCode: p.coach_invite_code ?? undefined,
    clubName:        p.club_name     ?? undefined,
    clubLogoUrl:     p.club_logo_url  ?? undefined,
    clubWebsiteUrl:  p.club_website_url ?? undefined,
    avatarUrl:       p.avatar_url    ?? undefined,
    sport:           (p.sport as SportId) ?? "basket",
    createdAt:       p.created_at,
    adminId:         p.admin_id,
  };
}

function toTeam(t: DbTeam): Team {
  return {
    id:               t.id,
    name:             t.name,
    ageGroup:         t.age_group,
    coachId:          t.coach_id ?? "",
    adminId:          t.admin_id,
    clubName:         t.club_name,
    clubLogoUrl:      t.club_logo_url  ?? undefined,
    clubWebsiteUrl:   t.club_website_url ?? undefined,
    sport:            (t.sport as SportId) ?? "basket",
    memberIds:        t.member_ids ?? [],
    inviteCode:       t.invite_code,
    parentInviteCode: t.parent_invite_code,
    playerInviteCode: t.player_invite_code,
  };
}

/* ─── Helpers ────────────────────────────────────────────── */

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (b) => chars[b % chars.length]
  ).join("");
}

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("email not confirmed")) {
    return "Fel e-post eller lösenord. Försök igen.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Det finns redan ett konto med den e-postadressen. Prova att logga in istället.";
  }
  if (m.includes("password should be at least") || m.includes("weak password")) {
    return "Lösenordet måste vara minst 6 tecken.";
  }
  if (m.includes("invalid email") || m.includes("unable to validate email")) {
    return "Ogiltig e-postadress. Kontrollera att du skrivit rätt.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "För många försök. Vänta en stund och försök igen.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Kunde inte ansluta till servern. Kontrollera din internetanslutning.";
  }
  if (m.includes("permission") || m.includes("unauthorized") || m.includes("not allowed")) {
    return "Behörighetsfel – kontrollera din anslutning och försök igen.";
  }
  return message;
}

/* ─── Context ────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,         setUser]         = useState<User | null>(null);
  const [currentTeam,  setCurrentTeam]  = useState<Team | null>(null);
  const [currentTeams, setCurrentTeams] = useState<Team[]>([]);
  const [loading,      setLoading]      = useState(true);

  /* ── loadProfile ── */
  const loadProfile = useCallback(async (userId: string): Promise<User | null> => {
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      console.warn("[AuthContext] loadProfile: profil saknas för", userId);
      setUser(null);
      setCurrentTeam(null);
      setCurrentTeams([]);
      return null;
    }

    const p = profile as DbProfile;

    /* Load team memberships */
    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", userId);

    const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id);

    let loadedTeams: Team[] = [];
    if (teamIds.length > 0) {
      const { data: teamRows } = await supabase
        .from("teams")
        .select("*")
        .in("id", teamIds);
      loadedTeams = (teamRows ?? []).map((t) => toTeam(t as DbTeam));
    }

    /* For admins: also load teams they administrate but aren't a member of */
    const effectiveAdminId = p.admin_id ?? userId;
    if (p.role === "admin" || p.role === "co_admin") {
      const { data: adminTeamRows } = await supabase
        .from("teams")
        .select("*")
        .eq("admin_id", effectiveAdminId);
      const adminTeams = (adminTeamRows ?? []).map((t) => toTeam(t as DbTeam));
      const existingIds = new Set(loadedTeams.map((t) => t.id));
      for (const t of adminTeams) {
        if (!existingIds.has(t.id)) loadedTeams.push(t);
      }
    }

    setCurrentTeams(loadedTeams);

    const primaryTeam = loadedTeams[0] ?? null;
    const u: User = {
      ...toUser(p),
      teamId:  primaryTeam?.id ?? null,
      teamIds: loadedTeams.map((t) => t.id),
    };
    setUser(u);
    setCurrentTeam(primaryTeam);
    return u;
  }, []);

  /* ── Init: listen to Supabase auth state changes ── */
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setUser(null);
        setCurrentTeam(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setLoading(true);
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setUser(null);
        setCurrentTeam(null);
        setCurrentTeams([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  /* ── Real-time profile sync ── */
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const p = payload.new as DbProfile;
          const roles: UserRole[] =
            p.roles && p.roles.length > 0 ? (p.roles as UserRole[]) : [p.role as UserRole];
          setUser((prev) =>
            prev ? {
              ...prev,
              roles,
              adminId:        p.admin_id,
              clubName:       p.club_name    ?? prev.clubName,
              clubLogoUrl:    p.club_logo_url ?? prev.clubLogoUrl,
              clubWebsiteUrl: p.club_website_url ?? prev.clubWebsiteUrl,
              coachInviteCode: p.coach_invite_code ?? prev.coachInviteCode,
            } : prev
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  /* ── login ── */
  const login = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return translateError(error.message);
    return null;
  };

  /* ── register ── */
  const register = async (
    name: string, email: string, password: string, role: UserRole,
    teamName?: string, ageGroup?: string, inviteCode?: string,
    childName?: string, clubName?: string, sport?: SportId
  ): Promise<string | null> => {
    try {
      /* 1 – Validate invite codes (pre-auth, no write) */
      let invitingAdminId:       string | null = null;
      let invitingAdminClubName: string | null = null;
      let invitingAdminLogoUrl:  string | null = null;
      let teamFromCode: DbTeam | null = null;

      if (role === "coach") {
        if (!inviteCode) return "Ange admin-inbjudningskoden för att registrera dig som coach.";
        const { data } = await supabase
          .from("profiles")
          .select("id, club_name, club_logo_url")
          .eq("coach_invite_code", inviteCode.toUpperCase())
          .in("role", ["admin", "co_admin"])
          .limit(1)
          .single();
        if (!data) return "Ogiltig admin-inbjudningskod. Kontakta din föreningsadmin.";
        invitingAdminId       = data.id;
        invitingAdminClubName = data.club_name;
        invitingAdminLogoUrl  = data.club_logo_url;
      }

      if (role === "assistant") {
        if (!inviteCode) return "Ange inbjudningskoden från din coach.";
        const { data } = await supabase
          .from("teams").select("*").eq("invite_code", inviteCode.toUpperCase()).limit(1).single();
        if (!data) return "Ogiltig inbjudningskod. Kontrollera att du skrivit rätt.";
        teamFromCode = data as DbTeam;
      }

      if (role === "parent") {
        if (!inviteCode) return "Ange inbjudningskoden från din coach.";
        const { data } = await supabase
          .from("teams").select("*").eq("parent_invite_code", inviteCode.toUpperCase()).limit(1).single();
        if (!data) return "Ogiltig inbjudningskod. Kontrollera att du skrivit rätt.";
        teamFromCode = data as DbTeam;
      }

      if (role === "player") {
        if (!inviteCode) return "Ange inbjudningskoden från din coach.";
        const { data } = await supabase
          .from("teams").select("*").eq("player_invite_code", inviteCode.toUpperCase()).limit(1).single();
        if (!data) return "Ogiltig inbjudningskod. Kontrollera att du skrivit rätt.";
        teamFromCode = data as DbTeam;
      }

      /* 2 – Create auth user (DB trigger creates the profile row) */
      const adminId = invitingAdminId ?? teamFromCode?.admin_id ?? null;
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            sport:      sport ?? "basket",
            club_name:  clubName ?? null,
            child_name: childName ?? null,
            admin_id:   adminId,
          },
        },
      });

      if (signUpErr) return translateError(signUpErr.message);
      if (!authData.user) return "Kunde inte skapa kontot. Försök igen.";
      const userId = authData.user.id;

      /* 3 – For coach: create team + team_members */
      if (role === "coach" && teamName && invitingAdminId) {
        const newTeamId = crypto.randomUUID();
        const { error: teamErr } = await supabase.from("teams").insert({
          id:                 newTeamId,
          name:               teamName,
          age_group:          ageGroup ?? "",
          coach_id:           userId,
          admin_id:           invitingAdminId,
          club_name:          invitingAdminClubName ?? "",
          club_logo_url:      invitingAdminLogoUrl ?? null,
          sport:              sport ?? "basket",
          member_ids:         [userId, invitingAdminId],
          invite_code:        generateCode(),
          parent_invite_code: generateCode(),
          player_invite_code: generateCode(),
        });
        if (teamErr) console.warn("[register] team insert failed:", teamErr.message);

        await supabase.from("team_members").insert([
          { team_id: newTeamId, user_id: userId },
          { team_id: newTeamId, user_id: invitingAdminId },
        ]);
      }

      /* 4 – For assistant / parent / player: join existing team */
      if (teamFromCode) {
        const newMemberIds = [...new Set([...(teamFromCode.member_ids ?? []), userId])];
        await supabase.from("teams")
          .update({ member_ids: newMemberIds })
          .eq("id", teamFromCode.id);
        await supabase.from("team_members").insert({ team_id: teamFromCode.id, user_id: userId });
      }

      return null; // success
    } catch (err) {
      return translateError(err instanceof Error ? err.message : String(err));
    }
  };

  /* ── logout ── */
  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentTeam(null);
    setCurrentTeams([]);
  };

  /* ── joinTeam ── */
  const joinTeam = async (inviteCode: string, childName?: string): Promise<boolean> => {
    if (!user) return false;
    const code = inviteCode.toUpperCase();

    const { data: rows } = await supabase
      .from("teams")
      .select("*")
      .or(`invite_code.eq.${code},parent_invite_code.eq.${code},player_invite_code.eq.${code}`)
      .limit(1);

    if (!rows || rows.length === 0) return false;
    const team = rows[0] as DbTeam;

    // Determine role from which code matched
    let newRole: UserRole = "assistant";
    if (team.parent_invite_code === code) newRole = "parent";
    if (team.player_invite_code === code) newRole = "player";

    const newMemberIds = [...new Set([...(team.member_ids ?? []), user.id])];
    await supabase.from("teams").update({ member_ids: newMemberIds }).eq("id", team.id);
    await supabase.from("team_members")
      .upsert({ team_id: team.id, user_id: user.id }, { onConflict: "team_id,user_id" });

    // Update profile role if necessary (e.g., player joining)
    const currentRoles = user.roles;
    if (!currentRoles.includes(newRole)) {
      const updatedRoles = [...currentRoles, newRole];
      await supabase.from("profiles").update({ role: newRole, roles: updatedRoles }).eq("id", user.id);
    }
    if (childName) {
      await supabase.from("profiles").update({ child_name: childName }).eq("id", user.id);
    }

    await loadProfile(user.id);
    return true;
  };

  /* ── createTeam ── */
  const createTeam = async (teamName: string, ageGroup?: string): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad.";
    if (!user.roles.includes("admin") && !user.roles.includes("co_admin")) {
      return "Endast admins kan skapa lag.";
    }
    const effectiveAdminId = user.adminId ?? user.id;
    const { data: adminProfile } = await supabase
      .from("profiles").select("club_name, club_logo_url, club_website_url").eq("id", effectiveAdminId).single();

    const newTeamId = crypto.randomUUID();
    const { error } = await supabase.from("teams").insert({
      id:                 newTeamId,
      name:               teamName,
      age_group:          ageGroup ?? "",
      coach_id:           null,
      admin_id:           effectiveAdminId,
      club_name:          adminProfile?.club_name ?? "",
      club_logo_url:      adminProfile?.club_logo_url ?? null,
      sport:              user.sport ?? "basket",
      member_ids:         [user.id],
      invite_code:        generateCode(),
      parent_invite_code: generateCode(),
      player_invite_code: generateCode(),
    });
    if (error) return translateError(error.message);

    await supabase.from("team_members").insert({ team_id: newTeamId, user_id: user.id });
    await loadProfile(user.id);
    return null;
  };

  /* ── updateClubLogo (file upload) ── */
  const updateClubLogo = async (file: File): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad.";
    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/logo.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("club-logos")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (upErr) return translateError(upErr.message);

    const { data: { publicUrl } } = supabase.storage.from("club-logos").getPublicUrl(path);
    return updateClubLogoUrl(publicUrl);
  };

  /* ── updateClubLogoUrl ── */
  const updateClubLogoUrl = async (url: string): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad.";
    const effectiveAdminId = user.adminId ?? user.id;

    const { error: pErr } = await supabase.from("profiles")
      .update({ club_logo_url: url }).eq("id", effectiveAdminId);
    if (pErr) return translateError(pErr.message);

    // Propagate to all teams under this admin
    await supabase.from("teams").update({ club_logo_url: url }).eq("admin_id", effectiveAdminId);
    setUser((prev) => prev ? { ...prev, clubLogoUrl: url } : prev);
    return null;
  };

  /* ── updateClubWebsiteUrl ── */
  const updateClubWebsiteUrl = async (url: string): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad.";
    const effectiveAdminId = user.adminId ?? user.id;

    const { error } = await supabase.from("profiles")
      .update({ club_website_url: url }).eq("id", effectiveAdminId);
    if (error) return translateError(error.message);

    await supabase.from("teams").update({ club_website_url: url }).eq("admin_id", effectiveAdminId);
    setUser((prev) => prev ? { ...prev, clubWebsiteUrl: url } : prev);
    return null;
  };

  /* ── updateAvatar ── */
  const updateAvatar = async (file: File): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad.";
    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (upErr) return translateError(upErr.message);

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    if (error) return translateError(error.message);
    setUser((prev) => prev ? { ...prev, avatarUrl: publicUrl } : prev);
    return null;
  };

  /* ── requestPushPermission (no-op: FCM removed, can add Web Push later) ── */
  const requestPushPermission = async (): Promise<void> => {};

  /* ── Helpers ── */
  const getMyTeam   = () => currentTeam;
  const getMyTeams  = () => currentTeams;
  const getAllTeams  = async (): Promise<Team[]> => {
    if (!user) return [];
    const effectiveAdminId = user.adminId ?? user.id;
    const { data } = await supabase.from("teams").select("*").eq("admin_id", effectiveAdminId);
    return (data ?? []).map((t) => toTeam(t as DbTeam));
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, logout, register,
      joinTeam, getMyTeam, getMyTeams, getAllTeams,
      createTeam, updateClubLogo, updateClubLogoUrl,
      updateClubWebsiteUrl, updateAvatar, requestPushPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
