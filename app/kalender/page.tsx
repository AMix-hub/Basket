"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";
import { useAuth } from "../context/AuthContext";
import type { Team } from "../context/AuthContext";

/* ─── Types ─────────────────────────────────────────────────── */
interface Player {
  id: string;
  name: string;
  number: number;
}

interface TrainingSession {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: "träning" | "match";
  time: string; // HH:MM
  endTime?: string; // HH:MM
  hallId?: string;
  hallName?: string;
  recurringGroupId?: string;
}

interface Hall {
  id: string;
  name: string;
  adminId: string;
}

interface TrainingFreePeriod {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  adminId: string;
}

type AttendanceStatus = "present" | "absent" | "sick";

interface Attendance {
  sessionId: string;
  playerId: string;
  status: AttendanceStatus;
}

/** Returns true if `date` falls within any training-free period. */
function isInFreePeriod(date: string, periods: TrainingFreePeriod[]): boolean {
  return periods.some((p) => date >= p.startDate && date <= p.endDate);
}

/* ─── Helpers ────────────────────────────────────────────────── */
const MONTHS_SV = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];
const DAYS_SV = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const WEEKDAY_OPTIONS = [
  { value: 1, label: "Måndag" },
  { value: 2, label: "Tisdag" },
  { value: 3, label: "Onsdag" },
  { value: 4, label: "Torsdag" },
  { value: 5, label: "Fredag" },
  { value: 6, label: "Lördag" },
  { value: 0, label: "Söndag" },
];

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function startDayOfMonth(year: number, month: number): number {
  // Monday=0, Sunday=6
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

/** Returns all dates in [startDate, endDate] that fall on the given weekday (0=Sun..6=Sat). */
function getRecurringDates(startDate: string, endDate: string, weekday: number): string[] {
  const result: string[] = [];
  const end = new Date(endDate + "T12:00:00");
  const cur = new Date(startDate + "T12:00:00");
  // Advance to the first occurrence of the weekday
  while (cur.getDay() !== weekday) {
    cur.setDate(cur.getDate() + 1);
  }
  while (cur <= end) {
    result.push(toYMD(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return result;
}

/* ─── Local storage keys (players & attendance stay local) ── */
const PLAYERS_KEY = "basketball_players";
const ATTENDANCE_KEY = "basketball_attendance";

/* ─── Main page ──────────────────────────────────────────────── */
export default function KalenderPage() {
  const { user, getMyTeam, getAllTeams } = useAuth();
  const defaultTeam = getMyTeam();

  // For admins with multiple teams, allow selecting which team to view/add to
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  // Resolved team: the currently-selected team (or the default team)
  const team = allTeams.find((t) => t.id === selectedTeamId) ?? defaultTeam;

  const canEdit =
    user?.roles.some((r) => r === "coach" || r === "admin" || r === "assistant") ?? false;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [freePeriods, setFreePeriods] = useState<TrainingFreePeriod[]>([]);

  // Modal state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);

  // New session form
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"träning" | "match">("träning");
  const [newTime, setNewTime] = useState("17:00");
  const [newEndTime, setNewEndTime] = useState("18:30");
  const [newHallId, setNewHallId] = useState("");

  // Recurring session fields
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurStartDate, setRecurStartDate] = useState(toYMD(today));
  const [recurEndDate, setRecurEndDate] = useState("");
  const [recurWeekday, setRecurWeekday] = useState(1); // Monday

  // New player form
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [showPlayerPanel, setShowPlayerPanel] = useState(false);

  // Cancellation modal
  const [cancellingSession, setCancellingSession] = useState<TrainingSession | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  // Load players & attendance from localStorage
  useEffect(() => {
    const p = localStorage.getItem(PLAYERS_KEY);
    if (p) setPlayers(JSON.parse(p));
    const a = localStorage.getItem(ATTENDANCE_KEY);
    if (a) setAttendance(JSON.parse(a));
  }, []);

  // For admins: load all teams so they can switch between teams in the calendar
  const loadAllTeams = useCallback(async () => {
    if (!user?.roles.includes("admin")) return;
    const fetched = await getAllTeams();
    const adminTeams = fetched.filter((t) => t.adminId === user.id);
    setAllTeams(adminTeams);
    setSelectedTeamId((prev) => prev ?? (adminTeams.length > 0 ? adminTeams[0].id : null));
  }, [user, getAllTeams]);

  useEffect(() => {
    loadAllTeams();
  }, [loadAllTeams]);

  // Load halls belonging to the admin of this team (or current user if admin)
  useEffect(() => {
    if (!user) return;
    const adminId = user.roles.includes("admin") ? user.id : team?.adminId;
    if (!adminId) return;
    const q = query(collection(db, "halls"), where("adminId", "==", adminId));
    const unsub = onSnapshot(q, (snap) => {
      setHalls(snap.docs.map((d) => ({ id: d.id, name: d.data().name as string, adminId: d.data().adminId as string })));
    });
    return () => unsub();
  }, [user, team]);

  // Load training-free periods for the admin of this team
  useEffect(() => {
    if (!user) return;
    const adminId = user.roles.includes("admin") ? user.id : team?.adminId;
    if (!adminId) return;
    const q = query(collection(db, "training_free_periods"), where("adminId", "==", adminId));
    const unsub = onSnapshot(q, (snap) => {
      setFreePeriods(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name as string,
          startDate: d.data().startDate as string,
          endDate: d.data().endDate as string,
          adminId: d.data().adminId as string,
        }))
      );
    });
    return () => unsub();
  }, [user, team]);

  // Subscribe to Firestore sessions for this team
  useEffect(() => {
    if (!team) {
      setSessions([]);
      return;
    }
    const q = query(collection(db, "sessions"), where("teamId", "==", team.id));
    const unsubscribe = onSnapshot(q, (snap) => {
      const loaded: TrainingSession[] = snap.docs.map((d) => ({
        id: d.id,
        date: d.data().date as string,
        title: d.data().title as string,
        type: d.data().type as "träning" | "match",
        time: d.data().time as string,
        endTime: (d.data().endTime as string | undefined) ?? undefined,
        hallId: (d.data().hallId as string | undefined) ?? undefined,
        hallName: (d.data().hallName as string | undefined) ?? undefined,
        recurringGroupId:
          (d.data().recurringGroupId as string | undefined) ?? undefined,
      }));
      setSessions(loaded);
    });
    return () => unsubscribe();
  }, [team]);

  const savePlayers = (updated: Player[]) => {
    setPlayers(updated);
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(updated));
  };

  const saveAttendance = (updated: Attendance[]) => {
    setAttendance(updated);
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(updated));
  };

  /* ── Navigation ── */
  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  /* ── Calendar grid ── */
  const days = getDaysInMonth(year, month);
  const startOffset = startDayOfMonth(year, month);
  const totalCells = Math.ceil((days.length + startOffset) / 7) * 7;

  /* ── Add session(s) ── */
  const addSession = async () => {
    if (!newTitle.trim() || !team || !user) return;

    const selectedHall = halls.find((h) => h.id === newHallId);
    const hallFields = selectedHall
      ? { hallId: selectedHall.id, hallName: selectedHall.name }
      : {};

    if (isRecurring) {
      if (!recurStartDate || !recurEndDate || recurEndDate < recurStartDate) return;
      const allDates = getRecurringDates(recurStartDate, recurEndDate, recurWeekday);
      // Skip training-free periods
      const dates = allDates.filter((d) => !isInFreePeriod(d, freePeriods));
      if (dates.length === 0) return;
      const groupId = crypto.randomUUID();
      // Firestore batches support up to 500 operations; commit all in parallel
      const BATCH_SIZE = 500;
      const batchPromises: Promise<void>[] = [];
      for (let i = 0; i < dates.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        dates.slice(i, i + BATCH_SIZE).forEach((date) => {
          batch.set(doc(collection(db, "sessions")), {
            teamId: team.id,
            date,
            title: newTitle.trim(),
            type: newType,
            time: newTime,
            endTime: newEndTime || null,
            ...hallFields,
            createdBy: user.id,
            recurringGroupId: groupId,
          });
        });
        batchPromises.push(batch.commit());
      }
      await Promise.all(batchPromises);
    } else {
      if (!selectedDate) return;
      await addDoc(collection(db, "sessions"), {
        teamId: team.id,
        date: selectedDate,
        title: newTitle.trim(),
        type: newType,
        time: newTime,
        endTime: newEndTime || null,
        ...hallFields,
        createdBy: user.id,
      });
    }

    setNewTitle("");
    setNewType("träning");
    setNewTime("17:00");
    setNewEndTime("18:30");
    setNewHallId("");
    setIsRecurring(false);
  };

  /* ── Delete session (with cancellation modal) ── */
  const requestDeleteSession = (s: TrainingSession) => {
    setCancellingSession(s);
    setCancelReason("");
  };

  const confirmDelete = async () => {
    if (!cancellingSession || !team || !user) return;
    if (!cancelReason.trim()) return; // reason is mandatory
    setCancelBusy(true);
    try {
      await deleteDoc(doc(db, "sessions", cancellingSession.id));
      const updatedAtt = attendance.filter(
        (a) => a.sessionId !== cancellingSession.id
      );
      saveAttendance(updatedAtt);
      if (selectedSession?.id === cancellingSession.id) setSelectedSession(null);

      // Post cancellation message to team chat (reason is always required now)
      const dateLabel = new Date(
        cancellingSession.date + "T12:00:00"
      ).toLocaleDateString("sv-SE", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      await addDoc(collection(db, "messages"), {
        teamId: team.id,
        senderId: user.id,
        senderName: user.name,
        recipientId: null,
        text: `⚠️ ${cancellingSession.title} (${dateLabel} ${cancellingSession.time}) är inställt. Anledning: ${cancelReason.trim()}`,
        sentAt: new Date().toISOString(),
        readBy: [user.id],
      });

      // Send push notification + email to all team members via API route.
      // This is fire-and-forget (non-blocking) — UI doesn't wait for it.
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          sessionTitle: cancellingSession.title,
          sessionDate: cancellingSession.date,
          sessionTime: cancellingSession.time,
          reason: cancelReason.trim(),
        }),
      }).catch((err) => {
        console.warn("[notify] Push/email notification failed:", err);
      });
    } finally {
      setCancelBusy(false);
      setCancellingSession(null);
      setCancelReason("");
    }
  };

  /* ── Attendance ── */
  const getAttendance = (
    sessionId: string,
    playerId: string
  ): AttendanceStatus | null => {
    return (
      attendance.find(
        (a) => a.sessionId === sessionId && a.playerId === playerId
      )?.status ?? null
    );
  };

  const setPlayerAttendance = (
    sessionId: string,
    playerId: string,
    status: AttendanceStatus
  ) => {
    const filtered = attendance.filter(
      (a) => !(a.sessionId === sessionId && a.playerId === playerId)
    );
    saveAttendance([...filtered, { sessionId, playerId, status }]);
  };

  /* ── Player management ── */
  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    const p: Player = {
      id: crypto.randomUUID(),
      name: newPlayerName.trim(),
      number: parseInt(newPlayerNumber) || 0,
    };
    savePlayers([...players, p]);
    setNewPlayerName("");
    setNewPlayerNumber("");
  };

  const deletePlayer = (id: string) => {
    savePlayers(players.filter((p) => p.id !== id));
  };

  /* ── Attendance summary for a session ── */
  const attendanceSummary = (sessionId: string) => {
    const sess = attendance.filter((a) => a.sessionId === sessionId);
    return {
      present: sess.filter((a) => a.status === "present").length,
      absent: sess.filter((a) => a.status === "absent").length,
      sick: sess.filter((a) => a.status === "sick").length,
    };
  };

  const statusConfig: Record<
    AttendanceStatus,
    { label: string; bg: string; text: string }
  > = {
    present: {
      label: "Närvarande",
      bg: "bg-emerald-100",
      text: "text-emerald-700",
    },
    absent: { label: "Frånvarande", bg: "bg-red-100", text: "text-red-700" },
    sick: { label: "Sjuk", bg: "bg-amber-100", text: "text-amber-700" },
  };

  /* ── Drill suggestions based on present player count ── */
  interface DrillSuggestion {
    title: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    badge: string;
    color: string;
  }

  const ALL_DRILLS: DrillSuggestion[] = [
    {
      title: "1v1 – En mot en",
      description:
        "Perfekt med få spelare. Fokus på dribbling, avslut och försvarsfotarbete.",
      minPlayers: 2,
      maxPlayers: 5,
      badge: "1v1",
      color: "bg-blue-50 border-blue-200 text-blue-800",
    },
    {
      title: "2v2 – Passning & rörelse",
      description: "Träna pass, skärningar och samspel med en partner.",
      minPlayers: 4,
      maxPlayers: 7,
      badge: "2v2",
      color: "bg-purple-50 border-purple-200 text-purple-800",
    },
    {
      title: "3v3 – Drill halvplan",
      description:
        "Bra för ett litet lag. Fokus på triangelspel och snabba beslut.",
      minPlayers: 6,
      maxPlayers: 9,
      badge: "3v3",
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
    },
    {
      title: "4v4 – Lagövning",
      description:
        "Mer komplexa mönster. Bra för att träna press och rotation.",
      minPlayers: 8,
      maxPlayers: 11,
      badge: "4v4",
      color: "bg-amber-50 border-amber-200 text-amber-800",
    },
    {
      title: "5v5 – Fulltaligt matchspel",
      description: "Hela laget på planen. Kör set-plays och taktiska övningar.",
      minPlayers: 10,
      maxPlayers: 99,
      badge: "5v5",
      color: "bg-orange-50 border-orange-200 text-orange-800",
    },
    {
      title: "Stationssträning",
      description:
        "Dela in i stationer för dribbling, skott och passning. Passar alla gruppar.",
      minPlayers: 4,
      maxPlayers: 99,
      badge: "Stationer",
      color: "bg-slate-50 border-slate-200 text-slate-800",
    },
  ];

  const getDrillSuggestions = (presentCount: number): DrillSuggestion[] => {
    return ALL_DRILLS.filter(
      (d) => presentCount >= d.minPlayers && presentCount <= d.maxPlayers
    );
  };

  const sessionsOnDate = (date: string) =>
    sessions.filter((s) => s.date === date);

  /* ── Not logged in ── */
  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-slate-600 mb-4">
            Du behöver logga in för att se kalendern.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Cancellation modal */}
      {cancellingSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-slate-900 mb-1">Ställ in pass</h3>
            <p className="text-sm text-slate-500 mb-1">
              Vill du ställa in{" "}
              <strong>{cancellingSession.title}</strong>?
            </p>
            <p className="text-xs text-red-600 font-medium mb-3">
              * Anledning är obligatorisk – laget meddelas via chatten.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ange anledning till inställningen..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCancellingSession(null);
                  setCancelReason("");
                }}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                disabled={cancelBusy || !cancelReason.trim()}
                onClick={confirmDelete}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {cancelBusy ? "…" : "Ställ in"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📅</span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Kalender & Närvaro
            </h1>
          </div>
          <p className="text-slate-500 text-sm">
            Schemalägg träningar och matcher. Registrera närvaro för varje pass.
          </p>
          {/* Team selector for admins with multiple teams */}
          {user?.roles.includes("admin") && allTeams.length > 1 && (
            <div className="mt-3">
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Visa lag:
              </label>
              <select
                value={selectedTeamId ?? ""}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setSelectedSession(null);
                  setSelectedDate(null);
                }}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.ageGroup})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowPlayerPanel((s) => !s)}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors shrink-0"
        >
          👥 Spelare ({players.length})
        </button>
      </div>

      {/* No team banner */}
      {!team && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-800">
          Du är inte med i något lag ännu. Gå med i ett lag för att se och
          lägga till träningar.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-slate-200 transition-colors text-slate-700 font-bold"
            >
              ‹
            </button>
            <h2 className="text-lg font-bold text-slate-900">
              {MONTHS_SV[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-slate-200 transition-colors text-slate-700 font-bold"
            >
              ›
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SV.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-semibold text-slate-500 py-2"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: totalCells }).map((_, i) => {
              const dayIndex = i - startOffset;
              if (dayIndex < 0 || dayIndex >= days.length) {
                return <div key={i} className="aspect-square" />;
              }
              const date = days[dayIndex];
              const ymd = toYMD(date);
              const isToday = ymd === toYMD(today);
              const daySessions = sessionsOnDate(ymd);
              const isSelected = selectedDate === ymd;
              const isFreePeriod = isInFreePeriod(ymd, freePeriods);

              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedDate(ymd);
                    setSelectedSession(null);
                  }}
                  title={
                    isFreePeriod
                      ? freePeriods.find((p) => ymd >= p.startDate && ymd <= p.endDate)?.name
                      : undefined
                  }
                  className={`aspect-square rounded-xl flex flex-col items-center pt-1.5 pb-1 px-0.5 text-xs transition-all relative ${
                    isSelected
                      ? "bg-orange-500 text-white shadow-md"
                      : isFreePeriod
                      ? "bg-purple-100 text-purple-600 border border-purple-200"
                      : isToday
                      ? "bg-orange-100 text-orange-700 font-bold"
                      : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-100"
                  }`}
                >
                  <span className="font-semibold">{date.getDate()}</span>
                  {isFreePeriod && !daySessions.length && (
                    <span className="text-purple-400 text-[8px] leading-none mt-0.5">🚫</span>
                  )}
                  {daySessions.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {daySessions.map((s) => (
                        <span
                          key={s.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected
                              ? "bg-white"
                              : s.type === "match"
                              ? "bg-red-400"
                              : "bg-emerald-400"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              Träning
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              Match
            </div>
            {freePeriods.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-300 inline-block" />
                Träningsfri period
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {/* Selected date panel */}
          {selectedDate && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h3 className="font-bold text-slate-900 mb-3">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                  "sv-SE",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </h3>

              {/* Sessions on this date */}
              {/* Training-free period notice */}
              {isInFreePeriod(selectedDate, freePeriods) && (
                <div className="mb-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700 font-medium">
                  🚫 Träningsfri period:{" "}
                  {freePeriods.find((p) => selectedDate >= p.startDate && selectedDate <= p.endDate)?.name}
                </div>
              )}
              {sessionsOnDate(selectedDate).map((s) => {
                const summary = attendanceSummary(s.id);
                return (
                  <div
                    key={s.id}
                    className={`mb-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedSession?.id === s.id
                        ? "border-orange-400 bg-orange-50"
                        : "border-slate-200 hover:border-orange-300"
                    }`}
                    onClick={() =>
                      setSelectedSession(
                        selectedSession?.id === s.id ? null : s
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            s.type === "match"
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {s.type === "match" ? "Match" : "Träning"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {s.time}{s.endTime ? `–${s.endTime}` : ""}
                        </span>
                        {s.hallName && (
                          <span className="text-xs text-blue-600 font-medium">
                            🏟 {s.hallName}
                          </span>
                        )}
                        {s.recurringGroupId && (
                          <span
                            className="text-xs text-blue-500"
                            title="Återkommande"
                          >
                            🔁
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteSession(s);
                          }}
                          className="text-slate-400 hover:text-red-500 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-slate-800 mt-1">
                      {s.title}
                    </p>
                    {players.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        {summary.present}✓ {summary.absent}✗ {summary.sick}🤒
                        av {players.length}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Add session form – only for coaches/admins/assistants */}
              {canEdit && team && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !isRecurring && addSession()
                    }
                    placeholder="Titel på passet..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newType}
                      onChange={(e) =>
                        setNewType(e.target.value as "träning" | "match")
                      }
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    >
                      <option value="träning">Träning</option>
                      <option value="match">Match</option>
                    </select>
                  </div>
                  {/* Start and end time */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 block mb-0.5">Starttid</label>
                      <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 block mb-0.5">Sluttid</label>
                      <input
                        type="time"
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>
                  {/* Hall selector */}
                  {halls.length > 0 && (
                    <select
                      value={newHallId}
                      onChange={(e) => setNewHallId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    >
                      <option value="">🏟 Välj hall (valfritt)</option>
                      {halls.map((h) => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  )}

                  {/* Recurring toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="accent-orange-500 w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">
                      🔁 Återkommande
                    </span>
                  </label>

                  {/* Recurring fields */}
                  {isRecurring && (
                    <div className="space-y-2 bg-blue-50 rounded-xl p-3 border border-blue-100">
                      <p className="text-xs font-semibold text-blue-700">
                        Generera återkommande pass
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 block mb-0.5">
                            Startdatum
                          </label>
                          <input
                            type="date"
                            value={recurStartDate}
                            onChange={(e) => setRecurStartDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 block mb-0.5">
                            Slutdatum
                          </label>
                          <input
                            type="date"
                            value={recurEndDate}
                            min={recurStartDate}
                            onChange={(e) => setRecurEndDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-0.5">
                          Veckodag
                        </label>
                        <select
                          value={recurWeekday}
                          onChange={(e) =>
                            setRecurWeekday(Number(e.target.value))
                          }
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                        >
                          {WEEKDAY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {recurStartDate &&
                        recurEndDate &&
                        recurEndDate >= recurStartDate && (() => {
                          const allDates = getRecurringDates(recurStartDate, recurEndDate, recurWeekday);
                          const filtered = allDates.filter((d) => !isInFreePeriod(d, freePeriods));
                          const skipped = allDates.length - filtered.length;
                          return (
                            <div className="text-xs text-blue-600 space-y-0.5">
                              <p>{filtered.length} pass kommer att skapas</p>
                              {skipped > 0 && (
                                <p className="text-purple-600">
                                  🚫 {skipped} datum hoppas över (träningsfria perioder)
                                </p>
                              )}
                            </div>
                          );
                        })()}
                    </div>
                  )}

                  <button
                    onClick={addSession}
                    disabled={
                      !newTitle.trim() ||
                      (isRecurring
                        ? !recurStartDate ||
                          !recurEndDate ||
                          recurEndDate < recurStartDate
                        : !selectedDate)
                    }
                    className="w-full py-2 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 disabled:opacity-40 transition-colors"
                  >
                    {isRecurring ? "🔁 Skapa återkommande pass" : "+ Lägg till pass"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Attendance panel */}
          {selectedSession && players.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h3 className="font-bold text-slate-900 mb-1">Närvaro</h3>
              <p className="text-sm text-slate-500 mb-3">
                {selectedSession.title}
              </p>
              <div className="space-y-2">
                {players.map((p) => {
                  const current = getAttendance(selectedSession.id, p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-800">
                          #{p.number} {p.name}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {(
                          ["present", "absent", "sick"] as AttendanceStatus[]
                        ).map((status) => {
                          const cfg = statusConfig[status];
                          return (
                            <button
                              key={status}
                              onClick={() =>
                                setPlayerAttendance(
                                  selectedSession.id,
                                  p.id,
                                  status
                                )
                              }
                              title={cfg.label}
                              className={`text-xs px-2 py-1 rounded-lg font-medium transition-all ${
                                current === status
                                  ? `${cfg.bg} ${cfg.text} ring-1 ring-current`
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                              }`}
                            >
                              {status === "present"
                                ? "✓"
                                : status === "absent"
                                ? "✗"
                                : "🤒"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              {(() => {
                const s = attendanceSummary(selectedSession.id);
                return (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4 text-xs">
                    <span className="text-emerald-600 font-semibold">
                      ✓ {s.present} Närvarande
                    </span>
                    <span className="text-red-600 font-semibold">
                      ✗ {s.absent} Frånvar.
                    </span>
                    <span className="text-amber-600 font-semibold">
                      🤒 {s.sick} Sjuka
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {selectedSession && players.length === 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 text-sm text-amber-700">
              Lägg till spelare i spelarlistan för att registrera närvaro.
            </div>
          )}

          {/* Drill suggestions based on attendance */}
          {selectedSession &&
            (() => {
              const summary = attendanceSummary(selectedSession.id);
              const presentCount = summary.present;
              if (presentCount === 0) return null;
              const suggestions = getDrillSuggestions(presentCount);
              if (suggestions.length === 0) return null;
              return (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">💡</span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        Övningsförslag
                      </h3>
                      <p className="text-xs text-slate-500">
                        Baserat på {presentCount} närvarande spelare
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {suggestions.map((drill) => (
                      <div
                        key={drill.title}
                        className={`p-3 rounded-xl border ${drill.color}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 bg-white/70 rounded-full">
                            {drill.badge}
                          </span>
                          <span className="text-sm font-semibold">
                            {drill.title}
                          </span>
                        </div>
                        <p className="text-xs opacity-80">{drill.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          {/* Player panel */}
          {showPlayerPanel && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h3 className="font-bold text-slate-900 mb-3">Spelarlistan</h3>
              {canEdit && (
                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    value={newPlayerNumber}
                    onChange={(e) => setNewPlayerNumber(e.target.value)}
                    placeholder="#"
                    className="w-16 px-2 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                    placeholder="Spelarens namn..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <button
                    onClick={addPlayer}
                    disabled={!newPlayerName.trim()}
                    className="px-3 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors"
                  >
                    +
                  </button>
                </div>
              )}
              {players.length === 0 ? (
                <p className="text-slate-400 text-sm">
                  Inga spelare tillagda ännu.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {players.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2"
                    >
                      <span className="text-xs font-bold text-slate-500 w-8">
                        #{p.number}
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-800">
                        {p.name}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => deletePlayer(p.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
