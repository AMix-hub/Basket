"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth, User } from "../context/AuthContext";

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

/* ─── Storage ────────────────────────────────────────────────── */
const MESSAGES_KEY = "basketball_messages";
const USERS_KEY = "basketball_users";

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(MESSAGES_KEY);
  return raw ? (JSON.parse(raw) as Message[]) : [];
}

function saveMessages(msgs: Message[]) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
}

/* ─── Helpers ────────────────────────────────────────────────── */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  const dStr = d.toDateString();
  if (dStr === todayStr) {
    return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("sv-SE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function MeddelandenPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();

  /* team members (other than current user) – computed once from stable team data */
  const teamMembers: User[] = (() => {
    if (!team) return [];
    const allUsers: User[] = typeof window !== "undefined"
      ? (JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as User[])
      : [];
    return allUsers.filter(
      (u) => team.memberIds.includes(u.id) && u.id !== user?.id
    );
  })();

  /* all messages for this team */
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!team || typeof window === "undefined") return [];
    return loadMessages().filter((m) => m.teamId === team.id);
  });

  /* selected conversation:
     "team" = group chat
     userId  = DM with that user */
  const [selected, setSelected] = useState<"team" | string>("team");

  /* draft text */
  const [draft, setDraft] = useState("");

  /* auto-scroll ref */
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Poll messages every 3 s via interval ── */
  useEffect(() => {
    if (!team) return;
    const id = setInterval(() => {
      setMessages(loadMessages().filter((m) => m.teamId === team.id));
    }, 3000);
    return () => clearInterval(id);
  }, [team]);

  /* ── Mark visible messages as read (runs when selection or message count changes) ── */
  useEffect(() => {
    if (!user || !team) return;
    const all = loadMessages();
    let changed = false;
    const updated = all.map((m) => {
      if (m.teamId !== team.id) return m;
      const isInThread =
        selected === "team"
          ? m.recipientId === null
          : (m.senderId === user.id && m.recipientId === selected) ||
            (m.senderId === selected && m.recipientId === user.id);
      if (isInThread && !m.readBy.includes(user.id)) {
        changed = true;
        return { ...m, readBy: [...m.readBy, user.id] };
      }
      return m;
    });
    if (changed) {
      saveMessages(updated);
      setMessages(updated.filter((m) => m.teamId === team.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, messages.length, user?.id, team?.id]);

  /* ── Auto-scroll to bottom ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selected]);

  /* ── Thread messages ── */
  const threadMessages = messages.filter((m) => {
    if (selected === "team") return m.recipientId === null;
    return (
      (m.senderId === user?.id && m.recipientId === selected) ||
      (m.senderId === selected && m.recipientId === user?.id)
    );
  });

  /* ── Unread counts ── */
  const unreadTeam = messages.filter(
    (m) =>
      m.recipientId === null &&
      m.senderId !== user?.id &&
      !m.readBy.includes(user?.id ?? "")
  ).length;

  const unreadDM = (memberId: string) =>
    messages.filter(
      (m) =>
        m.senderId === memberId &&
        m.recipientId === user?.id &&
        !m.readBy.includes(user?.id ?? "")
    ).length;

  /* ── Send message ── */
  const sendMessage = () => {
    if (!draft.trim() || !user || !team) return;
    const msg: Message = {
      id: crypto.randomUUID(),
      teamId: team.id,
      senderId: user.id,
      senderName: user.name,
      recipientId: selected === "team" ? null : selected,
      text: draft.trim(),
      sentAt: new Date().toISOString(),
      readBy: [user.id],
    };
    const all = loadMessages();
    const updated = [...all, msg];
    saveMessages(updated);
    setDraft("");
    setMessages(updated.filter((m) => m.teamId === team.id));
  };

  /* ── Key handler ── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── Selected member info ── */
  const selectedMember =
    selected !== "team"
      ? teamMembers.find((m) => m.id === selected) ?? null
      : null;

  const threadTitle =
    selected === "team"
      ? `💬 Lagchatt – ${team?.name ?? "Laget"}`
      : `✉️ ${selectedMember?.name ?? "Direktmeddelande"}`;

  /* ─────────────────────────────────────────── */
  /* ── Not logged in ── */
  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">💬</p>
          <h1 className="text-xl font-bold text-slate-800 mb-2">
            Logga in för att använda chatten
          </h1>
          <p className="text-slate-500 text-sm mb-5">
            Kommunicera med ditt lag och skicka direktmeddelanden.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/login"
              className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
            >
              Logga in
            </Link>
            <Link
              href="/registrera"
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Registrera
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── No team ── */
  if (!team) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">💬</p>
          <h1 className="text-xl font-bold text-slate-800 mb-2">
            Du är inte med i något lag ännu
          </h1>
          <p className="text-slate-500 text-sm mb-5">
            Gå med i ett lag för att kunna chatta med dina lagkamrater.
          </p>
          <Link
            href="/lag"
            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
          >
            Gå till Laget
          </Link>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────── */
  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">💬</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Meddelanden
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          Chatta med laget eller skicka direktmeddelanden.
        </p>
      </div>

      {/* Layout: sidebar + thread */}
      <div className="flex flex-col gap-3 md:flex-row md:gap-4 h-[calc(100vh-310px)] md:h-[calc(100vh-230px)]" style={{ minHeight: 380 }}>
        {/* ── Sidebar ── */}
        <div className="w-full shrink-0 flex flex-col gap-1 overflow-y-auto max-h-36 md:w-56 md:max-h-none">
          {/* Team chat */}
          <button
            onClick={() => setSelected("team")}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full ${
              selected === "team"
                ? "bg-orange-500 text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <span>💬</span>
              <span className="truncate">Lagchatt</span>
            </span>
            {unreadTeam > 0 && selected !== "team" && (
              <span className="ml-1 shrink-0 text-xs font-bold bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                {unreadTeam > 9 ? "9+" : unreadTeam}
              </span>
            )}
          </button>

          {/* Divider */}
          {teamMembers.length > 0 && (
            <p className="text-xs text-slate-400 font-semibold px-1 pt-2 pb-0.5 uppercase tracking-wide">
              Direktmeddelanden
            </p>
          )}

          {/* DM list */}
          {teamMembers.map((m) => {
            const count = unreadDM(m.id);
            const roleIcon =
              m.role === "coach"
                ? "🎽"
                : m.role === "parent"
                ? "👪"
                : m.role === "admin"
                ? "🏛"
                : "👋";
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full ${
                  selected === m.id
                    ? "bg-orange-500 text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0">{roleIcon}</span>
                  <span className="truncate">{m.name}</span>
                </span>
                {count > 0 && selected !== m.id && (
                  <span className="ml-1 shrink-0 text-xs font-bold bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </button>
            );
          })}

          {teamMembers.length === 0 && (
            <p className="text-xs text-slate-400 px-2 pt-2">
              Inga andra lagmedlemmar ännu.
            </p>
          )}
        </div>

        {/* ── Thread panel ── */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Thread header */}
          <div className="px-4 py-3 border-b border-slate-100 shrink-0">
            <p className="font-bold text-slate-900 text-sm">{threadTitle}</p>
            {selected === "team" && (
              <p className="text-xs text-slate-400 mt-0.5">
                Alla i {team.name} ser dessa meddelanden
              </p>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {threadMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <span className="text-4xl">💬</span>
                <p>Inga meddelanden ännu. Skriv det första!</p>
              </div>
            ) : (
              threadMessages.map((m) => {
                const isOwn = m.senderId === user.id;
                return (
                  <div
                    key={m.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] ${
                        isOwn ? "items-end" : "items-start"
                      } flex flex-col gap-1`}
                    >
                      {!isOwn && (
                        <span className="text-xs text-slate-500 font-medium px-1">
                          {m.senderName}
                        </span>
                      )}
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                          isOwn
                            ? "bg-orange-500 text-white rounded-br-sm"
                            : "bg-slate-100 text-slate-800 rounded-bl-sm"
                        }`}
                      >
                        {m.text}
                      </div>
                      <span
                        className={`text-xs text-slate-400 px-1 ${
                          isOwn ? "text-right" : "text-left"
                        }`}
                      >
                        {formatTime(m.sentAt)}
                        {isOwn && selected !== "team" && (
                          <span className="ml-1">
                            {m.readBy.length > 1 ? "✓✓" : "✓"}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-slate-100 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={(el) => {
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
                  }
                }}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  // auto-resize
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
                disabled={!draft.trim()}
                className="shrink-0 w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
                aria-label="Skicka"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 rotate-90"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Shift+Enter för ny rad
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
