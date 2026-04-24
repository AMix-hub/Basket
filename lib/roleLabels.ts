import type { UserRole } from "../app/context/AuthContext";

export const roleLabel: Record<UserRole, string> = {
  admin: "🏛 Admin",
  co_admin: "🏛 Medadmin",
  coach: "🎽 Coach",
  assistant: "👋 Assistent",
  parent: "👪 Förälder",
  player: "🏃 Spelare",
};

/** Returns an emoji representing the most significant role from the given list. */
export function roleEmoji(roles: string[]): string {
  if (roles.includes("admin"))  return "🏛";
  if (roles.includes("coach"))  return "🎽";
  if (roles.includes("parent")) return "👪";
  if (roles.includes("player")) return "🏃";
  return "👋";
}
