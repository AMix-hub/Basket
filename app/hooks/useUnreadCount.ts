"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";

export function useUnreadCount(): number {
  const { user, getMyTeam } = useAuth();
  const [count, setCount]      = useState(0);
  const [coachCount, setCoachCount] = useState(0);

  useEffect(() => {
    const team = getMyTeam();
    if (!user || !team) return;

    let mounted = true;

    // Initial fetch
    supabase
      .from("messages")
      .select("id, sender_id, read_by")
      .eq("team_id", team.id)
      .then(({ data }) => {
        if (!mounted) return;
        const unread = (data ?? []).filter(
          (m) => m.sender_id !== user.id && !(m.read_by as string[] ?? []).includes(user.id)
        ).length;
        setCount(unread);
      });

    // Real-time updates
    const channel = supabase
      .channel(`unread-messages:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `team_id=eq.${team.id}` }, () => {
        supabase
          .from("messages")
          .select("id, sender_id, read_by")
          .eq("team_id", team.id)
          .then(({ data }) => {
            if (!mounted) return;
            const unread = (data ?? []).filter(
              (m) => m.sender_id !== user.id && !(m.read_by as string[] ?? []).includes(user.id)
            ).length;
            setCount(unread);
          });
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, getMyTeam]);

  useEffect(() => {
    if (!user) return;
    const isCoachOrAbove = user.roles.some((r) => ["coach", "assistant", "admin", "co_admin"].includes(r));
    if (!isCoachOrAbove) return;

    let mounted = true;

    supabase.from("coach_chat").select("id, sender_id").then(({ data }) => {
      if (!mounted) return;
      setCoachCount((data ?? []).filter((m) => m.sender_id !== user.id).length);
    });

    const channel = supabase
      .channel("unread-coach-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "coach_chat" }, () => {
        supabase.from("coach_chat").select("id, sender_id").then(({ data }) => {
          if (!mounted) return;
          setCoachCount((data ?? []).filter((m) => m.sender_id !== user.id).length);
        });
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return count + coachCount;
}
