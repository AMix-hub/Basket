"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

/**
 * Returns the total count of unread messages (team chat + DMs)
 * for the currently logged-in user in their team.
 * Subscribes to Supabase Realtime for instant updates.
 */
export function useUnreadCount(): number {
  const { user, getMyTeam } = useAuth();
  const [count, setCount]   = useState(0);

  useEffect(() => {
    const team = getMyTeam();
    if (!user || !team) return;

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("team_id", team.id)
        .neq("sender_id", user.id)
        .not("read_by", "cs", `{${user.id}}`);
      setCount(c ?? 0);
    };

    fetchCount();

    /* Subscribe to new messages in this team */
    const channel = supabase
      .channel(`unread-${team.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `team_id=eq.${team.id}`,
        },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, getMyTeam]);

  return count;
}
