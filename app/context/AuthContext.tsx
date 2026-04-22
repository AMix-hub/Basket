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
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { auth, db, storage, getClientMessaging } from "../../lib/firebaseClient";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getToken } from "firebase/messaging";
import type { SportId } from "../../lib/sports";

/* ─── Image upload helpers ───────────────────────────────────── */

/** Regex that matches known image file extensions (covers gallery files that
 *  may report an empty MIME type, e.g. HEIC photos on iOS). */
const KNOWN_IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg|avif|tiff?)$/i;

/** Maps lowercase file extensions to their MIME types.  Used to supply an
 *  explicit contentType when uploading files whose `file.type` is empty,
 *  ensuring Firebase Storage rules (`contentType.matches('image/.*')`) pass. */
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp", heic: "image/heic",
  heif: "image/heif", bmp: "image/bmp", avif: "image/avif",
  tiff: "image/tiff", tif: "image/tiff", svg: "image/svg+xml",
};

/* ─── Types ──────────────────────────────────────────────── */

export type UserRole = "admin" | "coach" | "assistant" | "parent" | "player";

export interface User {
  id: string;
  name: string;
  email: string;
  /** All roles assigned to this user (at least one). */
  roles: UserRole[];
  /** Primary team ID (first joined, or null if not in any team). */
  teamId: string | null;
  /** All team IDs this user belongs to (supports multi-group membership). */
  teamIds: string[];
  childName?: string;        // parent: child's name in the player list
  coachInviteCode?: string;  // admin:  code coaches use to register
  clubName?: string;         // admin:  association / club name
  /** URL to the club's logo image (set by admin). */
  clubLogoUrl?: string;
  /** URL to the club's website for fetching news (set by admin). */
  clubWebsiteUrl?: string;
  /** URL to the user's personal profile avatar image. */
  avatarUrl?: string;
  /** Sport this user / club is associated with (defaults to "basket"). */
  sport?: SportId;
  createdAt: string;
  /**
   * The Firestore ID of the club admin who administers this user's club.
   * For the original club admin this is null (they own the club).
   * For co-admins (coaches/assistants elevated to admin), this points to the
   * original admin so that all club-scoped queries resolve correctly.
   */
  adminId?: string | null;
}

export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  coachId: string;
  adminId: string;
  clubName: string;
  /** URL to the club's logo image (set by admin). */
  clubLogoUrl?: string;
  /** URL to the club's website for fetching news (set by admin, propagated to teams). */
  clubWebsiteUrl?: string;
  sport: SportId;
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
    clubName?: string,
    sport?: SportId
  ) => Promise<string | null>;
  joinTeam: (inviteCode: string, childName?: string) => Promise<boolean>;
  getMyTeam: () => Team | null;
  /** Returns all teams the current user belongs to (multi-group support). */
  getMyTeams: () => Team[];
  getAllTeams: () => Promise<Team[]>;
  /**
   * Admin creates a new team. Returns null on success, or a Swedish error string.
   */
  createTeam: (teamName: string, ageGroup?: string) => Promise<string | null>;
  /**
   * Admin uploads a club logo image. Returns null on success, or a Swedish error string.
   */
  updateClubLogo: (file: File) => Promise<string | null>;
  /**
   * Admin sets the club logo to an external URL. Returns null on success, or a Swedish error string.
   */
  updateClubLogoUrl: (url: string) => Promise<string | null>;
  /**
   * Admin sets the club's website URL for news fetching. Returns null on success, or a Swedish error string.
   */
  updateClubWebsiteUrl: (url: string) => Promise<string | null>;
  /**
   * Any user can upload a personal avatar image. Returns null on success, or a Swedish error string.
   */
  updateAvatar: (file: File) => Promise<string | null>;
  /**
   * Requests push-notification permission and registers an FCM token for the
   * current user.  Call this when the user explicitly clicks "Aktivera notiser".
   */
  requestPushPermission: () => Promise<void>;
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
  /** Sport this user is associated with (defaults to "basket"). */
  sport?: string;
  /** URL to the club's logo image (admin only). */
  clubLogoUrl?: string;
  /** URL to the club's website for fetching news (admin only). */
  clubWebsiteUrl?: string;
  /** Email stored for push/email notification delivery. */
  email?: string;
  /** FCM token for device push notifications (updated on every login). */
  fcmToken?: string | null;
  /** ID of the admin who administers this user (set at registration). */
  adminId?: string | null;
  /** URL to the user's personal profile avatar image. */
  avatarUrl?: string;
}

interface DbTeam {
  name: string;
  ageGroup: string;
  coachId: string | null;
  adminId: string;
  clubName: string;
  /** URL to the club's logo image (propagated from admin profile). */
  clubLogoUrl?: string | null;
  /** URL to the club's website for news (propagated from admin profile). */
  clubWebsiteUrl?: string | null;
  sport?: string;
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
    teamId: null,   // resolved separately via team_members
    teamIds: [],    // resolved separately via team_members
    childName: p.childName ?? undefined,
    coachInviteCode: p.coachInviteCode ?? undefined,
    clubName: p.clubName ?? undefined,
    clubLogoUrl: p.clubLogoUrl ?? undefined,
    clubWebsiteUrl: p.clubWebsiteUrl ?? undefined,
    avatarUrl: p.avatarUrl ?? undefined,
    sport: (p.sport as SportId | undefined) ?? "basket",
    createdAt: p.createdAt,
    adminId: p.adminId ?? null,
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
    clubLogoUrl: t.clubLogoUrl ?? undefined,
    clubWebsiteUrl: t.clubWebsiteUrl ?? undefined,
    sport: (t.sport as SportId | undefined) ?? "basket",
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
  if (m.includes("unauthorized-domain")) {
    return "Den här domänen är inte behörig för inloggning. Kontakta supporten.";
  }
  if (m.includes("user-disabled")) {
    return "Det här kontot har inaktiverats. Kontakta administratören.";
  }
  if (m.includes("missing or insufficient permissions") || m.includes("permission-denied")) {
    return "Behörighetsfel – kontrollera din anslutning och försök igen. Om felet kvarstår, kontakta supporten.";
  }
  return message;
}

/* ─── Context ────────────────────────────────────────────── */

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<User | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [currentTeams, setCurrentTeams] = useState<Team[]>([]);
  const [loading, setLoading]     = useState(true);

  /* Load the profile + team for a given auth user */
  const loadProfile = useCallback(
    async (authId: string, email: string): Promise<User | null> => {
      /* Fetch profile document */
      const profileSnap = await getDoc(doc(db, "profiles", authId));
      let profileData = profileSnap.exists() ? (profileSnap.data() as DbProfile) : null;

      /* Fallback: profile missing – this can happen briefly during registration
       * while register() is still awaiting the Firestore write, or for users
       * whose profile was deleted.  Do NOT auto-create a fallback here because
       * it races with register()'s own setDoc and can overwrite the real profile
       * with wrong data.  Return null and let the caller handle the empty state. */
      if (!profileData) {
        console.warn("[loadProfile] Profile missing for uid:", authId);
        setUser(null);
        setCurrentTeam(null);
        setCurrentTeams([]);
        return null;
      }

      /* Find ALL team memberships (multi-group support) */
      const membershipSnap = await getDocs(
        query(collection(db, "team_members"), where("userId", "==", authId))
      );
      const memberTeamIdsSet = new Set(
        membershipSnap.docs.map((d) => d.data().teamId as string)
      );
      let teamId: string | null = membershipSnap.docs.length > 0
        ? (membershipSnap.docs[0].data().teamId as string)
        : null;

      /* For admins: auto-enroll in all teams they administer (self-healing).
       * This covers teams created before this feature, or when the admin was
       * already logged in at the time the coach registered and created a team.
       * For co-admins (promoted from coach), use their adminId to find the club
       * teams (since those teams' adminId still points to the original admin). */
      const isAdminUser =
        (profileData.roles ?? []).includes("admin") ||
        profileData.role === "admin";
      if (isAdminUser) {
        // Co-admins have adminId pointing to the original club admin; use that
        // to find the right club teams. Root admins have adminId = null so fall
        // back to their own id.
        let effectiveAdminId = profileData.adminId ?? authId;
        let adminTeamsSnap = await getDocs(
          query(collection(db, "teams"), where("adminId", "==", effectiveAdminId))
        );

        /* Self-healing case 1: adminId is set but points to the wrong club.
         * Detect this when the adminId-based query returns empty AND the user's
         * own UID has teams (meaning they are actually a root admin whose
         * adminId was incorrectly written, e.g. by another admin toggling their
         * role).  Fix: clear adminId so the root admin's own UID is used. */
        if (adminTeamsSnap.empty && profileData.adminId) {
          const ownTeamsSnap = await getDocs(
            query(collection(db, "teams"), where("adminId", "==", authId))
          );
          if (!ownTeamsSnap.empty) {
            await updateDoc(doc(db, "profiles", authId), { adminId: null });
            profileData = { ...profileData, adminId: null };
            effectiveAdminId = authId;
            adminTeamsSnap = ownTeamsSnap;
          }
        }

        /* Self-healing case 2: promoted admins whose profile has no adminId set
         * (toggleRole bug – adminId was never written) and no teams are found
         * under their own ID.  Infer the club's root admin from the teams they
         * are already enrolled in.  Then persist the correct adminId so all
         * subsequent club-scoped queries resolve correctly. */
        if (adminTeamsSnap.empty && !profileData.adminId) {
          const memberTeamIdsArray = [...memberTeamIdsSet];
          if (memberTeamIdsArray.length > 0) {
            const memberTeamSnaps = await Promise.all(
              memberTeamIdsArray.map((tid) => getDoc(doc(db, "teams", tid)))
            );
            const inferredAdminId = memberTeamSnaps
              .filter((s) => s.exists())
              .map((s) => (s.data() as DbTeam).adminId)
              .find((id) => id && id !== authId);
            if (inferredAdminId) {
              // Fix the profile so future logins resolve correctly (admin can
              // always update their own profile document).
              await updateDoc(doc(db, "profiles", authId), {
                adminId: inferredAdminId,
              });
              profileData = { ...profileData, adminId: inferredAdminId };
              effectiveAdminId = inferredAdminId;
              adminTeamsSnap = await getDocs(
                query(
                  collection(db, "teams"),
                  where("adminId", "==", effectiveAdminId)
                )
              );
            } else {
              // All enrolled teams have adminId === authId: this admin created
              // their own teams and is a root admin – no healing needed.
              console.warn(
                "[loadProfile] Admin has no teams under own ID and no " +
                "inferrable club admin from memberships. User may not have " +
                "been properly linked to a club.",
                authId
              );
            }
          }
        }

        for (const teamDoc of adminTeamsSnap.docs) {
          if (!memberTeamIdsSet.has(teamDoc.id)) {
            await setDoc(doc(db, "team_members", `${teamDoc.id}_${authId}`), {
              teamId: teamDoc.id,
              userId: authId,
              joinedAt: new Date().toISOString(),
            });
            /* Atomically add admin to memberIds if not already present */
            await updateDoc(doc(db, "teams", teamDoc.id), {
              memberIds: arrayUnion(authId),
            });
            memberTeamIdsSet.add(teamDoc.id);
          }
          if (!teamId) {
            teamId = teamDoc.id;
          }
        }
      }

      /* Load all team documents for this user */
      const allTeamIds = [...memberTeamIdsSet];
      const teamSnaps = await Promise.all(
        allTeamIds.map((tid) => getDoc(doc(db, "teams", tid)))
      );
      const loadedTeams = teamSnaps
        .filter((s) => s.exists())
        .map((s) => toTeam(s.id, s.data() as DbTeam));

      setCurrentTeams(loadedTeams);

      const u: User = {
        ...toUser(authId, profileData, email),
        teamId,
        teamIds: allTeamIds,
      };

      setUser(u);

      if (teamId) {
        const primaryTeam = loadedTeams.find((t) => t.id === teamId) ?? null;
        setCurrentTeam(primaryTeam);
      } else {
        setCurrentTeam(null);
      }

      return u;
    },
    []
  );

  /* ── registerPushToken – request notification permission and store FCM token ── */
  const registerPushToken = useCallback(async (userId: string) => {
    if (typeof window === "undefined") return;
    // Only request permission if not already granted/denied
    if (Notification.permission === "denied") return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const messaging = await getClientMessaging();
      if (!messaging) return;

      // Register the service worker and pass it the Firebase config so it
      // can initialise FCM for background messages.
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn(
          "[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set. " +
          "Push notifications require a VAPID key from Firebase Console → " +
          "Project Settings → Cloud Messaging → Web Push certificates."
        );
        return;
      }

      let swReg: ServiceWorkerRegistration | undefined;
      try {
        await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );
        // Wait until the service worker is fully active, then send the
        // Firebase config so it can handle background push messages.
        swReg = await navigator.serviceWorker.ready;
        const config = {
          apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };
        // swReg.active is guaranteed non-null after ready resolves
        swReg.active!.postMessage({ type: "INIT_FCM", config });
      } catch {
        // Service worker registration failed (e.g. non-HTTPS origin) – skip
        return;
      }

      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
      if (!token) return;

      // Persist token in the user's profile so the server can look it up later
      await updateDoc(doc(db, "profiles", userId), { fcmToken: token });
    } catch {
      // Non-fatal – push notifications are a best-effort feature
    }
  }, []);

  /* ── Initialise session on mount ── */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Set loading=true before kicking off profile fetch so that any
        // login-page observer (loginAttempted + loading) waits until the
        // profile is actually loaded rather than seeing loading=false + user=null
        // immediately after signInWithEmailAndPassword resolves.
        setLoading(true);
        loadProfile(firebaseUser.uid, firebaseUser.email ?? "")
          .then((u) => {
            if (u) registerPushToken(u.id);
          })
          .catch((err) => {
            console.error("[AuthContext] loadProfile misslyckades:", err);
          })
          .finally(() => setLoading(false));
      } else {
        setUser(null);
        setCurrentTeam(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadProfile, registerPushToken]);

  /* ── Real-time profile sync ── */
  /* Keeps roles, adminId and other profile fields up to date for the current
   * user without requiring a page refresh.  This means that when an admin
   * promotes another logged-in user to admin (or changes any other role), the
   * promoted user's UI updates immediately – no logout/login needed. */
  useEffect(() => {
    if (!user?.id) return;
    const profileRef = doc(db, "profiles", user.id);
    const unsubscribe = onSnapshot(profileRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as DbProfile;
      // Derive roles using the same logic as toUser()
      const roles: UserRole[] =
        data.roles && data.roles.length > 0
          ? (data.roles as UserRole[])
          : [data.role as UserRole];
      setUser((prev) =>
        prev
          ? {
              ...prev,
              roles,
              adminId: data.adminId ?? null,
              clubName: data.clubName ?? prev.clubName,
              clubLogoUrl: data.clubLogoUrl ?? prev.clubLogoUrl,
              clubWebsiteUrl: data.clubWebsiteUrl ?? prev.clubWebsiteUrl,
              coachInviteCode: data.coachInviteCode ?? prev.coachInviteCode,
            }
          : prev
      );
    });
    return () => unsubscribe();
  // Only re-run when the user's Firebase UID changes (i.e. on login/logout).
  // setUser is a stable useState dispatcher so it doesn't need to be listed.
  // The updater form (prev => …) is used to avoid any stale-closure issue with
  // the user object inside the snapshot callback.
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    clubName?: string,
    sport?: SportId
  ): Promise<string | null> => {
    try {

    /* 1 ─ Validate invite codes before touching auth ────────── */
    let invitingAdminId: string | null = null;
    let invitingAdminClubName: string | null = null;
    let invitingAdminLogoUrl: string | undefined = undefined;
    let teamFromCode: { id: string; data: DbTeam } | null = null;

    if (role === "coach") {
      if (!inviteCode)
        return "Ange admin-inbjudningskoden för att registrera dig som coach.";
      const code = inviteCode.toUpperCase();
      const adminSnap = await getDocs(
        query(
          collection(db, "profiles"),
          where("coachInviteCode", "==", code),
          limit(1)
        )
      );
      if (adminSnap.empty)
        return "Ogiltig admin-inbjudningskod. Kontakta din föreningsadmin.";
      const adminDoc = adminSnap.docs[0];
      const adminData = adminDoc.data() as DbProfile;
      // Verify the profile is an admin using both the roles array and the legacy
      // role field so that profiles created or modified via either path are found.
      const isAdminProfile =
        (adminData.roles ?? []).includes("admin") || adminData.role === "admin";
      if (!isAdminProfile)
        return "Ogiltig admin-inbjudningskod. Kontakta din föreningsadmin.";
      invitingAdminId       = adminDoc.id;
      invitingAdminClubName = (adminData.clubName as string) ?? "";
      invitingAdminLogoUrl  = (adminData.clubLogoUrl as string | undefined) ?? undefined;
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

    /* Ensure the ID token is available to the Firestore SDK before any writes.
     * Without this there is a brief window right after account creation where
     * Firestore may see request.auth as null and deny the write. */
    await credential.user.getIdToken();

    /* 3–5 ─ Firestore writes – if anything fails here we delete the just-created
     * auth user so the caller can retry with the same e-mail address. */
    try {
      /* 3 ─ Create profile ─────────────────────────────────── */
      const newProfile: DbProfile = {
        name: name || "Okänd",
        role,
        roles: [role],
        email,
        clubName:        role === "admin"  ? (clubName  ?? null) : null,
        childName:       role === "parent" ? (childName ?? null) : null,
        coachInviteCode: role === "admin"  ? generateCode()      : null,
        sport:           sport ?? "basket",
        createdAt:       new Date().toISOString(),
        // Link non-admin users back to their admin so the admin's registry shows them
        adminId:         role === "admin"  ? null
                         : (invitingAdminId ?? teamFromCode?.data.adminId ?? null),
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
          clubLogoUrl:       invitingAdminLogoUrl ?? null,
          sport:             sport ?? "basket",
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
    } catch (firestoreErr) {
      /* Roll back: remove the auth user so the same e-mail can be used again. */
      try { await credential.user.delete(); } catch (deleteErr) {
        console.warn("[register] Could not delete auth user after Firestore failure:", deleteErr);
      }
      throw firestoreErr;
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
    setCurrentTeams([]);
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

    const newTeam = toTeam(teamId, teamData);

    const updatedUser: User = {
      ...user,
      /* Keep existing primary team; only set if the user had none yet */
      teamId: user.teamId ?? teamId,
      /* Add to all team memberships */
      teamIds: [...new Set([...user.teamIds, teamId])],
      ...(childName ? { childName } : {}),
    };
    setUser(updatedUser);

    /* Update cached teams list */
    setCurrentTeams((prev) => {
      const alreadyIn = prev.some((t) => t.id === teamId);
      return alreadyIn ? prev : [...prev, newTeam];
    });
    /* Set primary team if the user didn't have one */
    if (!currentTeam) {
      setCurrentTeam(newTeam);
    }

    return true;
  };

  /* ── getMyTeam (synchronous, cached) ── */
  const getMyTeam = (): Team | null => currentTeam;

  /* ── getMyTeams (synchronous, cached) – multi-group support ── */
  const getMyTeams = (): Team[] => currentTeams;

  /* ── getAllTeams (for admin page) ── */
  const getAllTeams = async (): Promise<Team[]> => {
    const snap = await getDocs(collection(db, "teams"));
    return snap.docs.map((d) => toTeam(d.id, d.data() as DbTeam));
  };

  /* ── createTeam (admin creates a new team) ── */
  const createTeam = async (
    teamName: string,
    ageGroup: string = ""
  ): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad för att skapa lag.";
    if (!user.roles.includes("admin")) return "Endast admins kan skapa lag.";
    try {
      // Co-admins create teams under the club's root admin so new teams appear
      // in the correct club and are visible to all club admins.
      const effectiveAdminId = user.adminId ?? user.id;

      // Co-admins may not have clubName/logo on their own profile (it lives on
      // the root admin's profile). Fall back to fetching it so new teams always
      // carry the correct club identity.
      let clubName = user.clubName ?? "";
      let clubLogoUrl: string | null = user.clubLogoUrl ?? null;
      if (user.adminId && (!clubName || !clubLogoUrl)) {
        const rootSnap = await getDoc(doc(db, "profiles", user.adminId));
        if (rootSnap.exists()) {
          const d = rootSnap.data() as DbProfile;
          if (!clubName) clubName = d.clubName ?? "";
          if (!clubLogoUrl) clubLogoUrl = d.clubLogoUrl ?? null;
        }
      }

      const newTeamId = crypto.randomUUID();
      const newTeam: DbTeam = {
        name: teamName,
        ageGroup,
        coachId: null,
        adminId: effectiveAdminId,
        clubName,
        clubLogoUrl,
        sport: user.sport ?? "basket",
        memberIds: [user.id],
        inviteCode: generateCode(),
        parentInviteCode: generateCode(),
        playerInviteCode: generateCode(),
      };
      await setDoc(doc(db, "teams", newTeamId), newTeam);
      await setDoc(doc(db, "team_members", `${newTeamId}_${user.id}`), {
        teamId: newTeamId,
        userId: user.id,
        joinedAt: new Date().toISOString(),
      });
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return translateFirebaseError(msg);
    }
  };

  /* ── updateClubLogo (admin uploads a club logo image) ── */
  const updateClubLogo = async (file: File): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad.";
    if (!user.roles.includes("admin")) return "Endast admins kan ladda upp klubblogga.";

    /* Validate file type – allow common image MIME types and gallery files
       that may report an empty type (e.g. HEIC on iOS). */
    const isImage =
      file.type.startsWith("image/") ||
      (!file.type && KNOWN_IMAGE_EXT_RE.test(file.name));
    if (!isImage) {
      return "Endast bildfiler (JPG, PNG, GIF, WebP) accepteras.";
    }
    /* Validate file size (max 5 MB) */
    if (file.size > 5 * 1024 * 1024) {
      return "Bilden är för stor. Max 5 MB tillåts.";
    }

    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const storageRef = ref(storage, `clubLogos/${user.id}/logo.${ext}`);

      /* Ensure content type is set – mobile gallery files can have an empty
         file.type (e.g. HEIC on iOS), which would fail Firebase Storage rules
         that require contentType.matches('image/.*'). */
      const contentType = file.type || EXT_TO_MIME[ext] || "image/jpeg";

      /* Wrap upload in a 30-second timeout to avoid infinite spinner */
      const uploadWithTimeout = Promise.race([
        uploadBytes(storageRef, file, { contentType }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Upload timeout after 30 s")), 30_000)
        ),
      ]);

      await uploadWithTimeout;
      const url = await getDownloadURL(storageRef);

      /* Save to admin's profile and propagate to all teams atomically */
      const teamsSnap = await getDocs(
        query(collection(db, "teams"), where("adminId", "==", user.adminId ?? user.id))
      );
      const logoBatch = writeBatch(db);
      logoBatch.update(doc(db, "profiles", user.id), { clubLogoUrl: url });
      teamsSnap.docs.forEach((d) => logoBatch.update(doc(db, "teams", d.id), { clubLogoUrl: url }));
      await logoBatch.commit();

      /* Update local state */
      setUser({ ...user, clubLogoUrl: url });
      if (currentTeam) {
        setCurrentTeam({ ...currentTeam, clubLogoUrl: url });
      }

      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("timeout")) return "Uppladdningen tog för lång tid. Kontrollera din internetanslutning.";
      return translateFirebaseError(msg) || "Kunde inte ladda upp loggan. Försök igen.";
    }
  };

  /* ── updateClubLogoUrl (admin sets logo via external URL) ── */
  const updateClubLogoUrl = async (url: string): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad.";
    if (!user.roles.includes("admin")) return "Endast admins kan ändra klubblogga.";

    const trimmed = url.trim();
    if (!trimmed) return "Ange en giltig URL.";
    if (!trimmed.startsWith("https://")) return "URL:en måste börja med https://.";
    try {
      new URL(trimmed);
    } catch {
      return "Ange en giltig URL (börja med https://).";
    }

    try {
      /* Save URL to admin's profile and propagate to all teams atomically */
      const teamsSnap = await getDocs(
        query(collection(db, "teams"), where("adminId", "==", user.adminId ?? user.id))
      );
      const logoBatch = writeBatch(db);
      logoBatch.update(doc(db, "profiles", user.id), { clubLogoUrl: trimmed });
      teamsSnap.docs.forEach((d) => logoBatch.update(doc(db, "teams", d.id), { clubLogoUrl: trimmed }));
      await logoBatch.commit();

      /* Update local state */
      setUser({ ...user, clubLogoUrl: trimmed });
      if (currentTeam) {
        setCurrentTeam({ ...currentTeam, clubLogoUrl: trimmed });
      }

      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return translateFirebaseError(msg) || "Kunde inte spara URL:en. Försök igen.";
    }
  };

  /* ── updateClubWebsiteUrl (admin sets club website URL for news) ── */
  const updateClubWebsiteUrl = async (url: string): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad.";
    if (!user.roles.includes("admin")) return "Endast admins kan ändra föreningens webbplats.";

    const trimmed = url.trim();
    if (!trimmed) return "Ange en giltig URL.";
    if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
      return "URL:en måste börja med http:// eller https://.";
    }
    try {
      new URL(trimmed);
    } catch {
      return "Ange en giltig URL.";
    }

    try {
      /* Save URL to admin's profile */
      await updateDoc(doc(db, "profiles", user.id), { clubWebsiteUrl: trimmed });

      /* Propagate to all teams belonging to this admin */
      const teamsSnap = await getDocs(
        query(collection(db, "teams"), where("adminId", "==", user.adminId ?? user.id))
      );
      await Promise.all(
        teamsSnap.docs.map((d) => updateDoc(doc(db, "teams", d.id), { clubWebsiteUrl: trimmed }))
      );

      /* Update local state */
      setUser({ ...user, clubWebsiteUrl: trimmed });
      if (currentTeam) {
        setCurrentTeam({ ...currentTeam, clubWebsiteUrl: trimmed });
      }

      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return translateFirebaseError(msg) || "Kunde inte spara URL:en. Försök igen.";
    }
  };

  /* ── updateAvatar (any user uploads a personal profile avatar) ── */
  const updateAvatar = async (file: File): Promise<string | null> => {
    if (!user) return "Du måste vara inloggad.";

    /* Validate file type – allow common image MIME types and gallery files
       that may report an empty type (e.g. HEIC on iOS). */
    const isImage =
      file.type.startsWith("image/") ||
      (!file.type && KNOWN_IMAGE_EXT_RE.test(file.name));
    if (!isImage) {
      return "Endast bildfiler (JPG, PNG, GIF, WebP) accepteras.";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "Bilden är för stor. Max 5 MB tillåts.";
    }

    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const storageRef = ref(storage, `avatars/${user.id}/avatar.${ext}`);

      /* Ensure content type is set – mobile gallery files can have an empty
         file.type (e.g. HEIC on iOS), which would fail Firebase Storage rules. */
      const contentType = file.type || EXT_TO_MIME[ext] || "image/jpeg";

      const uploadWithTimeout = Promise.race([
        uploadBytes(storageRef, file, { contentType }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Upload timeout after 30 seconds")), 30_000)
        ),
      ]);

      await uploadWithTimeout;
      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "profiles", user.id), { avatarUrl: url });
      setUser({ ...user, avatarUrl: url });

      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("timeout")) return "Uppladdningen tog för lång tid. Kontrollera din internetanslutning.";
      return translateFirebaseError(msg) || "Kunde inte ladda upp bilden. Försök igen.";
    }
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
        getMyTeams,
        getAllTeams,
        createTeam,
        updateClubLogo,
        updateClubLogoUrl,
        updateClubWebsiteUrl,
        updateAvatar,
        requestPushPermission: () => {
          if (!user) return Promise.resolve();
          return registerPushToken(user.id);
        },
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

