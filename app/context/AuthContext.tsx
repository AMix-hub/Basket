"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

export type UserRole = "admin" | "coach" | "assistant" | "parent";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  teamId: string | null;
  childName?: string; // for parents – the name of their child on the team
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  coachId: string;
  memberIds: string[];
  inviteCode: string;       // staff code (coach shares with assistants)
  parentInviteCode: string; // parent code (coach shares with parents)
}

interface AuthContextType {
  user: User | null;
  teams: Team[];
  login: (email: string, password: string) => boolean;
  logout: () => void;
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    teamName?: string,
    ageGroup?: string,
    inviteCode?: string,
    childName?: string
  ) => boolean;
  joinTeam: (inviteCode: string, childName?: string) => boolean;
  getMyTeam: () => Team | null;
  getAllTeams: () => Team[];
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_KEY = "basketball_users";
const TEAMS_KEY = "basketball_teams";
const CURRENT_USER_KEY = "basketball_current_user";

/* Simple deterministic hash – client-side only, not a security measure */
function simpleHash(str: string): string {
  return btoa(encodeURIComponent(str));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(CURRENT_USER_KEY);
    return saved ? (JSON.parse(saved) as User) : null;
  });
  const [teams, setTeams] = useState<Team[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(TEAMS_KEY);
    return saved ? (JSON.parse(saved) as Team[]) : [];
  });

  const login = (email: string, password: string): boolean => {
    const allUsers: User[] = JSON.parse(
      localStorage.getItem(USERS_KEY) || "[]"
    );
    const found = allUsers.find(
      (u) => u.email === email && u.passwordHash === simpleHash(password)
    );
    if (found) {
      setUser(found);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(found));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
  };

  const register = (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    teamName?: string,
    ageGroup?: string,
    inviteCode?: string,
    childName?: string
  ): boolean => {
    const allUsers: User[] = JSON.parse(
      localStorage.getItem(USERS_KEY) || "[]"
    );
    if (allUsers.find((u) => u.email === email)) return false;

    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: simpleHash(password),
      role,
      teamId: null,
      ...(childName ? { childName } : {}),
      createdAt: new Date().toISOString(),
    };

    let allTeams: Team[] = JSON.parse(
      localStorage.getItem(TEAMS_KEY) || "[]"
    );

    if (role === "coach" && teamName) {
      const newTeam: Team = {
        id: crypto.randomUUID(),
        name: teamName,
        ageGroup: ageGroup || "",
        coachId: newUser.id,
        memberIds: [newUser.id],
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        parentInviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      };
      newUser.teamId = newTeam.id;
      allTeams = [...allTeams, newTeam];
      localStorage.setItem(TEAMS_KEY, JSON.stringify(allTeams));
      setTeams(allTeams);
    }

    const updatedUsers = [...allUsers, newUser];
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
    setUser(newUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));

    // Auto-join team for assistant/parent using invite code
    if ((role === "assistant" || role === "parent") && inviteCode) {
      const freshUser = { ...newUser };
      const code = inviteCode.toUpperCase();
      const team = allTeams.find(
        (t) => t.inviteCode === code || t.parentInviteCode === code
      );
      if (team) {
        const updatedTeams = allTeams.map((t) =>
          t.id === team.id
            ? { ...t, memberIds: [...new Set([...t.memberIds, freshUser.id])] }
            : t
        );
        localStorage.setItem(TEAMS_KEY, JSON.stringify(updatedTeams));
        setTeams(updatedTeams);
        const joinedUser = { ...freshUser, teamId: team.id };
        const finalUsers = updatedUsers.map((u) =>
          u.id === joinedUser.id ? joinedUser : u
        );
        localStorage.setItem(USERS_KEY, JSON.stringify(finalUsers));
        setUser(joinedUser);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(joinedUser));
      }
    }

    return true;
  };

  const joinTeam = (inviteCode: string, childName?: string): boolean => {
    if (!user) return false;
    const allTeams: Team[] = JSON.parse(
      localStorage.getItem(TEAMS_KEY) || "[]"
    );
    const code = inviteCode.toUpperCase();
    const team = allTeams.find(
      (t) => t.inviteCode === code || t.parentInviteCode === code
    );
    if (!team) return false;

    const updatedTeams = allTeams.map((t) =>
      t.id === team.id
        ? { ...t, memberIds: [...new Set([...t.memberIds, user.id])] }
        : t
    );
    localStorage.setItem(TEAMS_KEY, JSON.stringify(updatedTeams));
    setTeams(updatedTeams);

    const allUsers: User[] = JSON.parse(
      localStorage.getItem(USERS_KEY) || "[]"
    );
    const updatedUser: User = {
      ...user,
      teamId: team.id,
      ...(childName ? { childName } : {}),
    };
    const updatedUsers = allUsers.map((u) =>
      u.id === user.id ? updatedUser : u
    );
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
    setUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    return true;
  };

  const getMyTeam = (): Team | null => {
    if (!user?.teamId) return null;
    const allTeams: Team[] = JSON.parse(
      localStorage.getItem(TEAMS_KEY) || "[]"
    );
    return allTeams.find((t) => t.id === user.teamId) ?? null;
  };

  const getAllTeams = (): Team[] => {
    return JSON.parse(localStorage.getItem(TEAMS_KEY) || "[]");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        teams,
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
