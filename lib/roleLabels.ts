import type { UserRole } from "../app/context/AuthContext";

export const roleLabel: Record<UserRole, string> = {
  admin: "🏛 Admin",
  coach: "🎽 Coach",
  assistant: "👋 Assistent",
  parent: "👪 Förälder",
  player: "🏃 Spelare",
};
