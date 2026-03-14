"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth, User } from "../context/AuthContext";
import type { Team } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

/* ─── Types ──────────────────────────────────────────────────── */
export interface Message {
  id: string;
  teamId: string;
  senderId: string;
  senderName: string;
  /** null → team chat; userId string → direct message */
  recipientId: string | null;
  text: string;
  sentAt: string;
  /** IDs of users who have read this message */
  readBy: string[];
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
  const [selected, setSelected]       = useState<"team" | string>("team");
  const [draft, setDraft]             = useState("");
  const [sendError, setSendError]     = useState<string | null>(null);
  const [queryError, setQueryError]   = useState<string | null>(null);
  const bottomRef                     = useRef<HTMLDivElement>(null);

  // Controls whether the thread panel is open (overview vs chat view)
  const [threadOpen, setThreadOpen] = useState(false);
  // The ID of the first unread message when the thread is opened
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);

  /* ── Load all teams the user belongs to ── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const memberSnap = await getDocs(
        query(collection(db, "team_members"), where("userId", "==", user.id))
      );
      const teamIds = memberSnap.docs.map((d) => d.data().teamId as string);
      if (teamIds.length === 0) { setAllUserTeams([]); return; }

      const teamPromises = teamIds.map((id) => getDoc(doc(db, "teams", id)));
      const teamSnaps = await Promise.all(teamPromises);
      const teams: Team[] = teamSnaps
        .filter((s) => s.exists())
        .map((s) => {
          const t = s.data()!;
          return {
            id: s.id,
            name: t.name as string,
            ageGroup: t.ageGroup as string,
            coachId: (t.coachId as string) ?? "",
            adminId: t.adminId as string,
            clubName: (t.clubName as string) ?? "",
            sport: ((t.sport as string) ?? "basket") as import("../../lib/sports").SportId,
            memberIds: (t.memberIds as string[]) ?? [],
            inviteCode: (t.inviteCode as string) ?? "",
            parentInviteCode: (t.parentInviteCode as string) ?? "",
            playerInviteCode: (t.playerInviteCode as string) ?? "",
          } as Team;
        });
      setAllUserTeams(teams);
      setActiveTeamId((prev) => prev ?? (teams.length > 0 ? teams[0].id : null));
    })();
  }, [user]);

  /* ── Load team members for the active team ── */
  useEffect(() => {
    if (!activeTeam || !user) return;
    setTeamMembers([]);
    (async () => {
      const memberSnap = await getDocs(
        query(collection(db, "team_members"), where("teamId", "==", activeTeam.id))
      );

      const ids = memberSnap.docs
        .map((d) => d.data().userId as string)
        .filter((id) => id !== user.id);

      if (ids.length === 0) { setTeamMembers([]); return; }

      const profilePromises = ids.map((id) => getDoc(doc(db, "profiles", id)));
      const profileSnaps = await Promise.all(profilePromises);

      setTeamMembers(
        profileSnaps
          .filter((s) => s.exists())
          .map((s) => {
            const p = s.data()!;
            return {
              id: s.id,
              name: p.name as string,
              email: "",
              roles:
                p.roles && (p.roles as string[]).length > 0
                  ? (p.roles as string[])
                  : [p.role as string],
              teamId: activeTeam.id,
              childName: p.childName as string | undefined,
              createdAt: "",
            } as User;
          })
      );
    })();
  }, [activeTeam, user]);

  /* ── Load + subscribe to messages for all user's teams ── */
  useEffect(() => {
    if (allUserTeams.length === 0) return;

    const teamIds = allUserTeams.map((t) => t.id).slice(0, 30);
    const q = teamIds.length === 1
      ? query(collection(db, "messages"), where("teamId", "==", teamIds[0]))
      : query(collection(db, "messages"), where("teamId", "in", teamIds));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setQueryError(null);
        setMessages(
          snap.docs
            .map((d) => {
              const m = d.data();
              return {
                id:          d.id,
                teamId:      m.teamId as string,
                senderId:    m.senderId as string,
                senderName:  m.senderName as string,
                recipientId: (m.recipientId as string | null) ?? null,
                text:        m.text as string,
                sentAt:      m.sentAt as string,
                readBy:      (m.readBy as string[]) ?? [],
              } as Message;
            })
            .sort((a, b) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : 0))
        );
      },
      (err) => {
        console.error("Fel vid hämtning av meddelanden:", err);
        setQueryError("Kunde inte hämta meddelanden. Försök igen.");
      }
    );

    return () => unsubscribe();
  }, [allUserTeams]);

  /* ── Mark visible messages as read ── */
  useEffect(() => {
    if (!user || !activeTeam || !threadOpen) return;
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
      await updateDoc(doc(db, "messages", m.id), { readBy: newReadBy });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, activeTeamId, messages.length, user?.id, threadOpen]);

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
    if (!threadOpen || !user || !activeTeam) return;
    const threadMsgs = messages.filter((m) => {
      if (m.teamId !== activeTeam.id) return false;
      if (selected === "team") return m.recipientId === null;
      return (
        (m.senderId === user.id && m.recipientId === selected) ||
        (m.senderId === selected && m.recipientId === user.id)
      );
    });
    const firstUnread = threadMsgs.find(
      (m) => !m.readBy.includes(user.id) && m.senderId !== user.id
    );
    setFirstUnreadId((prev) => prev ?? (firstUnread?.id ?? null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadOpen, selected, activeTeamId, messages.length]);

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
  }, [messages, selected, threadOpen, firstUnreadId]);

  /* ── Thread messages (scoped to active team) ── */
  const threadMessages = messages.filter((m) => {
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

  /* ── Send message ── */
  const sendMessage = async () => {
    if (!draft.trim() || !user || !activeTeam) return;
    const msg = {
      teamId:      activeTeam.id,
      senderId:    user.id,
      senderName:  user.name,
      recipientId: selected === "team" ? null : selected,
      text:        draft.trim(),
      sentAt:      new Date().toISOString(),
      readBy:      [user.id],
    };
    try {
      await addDoc(collection(db, "messages"), msg);
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

  const selectedMember = selected !== "team"
    ? teamMembers.find((m) => m.id === selected) ?? null
    : null;

  const threadTitle =
    selected === "team"
      ? `💬 Lagchatt – ${activeTeam?.name ?? "Laget"}`
      : `✉️ ${selectedMember?.name ?? "Direktmeddelande"}`;

  /* ── Not logged in ── */
  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">💬</p>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Logga in för att använda chatten</h1>
          <div className="flex gap-3 justify-center mt-5">
            <Link href="/login" className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600">Logga in</Link>
            <Link href="/registrera" className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200">Registrera</Link>
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
          <h1 className="text-xl font-bold text-slate-800 mb-2">Du är inte med i något lag ännu</h1>
          <Link href="/lag" className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 mt-5 inline-block">Gå till Laget</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">💬</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Meddelanden</h1>
        </div>
        <p className="text-slate-500 text-sm">Chatta med laget eller skicka direktmeddelanden.</p>
      </div>

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
                  isActiveTeamChat ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span>💬</span>
                  <span className="truncate">{allUserTeams.length > 1 ? t.name : "Lagchatt"}</span>
                </span>
                {totalUnread > 0 && !isActiveTeamChat && (
                  <span className="ml-1 shrink-0 text-xs font-bold bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
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
                  isActive ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0">{icon}</span>
                  <span className="truncate">{m.name}</span>
                </span>
                {count > 0 && !isActive && (
                  <span className="ml-1 shrink-0 text-xs font-bold bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
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
        </div>

        {/* Thread panel – shown when threadOpen is true */}
        {threadOpen ? (
          <div className="flex-1 min-w-0 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            style={{ minHeight: "calc(100vh - 310px)", maxHeight: "calc(100vh - 200px)" }}
          >
            <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center gap-2">
              {/* Back button on mobile */}
              <button
                onClick={() => {
                  setThreadOpen(false);
                  setFirstUnreadId(null);
                }}
                className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                aria-label="Tillbaka"
              >
                ‹
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm truncate">{threadTitle}</p>
                {selected === "team" && (
                  <p className="text-xs text-slate-400 mt-0.5">Alla i {activeTeam?.name ?? "laget"} ser dessa meddelanden</p>
                )}
              </div>
            </div>

            {queryError && (
              <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
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
                            isOwn ? "bg-orange-500 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"
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

            <div className="px-4 py-3 border-t border-slate-100 shrink-0">
              {sendError && (
                <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
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
                    selected === "team"
                      ? "Skriv till laget… (Enter för att skicka)"
                      : `Skriv till ${selectedMember?.name ?? ""}… (Enter för att skicka)`
                  }
                  rows={1}
                  className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 overflow-auto"
                />
                <button
                  onClick={sendMessage}
                  disabled={!draft.trim() || !activeTeam}
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
          <div className="hidden md:flex flex-1 items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400 text-sm flex-col gap-2">
            <span className="text-4xl">💬</span>
            <p>Välj en grupp eller konversation för att öppna chatten</p>
          </div>
        )}
      </div>
    </div>
  );
}
