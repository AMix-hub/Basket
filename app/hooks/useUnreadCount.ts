"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import type { Message } from "../meddelanden/page";

const MESSAGES_KEY = "basketball_messages";

function computeUnread(userId: string, teamId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(MESSAGES_KEY);
  const all: Message[] = raw ? JSON.parse(raw) : [];
  return all.filter(
    (m) =>
      m.teamId === teamId &&
      m.senderId !== userId &&
      !m.readBy.includes(userId)
  ).length;
}

/**
 * Returns the total count of unread messages (team chat + DMs)
 * for the currently logged-in user in their team.
 * Computes on mount and polls every 4 seconds.
 */
export function useUnreadCount(): number {
  const { user, getMyTeam } = useAuth();

  const [count, setCount] = useState(() => {
    if (typeof window === "undefined" || !user) return 0;
    const team = getMyTeam();
    if (!team) return 0;
    return computeUnread(user.id, team.id);
  });

  useEffect(() => {
    if (!user) return;
    const team = getMyTeam();
    if (!team) return;

    const id = setInterval(() => {
      setCount(computeUnread(user.id, team.id));
    }, 4000);
    return () => clearInterval(id);
  }, [user, getMyTeam]);

  return count;
}
