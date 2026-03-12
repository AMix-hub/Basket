"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  or,
  getDocs,
  limit,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebaseClient";

/* ─── Types ──────────────────────────────────────────────── */

export type UserRole = "admin" | "coach" | "assistant" | "parent" | "player";

export interface User {
  id: string;
  name: string;
  email: string;
  /** All roles assigned to this user (at least one). */
  roles: UserRole[];
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

/* ─── Firestore document shapes ──────────────────────────── */

interface DbProfile {
  name: string;
  /** Legacy single-role field; kept for backward compat with Firestore queries. */
  role: string;
  /** Multi-role array; preferred over `role` when present. */
  roles?: string[];
  clubName: string | null;
  coachInviteCode: string | null;
  childName: string | null;
  createdAt: string;
}

interface DbTeam {
  name: string;
  ageGroup: string;
  coachId: string | null;
  adminId: string;
  clubName: string;
  memberIds: string[];
  inviteCode: string;
  parentInviteCode: string;
  playerInviteCode: string;
}

/* ─── Converters ─────────────────────────────────────────── */

function toUser(id: string, p: DbProfile, email: string): User {
  // Prefer the `roles` array; fall back to wrapping the legacy `role` string.
  const roles: UserRole[] =
    p.roles && p.roles.length > 0
      ? (p.roles as UserRole[])
      : [p.role as UserRole];
  return {
    id,
    name: p.name,
    email,
    roles,
    teamId: null, // resolved separately via team_members
    childName: p.childName ?? undefined,
    coachInviteCode: p.coachInviteCode ?? undefined,
    clubName: p.clubName ?? undefined,
    createdAt: p.createdAt,
  };
}

function toTeam(id: string, t: DbTeam): Team {
  return {
    id,
    name: t.name,
    ageGroup: t.ageGroup,
    coachId: t.coachId ?? "",
    adminId: t.adminId,
    clubName: t.clubName,
    memberIds: t.memberIds ?? [],
    inviteCode: t.inviteCode,
    parentInviteCode: t.parentInviteCode,
    playerInviteCode: t.playerInviteCode,
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

/* ─── Swedish translation of Firebase error messages ─────── */

/**
 * Maps common English Firebase error codes to user-friendly Swedish.
 * Falls back to the original message for unknown errors.
 */
function translateFirebaseError(message: string): string {
  if (isNetworkError(message)) {
    return "Kunde inte ansluta till servern. Kontrollera din internetanslutning och försök igen.";
  }
  const m = message.toLowerCase();
  if (m.includes("email-already-in-use") || m.includes("already registered")) {
    return "Det finns redan ett konto med den e-postadressen. Prova att logga in istället.";
  }
  if (m.includes("user-not-found") || m.includes("wrong-password") || m.includes("invalid-credential")) {
    return "Fel e-post eller lösenord. Försök igen.";
  }
  if (m.includes("weak-password") || m.includes("password should be at least")) {
    return "Lösenordet måste vara minst 6 tecken.";
  }
  if (m.includes("invalid-email")) {
    return "Ogiltig e-postadress. Kontrollera att du skrivit rätt.";
  }
  if (m.includes("too-many-requests")) {
    return "För många försök. Vänta en stund och försök igen.";
  }
  if (m.includes("operation-not-allowed") || m.includes("signups not allowed")) {
    return "Registrering är inaktiverad. Kontakta administratören.";
  }
  if (m.includes("network-request-failed")) {
    return "Nätverksfel. Kontrollera din internetanslutning och försök igen.";
  }
  if (m.includes("api-key-not-valid") || m.includes("invalid api")) {
    return "Tjänsten är inte tillgänglig just nu. Försök igen senare eller kontakta supporten.";
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
      /* Fetch profile document */
      const profileSnap = await getDoc(doc(db, "profiles", authId));
      let profileData = profileSnap.exists() ? (profileSnap.data() as DbProfile) : null;

      /* Fallback: profile missing – create from provided info */
      if (!profileData) {
        const fallbackProfile: DbProfile = {
          name: "Okänd",
          role: "player",
          roles: ["player"],
          clubName: null,
          coachInviteCode: null,
          childName: null,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "profiles", authId), fallbackProfile);
        profileData = fallbackProfile;
      }

      /* Find team membership */
      let teamId: string | null = null;
      const membershipSnap = await getDocs(
        query(
          collection(db, "team_members"),
          where("userId", "==", authId),
          limit(1)
        )
      );
      if (!membershipSnap.empty) {
        teamId = membershipSnap.docs[0].data().teamId as string;
      }

      /* For admins: auto-enroll in all teams they administer (self-healing).
       * This covers teams created before this feature, or when the admin was
       * already logged in at the time the coach registered and created a team. */
      const isAdminUser =
        (profileData.roles ?? []).includes("admin") ||
        profileData.role === "admin";
      if (isAdminUser) {
        const [adminTeamsSnap, existingMembershipsSnap] = await Promise.all([
          getDocs(query(collection(db, "teams"), where("adminId", "==", authId))),
          getDocs(query(collection(db, "team_members"), where("userId", "==", authId))),
        ]);
        const memberTeamIds = new Set(
          existingMembershipsSnap.docs.map((d) => d.data().teamId as string)
        );
        for (const teamDoc of adminTeamsSnap.docs) {
          if (!memberTeamIds.has(teamDoc.id)) {
            await setDoc(doc(db, "team_members", `${teamDoc.id}_${authId}`), {
              teamId: teamDoc.id,
              userId: authId,
              joinedAt: new Date().toISOString(),
            });
            /* Atomically add admin to memberIds if not already present */
            await updateDoc(doc(db, "teams", teamDoc.id), {
              memberIds: arrayUnion(authId),
            });
          }
          if (!teamId) {
            teamId = teamDoc.id;
          }
        }
      }

      const u: User = {
        ...toUser(authId, profileData, email),
        teamId,
      };

      setUser(u);

      if (teamId) {
        const teamSnap = await getDoc(doc(db, "teams", teamId));
        if (teamSnap.exists()) setCurrentTeam(toTeam(teamId, teamSnap.data() as DbTeam));
      } else {
        setCurrentTeam(null);
      }

      return u;
    },
    []
  );

  /* ── Initialise session on mount ── */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        loadProfile(firebaseUser.uid, firebaseUser.email ?? "").finally(() =>
          setLoading(false)
        );
      } else {
        setUser(null);
        setCurrentTeam(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadProfile]);

  /* ── login ── */
  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return translateFirebaseError(msg);
    }
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
    let teamFromCode: { id: string; data: DbTeam } | null = null;

    if (role === "coach") {
      if (!inviteCode)
        return "Ange admin-inbjudningskoden för att registrera dig som coach.";
      const code = inviteCode.toUpperCase();
      const adminSnap = await getDocs(
        query(
          collection(db, "profiles"),
          where("coachInviteCode", "==", code),
          where("role", "==", "admin"),
          limit(1)
        )
      );
      if (adminSnap.empty)
        return "Ogiltig admin-inbjudningskod. Kontakta din föreningsadmin.";
      const adminDoc = adminSnap.docs[0];
      invitingAdminId       = adminDoc.id;
      invitingAdminClubName = (adminDoc.data().clubName as string) ?? "";
    }

    if (role === "assistant") {
      if (!inviteCode) return "Ange inbjudningskoden från din coach.";
      const code = inviteCode.toUpperCase();
      const teamSnap = await getDocs(
        query(collection(db, "teams"), where("inviteCode", "==", code), limit(1))
      );
      if (teamSnap.empty) return "Ogiltig inbjudningskod. Kontrollera att du skrivit rätt.";
      teamFromCode = { id: teamSnap.docs[0].id, data: teamSnap.docs[0].data() as DbTeam };
    }

    if (role === "parent") {
      if (!inviteCode) return "Ange inbjudningskoden från din coach.";
      const code = inviteCode.toUpperCase();
      const teamSnap = await getDocs(
        query(collection(db, "teams"), where("parentInviteCode", "==", code), limit(1))
      );
      if (teamSnap.empty) return "Ogiltig inbjudningskod. Kontrollera att du skrivit rätt.";
      teamFromCode = { id: teamSnap.docs[0].id, data: teamSnap.docs[0].data() as DbTeam };
    }

    if (role === "player") {
      if (!inviteCode) return "Ange inbjudningskoden från din coach.";
      const code = inviteCode.toUpperCase();
      const teamSnap = await getDocs(
        query(collection(db, "teams"), where("playerInviteCode", "==", code), limit(1))
      );
      if (teamSnap.empty) return "Ogiltig inbjudningskod. Kontrollera att du skrivit rätt.";
      teamFromCode = { id: teamSnap.docs[0].id, data: teamSnap.docs[0].data() as DbTeam };
    }

    /* 2 ─ Create Firebase auth user ────────────────────────── */
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = credential.user.uid;

    /* 3 ─ Create profile in Firestore ───────────────────────── */
    const newProfile: DbProfile = {
      name: name || "Okänd",
      role,
      roles: [role],
      clubName:        role === "admin"  ? (clubName  ?? null) : null,
      childName:       role === "parent" ? (childName ?? null) : null,
      coachInviteCode: role === "admin"  ? generateCode()      : null,
      createdAt:       new Date().toISOString(),
    };
    await setDoc(doc(db, "profiles", userId), newProfile);

    /* 4 ─ For coaches: create a new team ────────────────────── */
    let newTeamId: string | null = null;

    if (role === "coach" && teamName && invitingAdminId) {
      newTeamId = crypto.randomUUID();
      const newTeam: DbTeam = {
        name:              teamName,
        ageGroup:          ageGroup ?? "",
        coachId:           userId,
        adminId:           invitingAdminId,
        clubName:          invitingAdminClubName ?? "",
        memberIds:         [userId, invitingAdminId],
        inviteCode:        generateCode(),
        parentInviteCode:  generateCode(),
        playerInviteCode:  generateCode(),
      };
      await setDoc(doc(db, "teams", newTeamId), newTeam);
      await setDoc(doc(db, "team_members", `${newTeamId}_${userId}`), {
        teamId: newTeamId,
        userId,
        joinedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, "team_members", `${newTeamId}_${invitingAdminId}`), {
        teamId: newTeamId,
        userId: invitingAdminId,
        joinedAt: new Date().toISOString(),
      });
    }

    /* 5 ─ For assistant / parent / player: join existing team ─ */
    if (teamFromCode) {
      newTeamId = teamFromCode.id;
      const newMemberIds = [
        ...new Set([...(teamFromCode.data.memberIds ?? []), userId]),
      ];
      await updateDoc(doc(db, "teams", teamFromCode.id), { memberIds: newMemberIds });
      await setDoc(doc(db, "team_members", `${teamFromCode.id}_${userId}`), {
        teamId: teamFromCode.id,
        userId,
        joinedAt: new Date().toISOString(),
      });
    }

    return null; // success
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return translateFirebaseError(msg) || "Ett oväntat fel uppstod. Försök igen.";
    }
  };

  /* ── logout ── */
  const logout = async (): Promise<void> => {
    await firebaseSignOut(auth);
    setUser(null);
    setCurrentTeam(null);
  };

  /* ── joinTeam (for users who already have an account) ── */
  const joinTeam = async (
    inviteCode: string,
    childName?: string
  ): Promise<boolean> => {
    if (!user) return false;
    const code = inviteCode.toUpperCase();

    /* Try all three invite code fields in a single query */
    let teamId: string | null = null;
    let teamData: DbTeam | null = null;

    const snap = await getDocs(
      query(
        collection(db, "teams"),
        or(
          where("inviteCode", "==", code),
          where("parentInviteCode", "==", code),
          where("playerInviteCode", "==", code)
        ),
        limit(1)
      )
    );
    if (!snap.empty) {
      teamId   = snap.docs[0].id;
      teamData = snap.docs[0].data() as DbTeam;
    }

    if (!teamId || !teamData) return false;

    const newMemberIds = [
      ...new Set([...(teamData.memberIds ?? []), user.id]),
    ];

    await updateDoc(doc(db, "teams", teamId), { memberIds: newMemberIds });
    await setDoc(doc(db, "team_members", `${teamId}_${user.id}`), {
      teamId,
      userId: user.id,
      joinedAt: new Date().toISOString(),
    });

    if (childName) {
      await updateDoc(doc(db, "profiles", user.id), { childName });
    }

    const updatedUser: User = {
      ...user,
      teamId,
      ...(childName ? { childName } : {}),
    };
    setUser(updatedUser);
    setCurrentTeam(toTeam(teamId, teamData));
    return true;
  };

  /* ── getMyTeam (synchronous, cached) ── */
  const getMyTeam = (): Team | null => currentTeam;

  /* ── getAllTeams (for admin page) ── */
  const getAllTeams = async (): Promise<Team[]> => {
    const snap = await getDocs(collection(db, "teams"));
    return snap.docs.map((d) => toTeam(d.id, d.data() as DbTeam));
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

