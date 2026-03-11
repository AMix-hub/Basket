"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "../../lib/supabaseClient";

/* ─── Types ──────────────────────────────────────────────── */

export type UserRole = "admin" | "coach" | "assistant" | "parent" | "player";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** ID of the team this user belongs to (null if not in a team) */
  teamId: string | null;
  childName?: string;        // parent: child's name in the player list
  coachInviteCode?: string;  // admin:  code coaches use to register
  clubName?: string;         // admin:  association / club name
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  coachId: string;
  adminId: string;
  clubName: string;
  memberIds: string[];
  inviteCode: string;        // assistants
  parentInviteCode: string;  // parents
  playerInviteCode: string;  // players
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /**
   * Returns null on success, or a Swedish error string on failure.
   */
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  /**
   * Returns null on success, or a Swedish error string on failure.
   * Special return value "CONFIRM_EMAIL" means the user must verify
   * their e-mail before the account is fully active.
   */
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    teamName?: string,
    ageGroup?: string,
    inviteCode?: string,
    childName?: string,
    clubName?: string
  ) => Promise<string | null>;
  joinTeam: (inviteCode: string, childName?: string) => Promise<boolean>;
  getMyTeam: () => Team | null;
  getAllTeams: () => Promise<Team[]>;
}

/* ─── DB row shapes (snake_case from Supabase) ──────────── */

interface DbProfile {
  id: string;
  name: string;
  role: string;
  club_name: string | null;
  coach_invite_code: string | null;
  child_name: string | null;
  created_at: string;
}

interface DbTeam {
  id: string;
  name: string;
  age_group: string;
  coach_id: string | null;
  admin_id: string;
  club_name: string;
  member_ids: string[];
  invite_code: string;
  parent_invite_code: string;
  player_invite_code: string;
}

/* ─── Converters ─────────────────────────────────────────── */

function toUser(p: DbProfile, email: string): User {
  return {
    id: p.id,
    name: p.name,
    email,
    role: p.role as UserRole,
    teamId: null, // resolved separately via team_members
    childName: p.child_name ?? undefined,
    coachInviteCode: p.coach_invite_code ?? undefined,
    clubName: p.club_name ?? undefined,
    createdAt: p.created_at,
  };
}

function toTeam(t: DbTeam): Team {
  return {
    id: t.id,
    name: t.name,
    ageGroup: t.age_group,
    coachId: t.coach_id ?? "",
    adminId: t.admin_id,
    clubName: t.club_name,
    memberIds: t.member_ids ?? [],
    inviteCode: t.invite_code,
    parentInviteCode: t.parent_invite_code,
    playerInviteCode: t.player_invite_code,
  };
}

/* ─── Cryptographically random 6-char code ──────────────── */

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (b) => chars[b % chars.length]
  ).join("");
}

/* ─── Network error helper ───────────────────────────────── */

/**
 * Returns true when the error message indicates a network-level failure
 * (e.g. DNS not found, no internet, CORS) rather than an application error.
 */
function isNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("failed to fetch") || m.includes("networkerror");
}

/* ─── Swedish translation of Supabase error messages ─────── */

/**
 * Maps common English Supabase error messages to user-friendly Swedish.
 * Falls back to the original message for unknown errors.
 */
function translateSupabaseError(message: string): string {
  if (isNetworkError(message)) {
    return "Kunde inte ansluta till servern. Kontrollera din internetanslutning och försök igen.";
  }
  const m = message.toLowerCase();
  if (m.includes("user already registered") || m.includes("already registered")) {
    return "Det finns redan ett konto med den e-postadressen. Prova att logga in istället.";
  }
  if (m.includes("email not confirmed")) {
    return "E-postadressen är inte bekräftad. Kontrollera din inkorg.";
  }
  if (m.includes("invalid login credentials") || m.includes("invalid email or password")) {
    return "Fel e-post eller lösenord. Försök igen.";
  }
  if (m.includes("password should be at least") || m.includes("password is too short")) {
    return "Lösenordet måste vara minst 6 tecken.";
  }
  if (m.includes("invalid email")) {
    return "Ogiltig e-postadress. Kontrollera att du skrivit rätt.";
  }
  if (m.includes("email rate limit") || m.includes("rate limit exceeded") || m.includes("too many requests")) {
    return "För många försök. Vänta en stund och försök igen.";
  }
  if (m.includes("database error") || m.includes("unexpected_failure") || m.includes("error saving new user")) {
    return "Ett tekniskt fel uppstod. Försök igen eller kontakta supporten.";
  }
  if (m.includes("invalid api key") || m.includes("invalid api") || m.includes("no api key") || m.includes("apikey")) {
    return "Tjänsten är inte tillgänglig just nu. Försök igen senare eller kontakta supporten.";
  }
  if (m.includes("signup is disabled") || m.includes("signups not allowed")) {
    return "Registrering är inaktiverad i projektinställningarna. Kontakta administratören.";
  }
  return message;
}

/* ─── Context ────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<User | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [loading, setLoading]     = useState(true);

  /* Load the profile + team for a given auth user */
  const loadProfile = useCallback(
    async (authId: string, email: string): Promise<User | null> => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authId)
        .single<DbProfile>();

      if (error || !profile) return null;

      /* Find team membership */
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", authId)
        .limit(1)
        .maybeSingle();

      const u: User = {
        ...toUser(profile, email),
        teamId: membership?.team_id ?? null,
      };

      setUser(u);

      if (membership?.team_id) {
        const { data: teamRow } = await supabase
          .from("teams")
          .select("*")
          .eq("id", membership.team_id)
          .single<DbTeam>();
        if (teamRow) setCurrentTeam(toTeam(teamRow));
      } else {
        setCurrentTeam(null);
      }

      return u;
    },
    []
  );

  /* ── Initialise session on mount ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? "").finally(() =>
          setLoading(false)
        );
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? "");
      } else {
        setUser(null);
        setCurrentTeam(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  /* ── login ── */
  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) return null;
      return translateSupabaseError(error.message);
    } catch {
      return "Kunde inte ansluta till servern. Kontrollera din internetanslutning och försök igen.";
    }
  };

  /* ── logout ── */
  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentTeam(null);
  };

  /* ── register ── */
  const register = async (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    teamName?: string,
    ageGroup?: string,
    inviteCode?: string,
    childName?: string,
    clubName?: string
  ): Promise<string | null> => {
    try {

    /* 1 ─ Validate invite codes before touching auth ────────── */
    let invitingAdminId: string | null = null;
    let invitingAdminClubName: string | null = null;
    let teamFromCode: DbTeam | null = null;

    if (role === "coach") {
      if (!inviteCode)
        return "Ange admin-inbjudningskoden för att registrera dig som coach.";
      const code = inviteCode.toUpperCase();
      const { data: adminRow } = await supabase
        .from("profiles")
        .select("id, club_name")
        .eq("coach_invite_code", code)
        .eq("role", "admin")
        .maybeSingle();
      if (!adminRow)
        return "Ogiltig admin-inbjudningskod. Kontakta din föreningsadmin.";
      invitingAdminId       = adminRow.id;
      invitingAdminClubName = adminRow.club_name ?? "";
    }

    if (role === "assistant") {
      if (!inviteCode) return "Ange inbjudningskoden från din coach.";
      const code = inviteCode.toUpperCase();
      const { data: teamRow } = await supabase
        .from("teams")
        .select("*")
        .eq("invite_code", code)
        .maybeSingle<DbTeam>();
      if (!teamRow) return "Ogiltig inbjudningskod. Kontrollera att du skrivit rätt.";
      teamFromCode = teamRow;
    }

    if (role === "parent") {
      if (!inviteCode) return "Ange inbjudningskoden från din coach.";
      const code = inviteCode.toUpperCase();
      const { data: teamRow } = await supabase
        .from("teams")
        .select("*")
        .eq("parent_invite_code", code)
        .maybeSingle<DbTeam>();
      if (!teamRow) return "Ogiltig inbjudningskod. Kontrollera att du skrivit rätt.";
      teamFromCode = teamRow;
    }

    if (role === "player") {
      if (!inviteCode) return "Ange inbjudningskoden från din coach.";
      const code = inviteCode.toUpperCase();
      const { data: teamRow } = await supabase
        .from("teams")
        .select("*")
        .eq("player_invite_code", code)
        .maybeSingle<DbTeam>();
      if (!teamRow) return "Ogiltig inbjudningskod. Kontrollera att du skrivit rätt.";
      teamFromCode = teamRow;
    }

    /* 2 ─ Create Supabase auth user ────────────────────────────
         The handle_new_user trigger will INSERT the profile row
         automatically from raw_user_meta_data.               */
    const { data: authData, error: signUpError } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            club_name:  role === "admin"  ? (clubName  ?? "") : "",
            child_name: role === "parent" ? (childName ?? "") : "",
            // coach_invite_code is generated server-side by the trigger
          },
        },
      });

    if (signUpError) return translateSupabaseError(signUpError.message);
    if (!authData.user)
      return "Registreringen misslyckades. Försök igen.";

    const userId = authData.user.id;

    /* 3 ─ Email confirmation required? ─────────────────────── */
    if (!authData.session) {
      return "CONFIRM_EMAIL";
    }

    /* 4 ─ For coaches: create a new team ────────────────────── */
    let teamId: string | null = null;

    if (role === "coach" && teamName && invitingAdminId) {
      const newTeam = {
        id:                  crypto.randomUUID(),
        name:                teamName,
        age_group:           ageGroup ?? "",
        coach_id:            userId,
        admin_id:            invitingAdminId,
        club_name:           invitingAdminClubName ?? "",
        member_ids:          [userId],
        invite_code:         generateCode(),
        parent_invite_code:  generateCode(),
        player_invite_code:  generateCode(),
      };
      const { error: teamErr } = await supabase.from("teams").insert(newTeam);
      if (teamErr) return "Kunde inte skapa laget. Försök igen.";
      teamId = newTeam.id;

      await supabase
        .from("team_members")
        .insert({ team_id: teamId, user_id: userId });
    }

    /* 5 ─ For assistant / parent / player: join existing team ─ */
    if (teamFromCode) {
      teamId = teamFromCode.id;
      const newMemberIds = [
        ...new Set([...( teamFromCode.member_ids ?? []), userId]),
      ];
      await supabase
        .from("teams")
        .update({ member_ids: newMemberIds })
        .eq("id", teamFromCode.id);
      await supabase
        .from("team_members")
        .insert({ team_id: teamId, user_id: userId });
    }

    return null; // success
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return translateSupabaseError(msg) || "Ett oväntat fel uppstod. Försök igen.";
    }
  };

  /* ── joinTeam (for users who already have an account) ── */
  const joinTeam = async (
    inviteCode: string,
    childName?: string
  ): Promise<boolean> => {
    if (!user) return false;
    const code = inviteCode.toUpperCase();

    const { data: teamRow } = await supabase
      .from("teams")
      .select("*")
      .or(
        `invite_code.eq.${code},` +
        `parent_invite_code.eq.${code},` +
        `player_invite_code.eq.${code}`
      )
      .maybeSingle<DbTeam>();

    if (!teamRow) return false;

    const newMemberIds = [
      ...new Set([...(teamRow.member_ids ?? []), user.id]),
    ];

    await supabase
      .from("teams")
      .update({ member_ids: newMemberIds })
      .eq("id", teamRow.id);

    await supabase
      .from("team_members")
      .upsert({ team_id: teamRow.id, user_id: user.id });

    if (childName) {
      await supabase
        .from("profiles")
        .update({ child_name: childName })
        .eq("id", user.id);
    }

    const updatedUser: User = {
      ...user,
      teamId: teamRow.id,
      ...(childName ? { childName } : {}),
    };
    setUser(updatedUser);
    setCurrentTeam(toTeam(teamRow));
    return true;
  };

  /* ── getMyTeam (synchronous, cached) ── */
  const getMyTeam = (): Team | null => currentTeam;

  /* ── getAllTeams (for admin page) ── */
  const getAllTeams = async (): Promise<Team[]> => {
    const { data } = await supabase.from("teams").select("*");
    return (data ?? []).map((t) => toTeam(t as DbTeam));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        register,
        joinTeam,
        getMyTeam,
        getAllTeams,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

