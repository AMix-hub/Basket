"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type UserRole = "admin" | "coach" | "assistant";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  teamId: string | null;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  coachId: string;
  memberIds: string[];
  inviteCode: string;
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
    ageGroup?: string
  ) => boolean;
  joinTeam: (inviteCode: string) => boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const savedTeams = localStorage.getItem(TEAMS_KEY);
    if (savedTeams) setTeams(JSON.parse(savedTeams));
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

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
    ageGroup?: string
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
        inviteCode: Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase(),
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
    return true;
  };

  const joinTeam = (inviteCode: string): boolean => {
    if (!user) return false;
    const allTeams: Team[] = JSON.parse(
      localStorage.getItem(TEAMS_KEY) || "[]"
    );
    const team = allTeams.find(
      (t) => t.inviteCode === inviteCode.toUpperCase()
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
    const updatedUser = { ...user, teamId: team.id };
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
