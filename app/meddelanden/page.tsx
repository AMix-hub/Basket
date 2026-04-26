"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth, User } from "../context/AuthContext";
import type { Team } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";

/* ─── Types ──────────────────────────────────────────────────── */
export interface Message {
  id: string;
  teamId: string;    // maps to team_id in DB
  senderId: string;  // maps to sender_id
  senderName: string;
  recipientId: string | null;
  text: string;
  sentAt: string;    // maps to sent_at
  readBy: string[];  // maps to read_by
}

/* ─── Helpers ────────────────────────────────────────────────── */
function formatTime(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("sv-SE", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function MeddelandenPage() {
  const { user } = useAuth();

  const [allUserTeams, setAllUserTeams]   = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId]   = useState<string | null>(null);
  const activeTeam = allUserTeams.find((t) => t.id === activeTeamId) ?? null;

  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [coachMessages, setCoachMessages] = useState<Message[]>([]);
  const [selected, setSelected]       = useState<"team" | "coaches" | string>("team");
  const [draft, setDraft]             = useState("");
  const [sendError, setSendError]     = useState<string | null>(null);
  const [queryError, setQueryError]   = useState<string | null>(null);
  const bottomRef                     = useRef<HTMLDivElement>(null);

  // Controls whether the thread panel is open (overview vs chat view)
  const [threadOpen, setThreadOpen] = useState(false);
  // The ID of the first unread message when the thread is opened
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);

  // Broadcast / utskick
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState<"alla" | "föräldrar" | "spelare">("alla");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  /* ── Load all teams the user belongs to ── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: memberships } = await supabase
        .from("team_members").select("team_id").eq("user_id", user.id);
      const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id);
      if (teamIds.length === 0) { setAllUserTeams([]); return; }

      const { data: teamRows } = await supabase.from("teams").select("*").in("id", teamIds);
      const teams: Team[] = (teamRows ?? []).map((t) => ({
        id: t.id, name: t.name, ageGroup: t.age_group,
        coachId: t.coach_id ?? "", adminId: t.admin_id,
        clubName: t.club_name ?? "",
        sport: (t.sport ?? "basket") as import("../../lib/sports").SportId,
        memberIds: t.member_ids ?? [],
        inviteCode: t.invite_code ?? "",
        parentInviteCode: t.parent_invite_code ?? "",
        playerInviteCode: t.player_invite_code ?? "",
      } as Team));
      setAllUserTeams(teams);
      setActiveTeamId((prev) => prev ?? (teams.length > 0 ? teams[0].id : null));
    })();
  }, [user?.id]);

  /* ── Load team members for the active team ── */
  useEffect(() => {
    if (!activeTeam || !user) return;
    setTeamMembers([]);
    (async () => {
      const { data: memberships } = await supabase
        .from("team_members").select("user_id").eq("team_id", activeTeam.id);
      const ids = (memberships ?? []).map((m: { user_id: string }) => m.user_id).filter((id) => id !== user.id);
      if (ids.length === 0) { setTeamMembers([]); return; }

      const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
      setTeamMembers(
        (profiles ?? []).map((p) => ({
          id: p.id, name: p.name, email: p.email ?? "",
          roles: p.roles?.length > 0 ? p.roles : [p.role],
          teamId: activeTeam.id,
          childName: p.child_name ?? undefined,
          createdAt: p.created_at,
        } as User))
      );
    })();
  }, [activeTeam?.id, user?.id]);

  /* ── Load + subscribe to messages for all user's teams ── */
  useEffect(() => {
    if (allUserTeams.length === 0) return;
    const teamIds = allUserTeams.map((t) => t.id);
    let mounted = true;

    const mapMsg = (m: Record<string, unknown>): Message => ({
      id: m.id as string, teamId: m.team_id as string,
      senderId: m.sender_id as string, senderName: m.sender_name as string,
      recipientId: (m.recipient_id as string | null) ?? null,
      text: m.text as string, sentAt: m.sent_at as string,
      readBy: (m.read_by as string[]) ?? [],
    });

    const load = () =>
      supabase.from("messages").select("*").in("team_id", teamIds)
        .then(({ data, error }) => {
          if (!mounted) return;
          if (error) { setQueryError("Kunde inte hämta meddelanden."); return; }
          setQueryError(null);
          setMessages((data ?? []).map(mapMsg).sort((a, b) => a.sentAt < b.sentAt ? -1 : 1));
        });

    load();
    const channels = teamIds.map((tid) =>
      supabase.channel(`messages:${tid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `team_id=eq.${tid}` }, load)
        .subscribe()
    );

    return () => { mounted = false; channels.forEach((c) => supabase.removeChannel(c)); };
  }, [allUserTeams.map((t) => t.id).join(",")]);

  /* ── Subscribe to coach channel ── */
  const isCoachOrAbove = user?.roles.some((r) => ["coach", "assistant", "admin", "co_admin"].includes(r)) ?? false;
  useEffect(() => {
    if (!user || !isCoachOrAbove) return;
    let mounted = true;

    const load = () =>
      supabase.from("coach_chat").select("*").order("sent_at", { ascending: true })
        .then(({ data }) => {
          if (!mounted) return;
          setCoachMessages(
            (data ?? []).map((m) => ({
              id: m.id, teamId: "coaches",
              senderId: m.sender_id, senderName: m.sender_name,
              recipientId: null, text: m.text,
              sentAt: m.sent_at, readBy: [],
            } as Message))
          );
        });

    load();
    const channel = supabase.channel("coach-chat-sub")
      .on("postgres_changes", { event: "*", schema: "public", table: "coach_chat" }, load)
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isCoachOrAbove]);

  /* ── Mark visible messages as read ── */
  useEffect(() => {
    if (!user || !activeTeam || !threadOpen || selected === "coaches") return;
    const toMark = messages.filter((m) => {
      if (m.teamId !== activeTeam.id) return false;
      const isInThread =
        selected === "team"
          ? m.recipientId === null
          : (m.senderId === user.id && m.recipientId === selected) ||
            (m.senderId === selected && m.recipientId === user.id);
      return isInThread && !m.readBy.includes(user.id);
    });
    if (toMark.length === 0) return;

    toMark.forEach(async (m) => {
      const newReadBy = [...m.readBy, user.id];
      await supabase.from("messages").update({ read_by: newReadBy }).eq("id", m.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, activeTeamId, messages.length, user?.id, threadOpen]);

  /* ── Mark coach-channel messages as read ── */
  useEffect(() => {
    if (!user || !threadOpen || selected !== "coaches") return;
    const toMark = coachMessages.filter((m) => !m.readBy.includes(user.id));
    if (toMark.length === 0) return;

    // coach_chat table has no read_by column — skip marking for now
    void toMark;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, coachMessages.length, user?.id, threadOpen]);

  /* ── Capture first unread ID when opening a thread ── */
  const openThread = useCallback((teamId: string, threadId: "team" | string) => {
    setActiveTeamId(teamId);
    setSelected(threadId);
    setThreadOpen(true);
    // Find the first unread message in this thread to scroll to later
    setFirstUnreadId(null); // will be updated after messages load
  }, []);

  /* ── Update firstUnreadId when thread opens or messages update ── */
  useEffect(() => {
    if (!threadOpen || !user) return;
    let threadMsgs: Message[];
    if (selected === "coaches") {
      threadMsgs = coachMessages;
    } else {
      if (!activeTeam) return;
      threadMsgs = messages.filter((m) => {
        if (m.teamId !== activeTeam.id) return false;
        if (selected === "team") return m.recipientId === null;
        return (
          (m.senderId === user.id && m.recipientId === selected) ||
          (m.senderId === selected && m.recipientId === user.id)
        );
      });
    }
    const firstUnread = threadMsgs.find(
      (m) => !m.readBy.includes(user.id) && m.senderId !== user.id
    );
    setFirstUnreadId((prev) => prev ?? (firstUnread?.id ?? null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadOpen, selected, activeTeamId, messages.length, coachMessages.length]);

  /* ── Scroll to first unread when thread opens ── */
  useEffect(() => {
    if (!threadOpen || !firstUnreadId) return;
    // Small delay to let the DOM render
    const timer = setTimeout(() => {
      firstUnreadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [threadOpen, firstUnreadId]);

  /* ── Auto-scroll to bottom when no unread (or after reading) ── */
  useEffect(() => {
    if (!threadOpen || firstUnreadId) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, coachMessages, selected, threadOpen, firstUnreadId]);

  /* ── Thread messages ── */
  const threadMessages: Message[] = selected === "coaches"
    ? coachMessages
    : messages.filter((m) => {
        if (m.teamId !== activeTeam?.id) return false;
        if (selected === "team") return m.recipientId === null;
        return (
          (m.senderId === user?.id && m.recipientId === selected) ||
          (m.senderId === selected && m.recipientId === user?.id)
        );
      });

  /* ── Unread counts ── */
  const unreadForTeam = (teamId: string) =>
    messages.filter(
      (m) =>
        m.teamId === teamId &&
        m.recipientId === null &&
        m.senderId !== user?.id &&
        !m.readBy.includes(user?.id ?? "")
    ).length;

  const unreadDM = (memberId: string) =>
    messages.filter(
      (m) => m.senderId === memberId && m.recipientId === user?.id && !m.readBy.includes(user?.id ?? "")
    ).length;

  const totalUnreadForTeam = (teamId: string) => {
    const teamUnread = unreadForTeam(teamId);
    const dmUnread = messages.filter(
      (m) =>
        m.teamId === teamId &&
        m.recipientId === user?.id &&
        m.senderId !== user?.id &&
        !m.readBy.includes(user?.id ?? "")
    ).length;
    return teamUnread + dmUnread;
  };

  const unreadCoach = coachMessages.filter(
    (m) => m.senderId !== user?.id && !m.readBy.includes(user?.id ?? "")
  ).length;

  /* ── Send broadcast ── */
  const sendBroadcast = async () => {
    if (!broadcastText.trim() || !user || !activeTeam) return;
    setSendingBroadcast(true);
    const targetLabel = broadcastTarget === "alla" ? "Alla" : broadcastTarget === "föräldrar" ? "Föräldrar" : "Spelare";
    const text = `📢 *Utskick till ${targetLabel}*\n\n${broadcastText.trim()}`;
    try {
      await supabase.from("messages").insert({
        team_id: activeTeam.id, sender_id: user.id, sender_name: user.name,
        recipient_id: null, text,
        sent_at: new Date().toISOString(), read_by: [user.id],
      });
      setBroadcastText(""); setShowBroadcast(false);
    } catch {
      setSendError("Utskicket kunde inte skickas.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  /* ── Send message ── */
  const sendMessage = async () => {
    if (!draft.trim() || !user) return;
    if (selected !== "coaches" && !activeTeam) return;
    try {
      if (selected === "coaches") {
        await supabase.from("coach_chat").insert({
          sender_id: user.id, sender_name: user.name,
          text: draft.trim(), sent_at: new Date().toISOString(),
        });
      } else if (activeTeam) {
        await supabase.from("messages").insert({
          team_id: activeTeam.id, sender_id: user.id, sender_name: user.name,
          recipient_id: selected === "team" ? null : selected,
          text: draft.trim(), sent_at: new Date().toISOString(),
          read_by: [user.id],
        });
      }
      setDraft("");
      setSendError(null);
    } catch (err) {
      console.error("Fel vid skickande av meddelande:", err);
      setSendError("Meddelandet kunde inte skickas. Försök igen.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectedMember = selected !== "team" && selected !== "coaches"
    ? teamMembers.find((m) => m.id === selected) ?? null
    : null;

  const threadTitle =
    selected === "coaches"
      ? "🎽 Coach-kanalen"
      : selected === "team"
      ? `💬 Lagchatt – ${activeTeam?.name ?? "Laget"}`
      : `✉️ ${selectedMember?.name ?? "Direktmeddelande"}`;

  /* ── Not logged in ── */
  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">💬</p>
          <h1 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Logga in för att använda chatten</h1>
          <div className="flex gap-3 justify-center mt-5">
            <Link href="/login" className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600">Logga in</Link>
            <Link href="/registrera" className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700/50">Registrera</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── No team ── */
  if (user && allUserTeams.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">💬</p>
          <h1 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Du är inte med i något lag ännu</h1>
          <Link href="/lag" className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 mt-5 inline-block">Gå till Laget</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💬</span>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Meddelanden</h1>
          </div>
          {isCoachOrAbove && (
            <button
              onClick={() => setShowBroadcast((v) => !v)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {showBroadcast ? "Avbryt" : "📢 Skicka utskick"}
            </button>
          )}
        </div>
        <p className="text-slate-500 text-sm">Chatta med laget eller skicka direktmeddelanden.</p>
      </div>

      {/* ── Broadcast compose ── */}
      {showBroadcast && isCoachOrAbove && (
        <div className="bg-white dark:bg-slate-800 border border-orange-300 dark:border-orange-500/30 rounded-2xl p-4 mb-5">
          <p className="text-sm font-bold text-orange-300 mb-3">📢 Nytt utskick</p>
          <div className="flex gap-2 mb-3">
            {(["alla", "föräldrar", "spelare"] as const).map((t) => (
              <button key={t} onClick={() => setBroadcastTarget(t)}
                className={`px-3 py-1 text-xs font-semibold rounded-full capitalize transition-colors ${
                  broadcastTarget === t ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                }`}>
                {t === "alla" ? "Alla" : t === "föräldrar" ? "Föräldrar" : "Spelare"}
              </button>
            ))}
          </div>
          <textarea
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            rows={3}
            placeholder={`Skriv ett meddelande till ${broadcastTarget === "alla" ? "hela laget" : broadcastTarget}…`}
            className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none mb-2"
          />
          <div className="flex gap-2">
            <button onClick={sendBroadcast} disabled={sendingBroadcast || !broadcastText.trim() || !activeTeam}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {sendingBroadcast ? "Skickar…" : "Skicka utskick"}
            </button>
            <button onClick={() => { setShowBroadcast(false); setBroadcastText(""); }}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors">
              Avbryt
            </button>
          </div>
          {!activeTeam && (
            <p className="text-xs text-amber-400 mt-2">Välj ett lag i sidebaren innan du skickar utskick.</p>
          )}
        </div>
      )}

      <div
        className="flex flex-col gap-3 md:flex-row md:gap-4"
        style={{ minHeight: 380 }}
      >
        {/* Sidebar – always visible on desktop, hidden when thread is open on mobile */}
        <div className={`${threadOpen ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col gap-1 md:w-56 md:max-h-none overflow-y-auto`}
          style={{ maxHeight: threadOpen ? undefined : "calc(100vh - 310px)" }}
        >
          {allUserTeams.length > 1 && (
            <p className="text-xs text-slate-400 font-semibold px-1 pb-0.5 uppercase tracking-wide">
              Lagchattar
            </p>
          )}
          {allUserTeams.map((t) => {
            const isActiveTeamChat = activeTeamId === t.id && selected === "team" && threadOpen;
            const totalUnread = totalUnreadForTeam(t.id);
            const teamUnread = unreadForTeam(t.id);
            return (
              <button
                key={t.id}
                onClick={() => openThread(t.id, "team")}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full ${
                  isActiveTeamChat ? "bg-orange-500 text-white" : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/30"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span>💬</span>
                  <span className="truncate">{allUserTeams.length > 1 ? t.name : "Lagchatt"}</span>
                </span>
                {totalUnread > 0 && !isActiveTeamChat && (
                  <span className="ml-1 shrink-0 text-xs font-bold bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
                {teamUnread > 0 && isActiveTeamChat && (
                  <span className="ml-1 shrink-0 text-xs font-bold bg-white/30 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    {teamUnread > 9 ? "9+" : teamUnread}
                  </span>
                )}
              </button>
            );
          })}

          {teamMembers.length > 0 && activeTeam && (
            <p className="text-xs text-slate-400 font-semibold px-1 pt-2 pb-0.5 uppercase tracking-wide">
              Direktmeddelanden
            </p>
          )}

          {activeTeam && teamMembers.map((m) => {
            const count = unreadDM(m.id);
            const icon  = m.roles.includes("coach") ? "🎽" : m.roles.includes("parent") ? "👪" : m.roles.includes("admin") ? "🏛" : "👋";
            const isActive = activeTeamId === activeTeam.id && selected === m.id && threadOpen;
            return (
              <button
                key={m.id}
                onClick={() => openThread(activeTeam.id, m.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full ${
                  isActive ? "bg-orange-500 text-white" : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/30"
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0">{icon}</span>
                  <span className="truncate">{m.name}</span>
                </span>
                {count > 0 && !isActive && (
                  <span className="ml-1 shrink-0 text-xs font-bold bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </button>
            );
          })}

          {teamMembers.length === 0 && activeTeam && (
            <p className="text-xs text-slate-400 px-2 pt-2">Inga andra lagmedlemmar ännu.</p>
          )}

          {!activeTeam && (
            <p className="text-xs text-slate-400 px-2 pt-2">Laddar lag…</p>
          )}

          {isCoachOrAbove && (
            <>
              <p className="text-xs text-slate-400 font-semibold px-1 pt-2 pb-0.5 uppercase tracking-wide">
                Coach-kanalen
              </p>
              <button
                onClick={() => {
                  setSelected("coaches");
                  setThreadOpen(true);
                  setFirstUnreadId(null);
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full ${
                  selected === "coaches" && threadOpen
                    ? "bg-orange-500 text-white"
                    : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/30"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span>🎽</span>
                  <span className="truncate">Alla coacher</span>
                </span>
                {unreadCoach > 0 && !(selected === "coaches" && threadOpen) && (
                  <span className="ml-1 shrink-0 text-xs font-bold bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCoach > 9 ? "9+" : unreadCoach}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* Thread panel – shown when threadOpen is true */}
        {threadOpen ? (
          <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden"
            style={{ minHeight: "calc(100vh - 310px)", maxHeight: "calc(100vh - 200px)" }}
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 shrink-0 flex items-center gap-2">
              {/* Back button on mobile */}
              <button
                onClick={() => {
                  setThreadOpen(false);
                  setFirstUnreadId(null);
                }}
                className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700/30 transition-colors text-slate-400"
                aria-label="Tillbaka"
              >
                ‹
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{threadTitle}</p>
                {selected === "team" && (
                  <p className="text-xs text-slate-400 mt-0.5">Alla i {activeTeam?.name ?? "laget"} ser dessa meddelanden</p>
                )}
                {selected === "coaches" && (
                  <p className="text-xs text-slate-400 mt-0.5">Endast coacher, assistenter och administratörer</p>
                )}
              </div>
            </div>

            {queryError && (
              <div className="mx-4 mt-3 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-xl text-xs text-red-400">
                {queryError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {threadMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                  <span className="text-4xl">💬</span>
                  <p>Inga meddelanden ännu. Skriv det första!</p>
                </div>
              ) : (
                threadMessages.map((m, idx) => {
                  const isOwn = m.senderId === user.id;
                  const isFirstUnread = m.id === firstUnreadId;
                  // Show separator before first unread message (if there are older messages before it)
                  const showSeparator = isFirstUnread && idx > 0;
                  return (
                    <div key={m.id}>
                      {showSeparator && (
                        <div className="flex items-center gap-2 my-3">
                          <div className="flex-1 h-px bg-blue-200" />
                          <span className="text-xs text-blue-500 font-semibold shrink-0 px-2">
                            Nya meddelanden
                          </span>
                          <div className="flex-1 h-px bg-blue-200" />
                        </div>
                      )}
                      <div
                        ref={isFirstUnread ? firstUnreadRef : undefined}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
                          {!isOwn && <span className="text-xs text-slate-500 font-medium px-1">{m.senderName}</span>}
                          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                            isOwn ? "bg-orange-500 text-white rounded-br-sm" : "bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-sm"
                          }`}>
                            {m.text}
                          </div>
                          <span className={`text-xs text-slate-400 px-1 ${isOwn ? "text-right" : "text-left"}`}>
                            {formatTime(m.sentAt)}
                            {isOwn && selected !== "team" && (
                              <span className="ml-1">{m.readBy.length > 1 ? "✓✓" : "✓"}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 shrink-0">
              {sendError && (
                <div className="mb-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-xl text-xs text-red-400">
                  {sendError}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 112)}px`; } }}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selected === "coaches"
                      ? "Skriv till coacherna… (Enter för att skicka)"
                      : selected === "team"
                      ? "Skriv till laget… (Enter för att skicka)"
                      : `Skriv till ${selectedMember?.name ?? ""}… (Enter för att skicka)`
                  }
                  rows={1}
                  className="flex-1 px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-gray-300 dark:border-slate-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 overflow-auto"
                />
                <button
                  onClick={sendMessage}
                  disabled={!draft.trim() || (selected !== "coaches" && !activeTeam)}
                  className="shrink-0 w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
                  aria-label="Skicka"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 rotate-90">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">Shift+Enter för ny rad</p>
            </div>
          </div>
        ) : (
          /* Overview prompt when no thread is selected */
          <div className="hidden md:flex flex-1 items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 text-slate-400 text-sm flex-col gap-2">
            <span className="text-4xl">💬</span>
            <p>Välj en grupp eller konversation för att öppna chatten</p>
          </div>
        )}
      </div>
    </div>
  );
}
