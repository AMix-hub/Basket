"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Team } from "../context/AuthContext";
import { autoTag, TAG_LABELS, TAG_COLORS } from "../../lib/exerciseTags";
import { year1Plan } from "../data/year1";
import { year2Plan } from "../data/year2";
import { year3Plan } from "../data/year3";
import type { Session as PlanSession } from "../data/types";

/* ─── Types ─────────────────────────────────────────────────── */
interface Player {
  id: string;
  name: string;
  number: number;
}

interface SubActivity {
  id: string;
  name: string;
  description: string;
}

interface SessionNote {
  subActivities: SubActivity[];
  comment: string;
}

interface TrainingSession {
  id: string;
  teamId?: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: "träning" | "match";
  time: string; // HH:MM
  endTime?: string; // HH:MM
  hallId?: string;
  hallName?: string;
  recurringGroupId?: string;
  planYear?: number;
  planSessionNumber?: number;
  // Match-specific
  opponent?: string;
  location?: string;
  homeOrAway?: "home" | "away";
  result?: string;
  // Coach assignment
  coachId?: string;
  coachName?: string;
}

type RsvpStatus = "coming" | "not_coming" | "maybe";

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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

/** Look up a plan session by year and session number */
function getPlanSession(planYear: number, sessionNumber: number): PlanSession | null {
  const plans: Record<number, { sessions: PlanSession[] }> = {
    1: year1Plan,
    2: year2Plan,
    3: year3Plan,
  };
  const plan = plans[planYear];
  if (!plan) return null;
  return plan.sessions.find((s) => s.number === sessionNumber) ?? null;
}


/* ─── Main page ──────────────────────────────────────────────── */
export default function KalenderPage() {
  const { user, loading, getMyTeam, getAllTeams, getMyTeams } = useAuth();
  const defaultTeam = getMyTeam();

  // For admins/coaches with multiple teams, allow selecting which team to view/add to
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const myTeams = getMyTeams();
  // Resolved team: search in allTeams (admins) and myTeams (coaches) then fall back to default
  const allKnownTeams = useMemo(() => [...allTeams, ...myTeams], [allTeams, myTeams]);
  const team = allKnownTeams.find((t) => t.id === selectedTeamId) ?? defaultTeam;

  const canEdit =
    user?.roles.some((r) => r === "coach" || r === "admin" || r === "assistant") ?? false;

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const reloadSessionsRef = useRef<(() => void) | null>(null);
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
  const [newOpponent, setNewOpponent] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newHomeOrAway, setNewHomeOrAway] = useState<"home" | "away">("home");
  const [newCoachId, setNewCoachId] = useState("");

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

  // Delete scope for recurring sessions
  const [deleteScope, setDeleteScope] = useState<"single" | "all" | "specific">("single");
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());

  // Edit session modal
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [editScope, setEditScope] = useState<"single" | "all" | "specific">("single");
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<"träning" | "match">("träning");
  const [editTime, setEditTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editHallId, setEditHallId] = useState("");
  const [editOpponent, setEditOpponent] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editHomeOrAway, setEditHomeOrAway] = useState<"home" | "away">("home");
  const [editResult, setEditResult] = useState("");
  const [editCoachId, setEditCoachId] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [selectedEditIds, setSelectedEditIds] = useState<Set<string>>(new Set());

  // RSVP state
  const [myRsvps, setMyRsvps] = useState<Record<string, RsvpStatus>>({});
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, { coming: number; not_coming: number; maybe: number }>>({});
  const [rsvpBusy, setRsvpBusy] = useState<string | null>(null);

  // Team coaches for session assignment
  const [teamCoaches, setTeamCoaches] = useState<{ id: string; name: string }[]>([]);

  // Session notes (exercises linked to plan sessions or directly to a calendar session)
  const [sessionNotes, setSessionNotes] = useState<Record<string, SessionNote>>({});

  // Inline exercise-add form state (per calendar session ID)
  const [calExerciseName, setCalExerciseName] = useState<Record<string, string>>({});
  const [calExerciseDesc, setCalExerciseDesc] = useState<Record<string, string>>({});
  const [addingExerciseFor, setAddingExerciseFor] = useState<string | null>(null);
  const [savingCalExercise, setSavingCalExercise] = useState<string | null>(null);

  // Create activity modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalDate, setCreateModalDate] = useState(toYMD(today));
  // Team selected in the create modal (required – user must choose a group)
  const [createModalTeamId, setCreateModalTeamId] = useState<string>("");

  // Ref for the selected date panel – used to scroll into view when date is selected
  const dateListRef = useRef<HTMLDivElement>(null);

  const loadPlayers = useCallback(async () => {
    if (!team) { setPlayers([]); return; }
    const { data } = await supabase.from("players").select("id, name, number").eq("team_id", team.id).order("number");
    setPlayers((data ?? []).map((d) => ({ id: d.id, name: d.name, number: d.number ?? 0 })));
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPlayers();
    if (!team) return;
    const ch = supabase.channel(`players:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `team_id=eq.${team.id}` }, loadPlayers)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [team?.id, loadPlayers]);

  // For admins: load all teams so they can switch between teams in the calendar
  const loadAllTeams = useCallback(async () => {
    if (!user?.roles.includes("admin")) return;
    const fetched = await getAllTeams();
    // Co-admins have adminId pointing to the original club admin; use that so
    // they see all club teams instead of an empty list.
    const effectiveAdminId = user.adminId ?? user.id;
    const adminTeams = fetched.filter((t) => t.adminId === effectiveAdminId);
    setAllTeams(adminTeams);
    setSelectedTeamId((prev) => prev ?? (adminTeams.length > 0 ? adminTeams[0].id : null));
  }, [user, getAllTeams]);

  useEffect(() => {
    loadAllTeams();
  }, [loadAllTeams]);

  // Initialise selectedTeamId for coaches/assistants with multiple teams
  useEffect(() => {
    if (user?.roles.includes("admin")) return; // handled by loadAllTeams
    if (myTeams.length > 0 && selectedTeamId === null) {
      setSelectedTeamId(myTeams[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeams.map((t) => t.id).join(","), user]);

  // Compute the list of teams where the current user may create activities.
  // Admins see all their teams; coaches/assistants see all teams they belong to.
  const createableTeams: Team[] = user?.roles.includes("admin")
    ? allTeams.filter((t) => t.adminId === (user.adminId ?? user.id))
    : myTeams;

  // Scroll to the selected date panel when a date is clicked (useful on mobile)
  useEffect(() => {
    if (selectedDate && dateListRef.current) {
      dateListRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!user) return;
    const adminId = user.roles.includes("admin") ? (user.adminId ?? user.id) : team?.adminId;
    if (!adminId) return;
    supabase.from("halls").select("id, name, admin_id").eq("admin_id", adminId)
      .then(({ data }) => setHalls((data ?? []).map((d) => ({ id: d.id, name: d.name, adminId: d.admin_id }))));
    supabase.from("training_free_periods").select("id, name, start_date, end_date, admin_id").eq("admin_id", adminId)
      .then(({ data }) => setFreePeriods((data ?? []).map((d) => ({
        id: d.id, name: d.name, startDate: d.start_date, endDate: d.end_date, adminId: d.admin_id,
      }))));
  }, [user?.id, team?.adminId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mapSession = (d: Record<string, unknown>): TrainingSession => ({
      id: d.id as string,
      teamId: (d.team_id as string | undefined) ?? undefined,
      date: d.date as string,
      title: d.title as string,
      type: d.type as "träning" | "match",
      time: (d.time as string) ?? "",
      endTime: (d.end_time as string | undefined) ?? undefined,
      hallId: (d.hall_id as string | undefined) ?? undefined,
      hallName: (d.hall_name as string | undefined) ?? undefined,
      recurringGroupId: (d.recurring_group_id as string | undefined) ?? undefined,
      planYear: (d.plan_year as number | undefined) ?? undefined,
      planSessionNumber: (d.plan_session_number as number | undefined) ?? undefined,
      opponent: (d.opponent as string | undefined) ?? undefined,
      location: (d.location as string | undefined) ?? undefined,
      homeOrAway: (d.home_or_away as "home" | "away" | undefined) ?? undefined,
      result: (d.result as string | undefined) ?? undefined,
      coachId: (d.coach_id as string | undefined) ?? undefined,
      coachName: (d.coach_name as string | undefined) ?? undefined,
    });

    let mounted = true;
    const load = async () => {
      if (selectedTeamId === "__all__" && allTeams.length > 0) {
        const teamIds = allTeams.map((t) => t.id);
        const { data } = await supabase.from("sessions").select("*").in("team_id", teamIds);
        if (mounted) setSessions((data ?? []).map(mapSession));
        return;
      }
      if (!team) { if (mounted) setSessions([]); return; }
      const { data } = await supabase.from("sessions").select("*").eq("team_id", team.id);
      if (mounted) setSessions((data ?? []).map(mapSession));
    };
    reloadSessionsRef.current = load;
    load();

    const channelId = team ? `kalender-sessions:${team.id}` : "kalender-sessions:__all__";
    const filter = team ? `team_id=eq.${team.id}` : undefined;
    const ch = supabase.channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", ...(filter ? { filter } : {}) }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [team?.id, selectedTeamId, allTeams.map((t) => t.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!team) { setSessionNotes({}); return; }
    let mounted = true;
    const load = () =>
      supabase.from("session_notes").select("session_id, plan_year, plan_session_number, sub_activities, comment").eq("team_id", team.id)
        .then(({ data }) => {
          if (!mounted) return;
          const loaded: Record<string, SessionNote> = {};
          (data ?? []).forEach((d) => {
            const note: SessionNote = { subActivities: (d.sub_activities as SubActivity[]) ?? [], comment: d.comment ?? "" };
            if (d.plan_year && d.plan_session_number) {
              loaded[`${d.plan_year}_${d.plan_session_number}`] = note;
            } else if (d.session_id) {
              loaded[`session_${d.session_id}`] = note;
            }
          });
          setSessionNotes(loaded);
        });
    load();
    const ch = supabase.channel(`kalender-notes:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_notes", filter: `team_id=eq.${team.id}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!team) { setAttendance([]); return; }
    let mounted = true;
    const load = () =>
      supabase.from("attendance").select("session_id, player_id, status").eq("team_id", team.id)
        .then(({ data }) => {
          if (!mounted) return;
          setAttendance((data ?? []).map((d) => ({ sessionId: d.session_id, playerId: d.player_id, status: d.status as AttendanceStatus })));
        });
    load();
    const ch = supabase.channel(`kalender-attendance:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter: `team_id=eq.${team.id}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !team) { setMyRsvps({}); return; }
    let mounted = true;
    const load = () =>
      supabase.from("rsvps").select("session_id, status").eq("team_id", team.id).eq("user_id", user.id)
        .then(({ data }) => {
          if (!mounted) return;
          const loaded: Record<string, RsvpStatus> = {};
          (data ?? []).forEach((d) => { loaded[d.session_id] = d.status as RsvpStatus; });
          setMyRsvps(loaded);
        });
    load();
    const ch = supabase.channel(`kalender-rsvps-me:${team.id}:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps", filter: `team_id=eq.${team.id}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user?.id, team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!team || !canEdit) { setRsvpCounts({}); return; }
    let mounted = true;
    const load = () =>
      supabase.from("rsvps").select("session_id, status").eq("team_id", team.id)
        .then(({ data }) => {
          if (!mounted) return;
          const counts: Record<string, { coming: number; not_coming: number; maybe: number }> = {};
          (data ?? []).forEach((d) => {
            const sid = d.session_id;
            const st = d.status as RsvpStatus;
            if (!counts[sid]) counts[sid] = { coming: 0, not_coming: 0, maybe: 0 };
            counts[sid][st]++;
          });
          setRsvpCounts(counts);
        });
    load();
    const ch = supabase.channel(`kalender-rsvps-all:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps", filter: `team_id=eq.${team.id}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [team?.id, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!team) { setTeamCoaches([]); return; }
    supabase.from("team_members").select("user_id, role, profiles(name)").eq("team_id", team.id)
      .in("role", ["coach", "assistant"])
      .then(({ data }) => {
        setTeamCoaches((data ?? []).map((d) => ({
          id: d.user_id,
          name: (Array.isArray(d.profiles) ? (d.profiles[0] as { name: string } | undefined)?.name : (d.profiles as { name: string } | null)?.name) ?? "",
        })));
      });
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps


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
    if (!newTitle.trim() || !user) return;
    // Resolve the target team: prefer the explicitly selected team from the
    // create modal; fall back to the currently-viewed team.
    const targetTeam =
      createableTeams.find((t) => t.id === createModalTeamId) ?? team;
    if (!targetTeam) return;

    const selectedHall = halls.find((h) => h.id === newHallId);
    const hallFields = selectedHall
      ? { hallId: selectedHall.id, hallName: selectedHall.name }
      : {};

    const matchFields = newType === "match"
      ? { opponent: newOpponent.trim() || null, location: newLocation.trim() || null, homeOrAway: newHomeOrAway }
      : {};
    const selectedCoach = teamCoaches.find((c) => c.id === newCoachId);
    const coachFields = selectedCoach ? { coachId: selectedCoach.id, coachName: selectedCoach.name } : {};

    if (isRecurring) {
      if (!recurStartDate || !recurEndDate || recurEndDate < recurStartDate) return;
      const allDates = getRecurringDates(recurStartDate, recurEndDate, recurWeekday);
      const dates = allDates.filter((d) => !isInFreePeriod(d, freePeriods));
      if (dates.length === 0) return;
      const groupId = crypto.randomUUID();
      const rows = dates.map((date) => ({
        team_id: targetTeam.id, date, title: newTitle.trim(), type: newType,
        time: newTime, end_time: newEndTime || null,
        hall_id: selectedHall?.id ?? null, hall_name: selectedHall?.name ?? null,
        ...(newType === "match" ? { opponent: newOpponent.trim() || null, location: newLocation.trim() || null, home_or_away: newHomeOrAway } : {}),
        coach_id: teamCoaches.find((c) => c.id === newCoachId)?.id ?? null,
        coach_name: teamCoaches.find((c) => c.id === newCoachId)?.name ?? null,
        created_by: user.id, recurring_group_id: groupId,
      }));
      await supabase.from("sessions").insert(rows);
    } else {
      if (!createModalDate) return;
      await supabase.from("sessions").insert({
        team_id: targetTeam.id, date: createModalDate, title: newTitle.trim(), type: newType,
        time: newTime, end_time: newEndTime || null,
        hall_id: selectedHall?.id ?? null, hall_name: selectedHall?.name ?? null,
        ...(newType === "match" ? { opponent: newOpponent.trim() || null, location: newLocation.trim() || null, home_or_away: newHomeOrAway } : {}),
        coach_id: teamCoaches.find((c) => c.id === newCoachId)?.id ?? null,
        coach_name: teamCoaches.find((c) => c.id === newCoachId)?.name ?? null,
        created_by: user.id,
      });
    }

    reloadSessionsRef.current?.();
    setNewTitle("");
    setNewType("träning");
    setNewTime("17:00");
    setNewEndTime("18:30");
    setNewHallId("");
    setNewOpponent("");
    setNewLocation("");
    setNewHomeOrAway("home");
    setNewCoachId("");
    setIsRecurring(false);
    setShowCreateModal(false);
  };

  /* ── Delete session (with cancellation modal) ── */
  const requestDeleteSession = (s: TrainingSession) => {
    setCancellingSession(s);
    setCancelReason("");
    setDeleteScope("single");
    setSelectedDeleteIds(new Set([s.id]));
  };

  const confirmDelete = async () => {
    if (!cancellingSession || !user) return;
    if (!cancelReason.trim()) return;
    setCancelBusy(true);

    // Resolve which team to notify
    const notifyTeam =
      allTeams.find((t) => t.id === cancellingSession.teamId) ?? team;

    try {
      // Determine which session IDs to delete based on scope
      let idsToDelete: string[];
      if (deleteScope === "all" && cancellingSession.recurringGroupId) {
        idsToDelete = sessions
          .filter((s) => s.recurringGroupId === cancellingSession.recurringGroupId)
          .map((s) => s.id);
      } else if (deleteScope === "specific") {
        idsToDelete = [...selectedDeleteIds];
      } else {
        idsToDelete = [cancellingSession.id];
      }

      await supabase.from("sessions").delete().in("id", idsToDelete);
      // Remove deleted sessions from state immediately
      const deletedSet = new Set(idsToDelete);
      setSessions((prev) => prev.filter((s) => !deletedSet.has(s.id)));
      if (selectedSession && deletedSet.has(selectedSession.id)) setSelectedSession(null);

      if (notifyTeam) {
        const dateLabel = new Date(cancellingSession.date + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "long", month: "long", day: "numeric" });
        const countNote = idsToDelete.length > 1 ? ` (${idsToDelete.length} pass)` : "";
        await supabase.from("messages").insert({
          team_id: notifyTeam.id, sender_id: user.id, sender_name: user.name,
          recipient_id: null,
          text: `⚠️ ${cancellingSession.title}${countNote} (${dateLabel} ${cancellingSession.time}) är inställt. Anledning: ${cancelReason.trim()}`,
          sent_at: new Date().toISOString(), read_by: [user.id],
        });

        const { data: { session: authSession } } = await supabase.auth.getSession();
        const notifyToken = authSession?.access_token ?? "";
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${notifyToken}` },
          body: JSON.stringify({ teamId: notifyTeam.id, sessionTitle: cancellingSession.title, sessionDate: cancellingSession.date, sessionTime: cancellingSession.time, reason: cancelReason.trim() }),
        }).catch((err) => { console.warn("[notify]", err); });
      }
    } finally {
      setCancelBusy(false);
      setCancellingSession(null);
      setCancelReason("");
      setDeleteScope("single");
      setSelectedDeleteIds(new Set());
    }
  };

  /* ── Edit session ── */
  const requestEditSession = (s: TrainingSession) => {
    setEditingSession(s);
    setEditTitle(s.title);
    setEditType(s.type);
    setEditTime(s.time);
    setEditEndTime(s.endTime ?? "");
    setEditHallId(s.hallId ?? "");
    setEditOpponent(s.opponent ?? "");
    setEditLocation(s.location ?? "");
    setEditHomeOrAway(s.homeOrAway ?? "home");
    setEditResult(s.result ?? "");
    setEditCoachId(s.coachId ?? "");
    setEditScope("single");
    setSelectedEditIds(new Set([s.id]));
  };

  const confirmEdit = async () => {
    if (!editingSession || !user) return;
    setEditBusy(true);
    try {
      let idsToEdit: string[];
      if (editScope === "all" && editingSession.recurringGroupId) {
        idsToEdit = sessions
          .filter((s) => s.recurringGroupId === editingSession.recurringGroupId)
          .map((s) => s.id);
      } else if (editScope === "specific") {
        idsToEdit = [...selectedEditIds];
      } else {
        idsToEdit = [editingSession.id];
      }

      const selectedHall = halls.find((h) => h.id === editHallId);
      const selectedCoachEdit = teamCoaches.find((c) => c.id === editCoachId);
      const updates: Record<string, unknown> = {
        title: editTitle.trim(),
        type: editType,
        time: editTime,
        end_time: editEndTime || null,
        hall_id: selectedHall?.id ?? null,
        hall_name: selectedHall?.name ?? null,
        opponent: editType === "match" ? (editOpponent.trim() || null) : null,
        location: editType === "match" ? (editLocation.trim() || null) : null,
        home_or_away: editType === "match" ? editHomeOrAway : null,
        result: editResult.trim() || null,
        coach_id: selectedCoachEdit?.id ?? null,
        coach_name: selectedCoachEdit?.name ?? null,
      };

      await supabase.from("sessions").update(updates).in("id", idsToEdit);

      const sessionPatch = {
        title: editTitle.trim(),
        type: editType,
        time: editTime,
        endTime: editEndTime || undefined,
        hallId: selectedHall?.id,
        hallName: selectedHall?.name,
        opponent: editType === "match" ? (editOpponent.trim() || undefined) : undefined,
        location: editType === "match" ? (editLocation.trim() || undefined) : undefined,
        homeOrAway: editType === "match" ? editHomeOrAway : undefined,
        result: editResult.trim() || undefined,
        coachId: selectedCoachEdit?.id,
        coachName: selectedCoachEdit?.name,
      };

      // Update sessions list in-place so calendar reflects changes immediately
      setSessions((prev) =>
        prev.map((s) => (idsToEdit.includes(s.id) ? { ...s, ...sessionPatch } : s))
      );

      // Update selectedSession if it was edited
      if (selectedSession && idsToEdit.includes(selectedSession.id)) {
        setSelectedSession({ ...selectedSession, ...sessionPatch });
      }

      setEditingSession(null);
    } finally {
      setEditBusy(false);
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

  const setPlayerAttendance = async (sessionId: string, playerId: string, status: AttendanceStatus) => {
    if (!team) return;
    const { error } = await supabase.from("attendance").upsert(
      { session_id: sessionId, player_id: playerId, status, team_id: team.id, updated_by: user?.id ?? null },
      { onConflict: "session_id,player_id" }
    );
    if (error) {
      setAttendance((prev) => {
        const filtered = prev.filter((a) => !(a.sessionId === sessionId && a.playerId === playerId));
        return [...filtered, { sessionId, playerId, status }];
      });
    }
  };

  const submitRsvp = async (sessionId: string, status: RsvpStatus) => {
    if (!user || !team || rsvpBusy) return;
    setRsvpBusy(sessionId);
    try {
      if (myRsvps[sessionId] === status) {
        await supabase.from("rsvps").delete().eq("session_id", sessionId).eq("user_id", user.id);
      } else {
        await supabase.from("rsvps").upsert(
          { session_id: sessionId, user_id: user.id, user_name: user.name, team_id: team.id, status },
          { onConflict: "session_id,user_id" }
        );
      }
    } finally {
      setRsvpBusy(null);
    }
  };

  /* ── Player management ── */
  const addPlayer = async () => {
    if (!newPlayerName.trim() || !team) return;
    await supabase.from("players").insert({
      team_id: team.id,
      name: newPlayerName.trim(),
      number: parseInt(newPlayerNumber) || 0,
    });
    setNewPlayerName("");
    setNewPlayerNumber("");
    loadPlayers();
  };

  const deletePlayer = async (id: string) => {
    await supabase.from("players").delete().eq("id", id);
    loadPlayers();
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

  /* ── Send 24h reminder push notification ── */
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const sendReminder = async (s: TrainingSession) => {
    if (!team || sendingReminder) return;
    setSendingReminder(s.id);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token ?? "";
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          teamId: team.id,
          sessionTitle: s.title,
          sessionDate: s.date,
          sessionTime: s.time,
          message: `📣 Påminnelse: ${s.title} är ${new Date(s.date + "T12:00:00").toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })} kl. ${s.time}. Glöm inte att dyka upp!`,
        }),
      });
    } catch (err) {
      console.warn("[reminder] notification failed:", err);
    } finally {
      setSendingReminder(null);
    }
  };

  /* ── Inline exercise management for calendar sessions ── */
  const addCalendarExercise = async (sessionId: string) => {
    if (!team || !user) return;
    const name = (calExerciseName[sessionId] ?? "").trim();
    const description = (calExerciseDesc[sessionId] ?? "").trim();
    if (!name) return;
    setSavingCalExercise(sessionId);
    try {
      const existing = sessionNotes[`session_${sessionId}`] ?? { subActivities: [], comment: "" };
      const newSub: SubActivity = { id: crypto.randomUUID(), name, description };
      await supabase.from("session_notes").upsert(
        { team_id: team.id, session_id: sessionId, sub_activities: [...existing.subActivities, newSub], comment: existing.comment, updated_by: user.id },
        { onConflict: "session_id" }
      );
      setCalExerciseName((prev) => ({ ...prev, [sessionId]: "" }));
      setCalExerciseDesc((prev) => ({ ...prev, [sessionId]: "" }));
      setAddingExerciseFor(null);
    } finally {
      setSavingCalExercise(null);
    }
  };

  const deleteCalendarExercise = async (sessionId: string, subId: string) => {
    if (!team || !user) return;
    const existing = sessionNotes[`session_${sessionId}`];
    if (!existing) return;
    await supabase.from("session_notes").upsert(
      { team_id: team.id, session_id: sessionId, sub_activities: existing.subActivities.filter((sub) => sub.id !== subId), comment: existing.comment, updated_by: user.id },
      { onConflict: "session_id" }
    );
  };

  // Pre-compute recurring group sessions to avoid repeated filter calls in render
  const deletingGroupSessions = cancellingSession?.recurringGroupId
    ? sessions.filter((s) => s.recurringGroupId === cancellingSession.recurringGroupId)
    : [];
  const editingGroupSessions = editingSession?.recurringGroupId
    ? sessions.filter((s) => s.recurringGroupId === editingSession.recurringGroupId)
    : [];

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <span className="text-slate-500 dark:text-slate-400">Laddar…</span>
      </div>
    );
  }

  /* ── Not logged in ── */
  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-slate-400 mb-4">
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">Ställ in pass</h3>
            <p className="text-sm text-slate-400 mb-1">
              Vill du ställa in{" "}
              <strong className="text-slate-700 dark:text-slate-200">{cancellingSession.title}</strong>?
            </p>

            {/* Recurring scope selector */}
            {cancellingSession.recurringGroupId && (
              <div className="mb-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Vilka pass ska ställas in?</p>
                {(["single", "all", "specific"] as const).map((scope) => (
                  <label key={scope} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="radio"
                      name="deleteScope"
                      value={scope}
                      checked={deleteScope === scope}
                      onChange={() => {
                        setDeleteScope(scope);
                        if (scope === "single") setSelectedDeleteIds(new Set([cancellingSession.id]));
                        if (scope === "all") setSelectedDeleteIds(new Set(deletingGroupSessions.map((s) => s.id)));
                        if (scope === "specific") setSelectedDeleteIds(new Set([cancellingSession.id]));
                      }}
                      className="accent-red-500"
                    />
                    {scope === "single" && "Bara detta pass"}
                    {scope === "all" && `Alla återkommande pass (${deletingGroupSessions.length} st)`}
                    {scope === "specific" && "Välj specifika pass"}
                  </label>
                ))}

                {/* Specific selection list */}
                {deleteScope === "specific" && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-slate-600 rounded-xl divide-y divide-slate-700">
                    {deletingGroupSessions
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((s) => (
                        <label key={s.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={selectedDeleteIds.has(s.id)}
                            onChange={(e) => {
                              const next = new Set(selectedDeleteIds);
                              if (e.target.checked) { next.add(s.id); } else { next.delete(s.id); }
                              setSelectedDeleteIds(next);
                            }}
                            className="accent-red-500"
                          />
                          <span>
                            {new Date(s.date + "T12:00:00").toLocaleDateString("sv-SE", {
                              weekday: "short", day: "numeric", month: "short",
                            })} {s.time}
                          </span>
                        </label>
                      ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-red-400 font-medium mb-3">
              * Anledning är obligatorisk – laget meddelas via chatten.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ange anledning till inställningen..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCancellingSession(null);
                  setCancelReason("");
                  setDeleteScope("single");
                  setSelectedDeleteIds(new Set());
                }}
                className="flex-1 py-2 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                Avbryt
              </button>
              <button
                disabled={cancelBusy || !cancelReason.trim() || (deleteScope === "specific" && selectedDeleteIds.size === 0)}
                onClick={confirmDelete}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {cancelBusy ? "…" : "Ställ in"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit session modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Redigera pass</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Titel</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Typ</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as "träning" | "match")}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="träning">Träning</option>
                  <option value="match">Match</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Starttid</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Sluttid</label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              {halls.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Hall</label>
                  <select
                    value={editHallId}
                    onChange={(e) => setEditHallId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="">🏟 Ingen hall</option>
                    {halls.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Match-specific fields */}
              {editType === "match" && (
                <div className="space-y-2 bg-red-950/40 rounded-xl p-3 border border-red-800/50">
                  <p className="text-xs font-semibold text-red-400">Matchinfo</p>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Motståndare</label>
                    <input type="text" value={editOpponent} onChange={(e) => setEditOpponent(e.target.value)}
                      placeholder="Motståndarlaget..."
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Plats / Arena</label>
                    <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="Arena eller adress..."
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Hemma / Borta</label>
                    <select value={editHomeOrAway} onChange={(e) => setEditHomeOrAway(e.target.value as "home" | "away")}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400">
                      <option value="home">🏠 Hemma</option>
                      <option value="away">✈️ Borta</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Resultat (om matchen spelats)</label>
                    <input type="text" value={editResult} onChange={(e) => setEditResult(e.target.value)}
                      placeholder="t.ex. 68–54"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400" />
                  </div>
                </div>
              )}
              {/* Coach assignment */}
              {teamCoaches.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Ansvarig tränare</label>
                  <select value={editCoachId} onChange={(e) => setEditCoachId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="">Ingen specifik tränare</option>
                    {teamCoaches.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recurring scope */}
              {editingSession.recurringGroupId && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Vilka pass ska uppdateras?</p>
                  {(["single", "all", "specific"] as const).map((scope) => (
                    <label key={scope} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="radio"
                        name="editScope"
                        value={scope}
                        checked={editScope === scope}
                        onChange={() => {
                          setEditScope(scope);
                          if (scope === "single") setSelectedEditIds(new Set([editingSession.id]));
                          if (scope === "all") setSelectedEditIds(new Set(editingGroupSessions.map((s) => s.id)));
                          if (scope === "specific") setSelectedEditIds(new Set([editingSession.id]));
                        }}
                        className="accent-orange-500"
                      />
                      {scope === "single" && "Bara detta pass"}
                      {scope === "all" && `Alla återkommande pass (${editingGroupSessions.length} st)`}
                      {scope === "specific" && "Välj specifika pass"}
                    </label>
                  ))}
                  {editScope === "specific" && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-slate-600 rounded-xl divide-y divide-slate-700">
                      {editingGroupSessions
                        .slice()
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((s) => (
                          <label key={s.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={selectedEditIds.has(s.id)}
                              onChange={(e) => {
                                const next = new Set(selectedEditIds);
                                if (e.target.checked) { next.add(s.id); } else { next.delete(s.id); }
                                setSelectedEditIds(next);
                              }}
                              className="accent-orange-500"
                            />
                            <span>
                              {new Date(s.date + "T12:00:00").toLocaleDateString("sv-SE", {
                                weekday: "short", day: "numeric", month: "short",
                              })} {s.time}
                            </span>
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditingSession(null)}
                className="flex-1 py-2 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                Avbryt
              </button>
              <button
                disabled={editBusy || !editTitle.trim() || (editScope === "specific" && selectedEditIds.size === 0)}
                onClick={confirmEdit}
                className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {editBusy ? "Sparar…" : "Spara"}
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
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              Kalender & Närvaro
            </h1>
          </div>
          <p className="text-slate-500 text-sm">
            Schemalägg träningar och matcher. Registrera närvaro för varje pass.
          </p>
          {/* Team selector for admins and coaches with multiple teams */}
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
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              >
                <option value="__all__">🏢 Alla lag</option>
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.ageGroup ? ` (${t.ageGroup})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!user?.roles.includes("admin") && myTeams.length > 1 && (
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
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              >
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.ageGroup ? ` (${t.ageGroup})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && createableTeams.length > 0 && (
            <button
              onClick={() => {
                const date = selectedDate ?? toYMD(today);
                setCreateModalDate(date);
                setRecurStartDate(date);
                setCreateModalTeamId(
                  createableTeams.find((t) => t.id === team?.id)?.id ??
                  createableTeams[0].id
                );
                setNewTitle("");
                setNewType("träning");
                setNewTime("17:00");
                setNewEndTime("18:30");
                setNewHallId("");
                setIsRecurring(false);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold btn-gradient-orange text-white shrink-0"
            >
              + Skapa ny aktivitet
            </button>
          )}
          <button
            onClick={() => setShowPlayerPanel((s) => !s)}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            👥 Spelare ({players.length})
          </button>
        </div>
      </div>

      {/* Create activity modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 mb-3">Skapa ny aktivitet</h3>
            <div className="space-y-3">
              {/* Group selector – required; only teams where user has permission */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Grupp <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={createModalTeamId}
                  onChange={(e) => setCreateModalTeamId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                >
                  {createableTeams.length === 0 && (
                    <option value="">Inga lag tillgängliga</option>
                  )}
                  {createableTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.ageGroup ? ` (${t.ageGroup})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {/* Date – changing the date also syncs Startdatum for recurring */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Datum</label>
                <input
                  type="date"
                  value={createModalDate}
                  onChange={(e) => {
                    setCreateModalDate(e.target.value);
                    setRecurStartDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Titel</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isRecurring && addSession()}
                  placeholder="Titel på passet..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Typ</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as "träning" | "match")}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                >
                  <option value="träning">Träning</option>
                  <option value="match">Match</option>
                </select>
              </div>
              {/* Times */}
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
              {/* Hall */}
              {halls.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">Hall</label>
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
                </div>
              )}
              {/* Match-specific fields */}
              {newType === "match" && (
                <div className="space-y-2 bg-red-50 rounded-xl p-3 border border-red-100">
                  <p className="text-xs font-semibold text-red-700">Matchinfo</p>
                  <div>
                    <label className="text-xs text-slate-500 block mb-0.5">Motståndare</label>
                    <input
                      type="text"
                      value={newOpponent}
                      onChange={(e) => setNewOpponent(e.target.value)}
                      placeholder="Motståndarlaget..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-0.5">Plats / Arena</label>
                    <input
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="Arena eller adress..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-0.5">Hemma / Borta</label>
                    <select
                      value={newHomeOrAway}
                      onChange={(e) => setNewHomeOrAway(e.target.value as "home" | "away")}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                    >
                      <option value="home">🏠 Hemma</option>
                      <option value="away">✈️ Borta</option>
                    </select>
                  </div>
                </div>
              )}
              {/* Coach assignment */}
              {teamCoaches.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">Ansvarig tränare</label>
                  <select
                    value={newCoachId}
                    onChange={(e) => setNewCoachId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  >
                    <option value="">Ingen specifik tränare</option>
                    {teamCoaches.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Recurring toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="accent-orange-500 w-4 h-4"
                />
                <span className="text-sm text-slate-700">🔁 Återkommande</span>
              </label>
              {/* Recurring fields */}
              {isRecurring && (
                <div className="space-y-2 bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700">Generera återkommande pass</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 block mb-0.5">Startdatum</label>
                      <input
                        type="date"
                        value={recurStartDate}
                        onChange={(e) => setRecurStartDate(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 block mb-0.5">Slutdatum</label>
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
                    <label className="text-xs text-slate-500 block mb-0.5">Veckodag</label>
                    <select
                      value={recurWeekday}
                      onChange={(e) => setRecurWeekday(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    >
                      {WEEKDAY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {recurStartDate && recurEndDate && recurEndDate >= recurStartDate && (() => {
                    const allDates = getRecurringDates(recurStartDate, recurEndDate, recurWeekday);
                    const filtered = allDates.filter((d) => !isInFreePeriod(d, freePeriods));
                    const skipped = allDates.length - filtered.length;
                    return (
                      <div className="text-xs text-blue-600 space-y-0.5">
                        <p>{filtered.length} pass kommer att skapas</p>
                        {skipped > 0 && (
                          <p className="text-purple-600">🚫 {skipped} datum hoppas över (träningsfria perioder)</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Avbryt
              </button>
              <button
                disabled={
                  !createModalTeamId ||
                  !newTitle.trim() ||
                  (isRecurring
                    ? !recurStartDate || !recurEndDate || recurEndDate < recurStartDate
                    : !createModalDate)
                }
                onClick={addSession}
                className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40 transition-colors"
              >
                {isRecurring ? "🔁 Skapa återkommande" : "+ Lägg till"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700/60 transition-colors text-slate-500 dark:text-slate-300 font-bold"
            >
              ‹
            </button>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {MONTHS_SV[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700/60 transition-colors text-slate-500 dark:text-slate-300 font-bold"
            >
              ›
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SV.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-semibold text-slate-400 py-2"
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

              let hasMatch = false;
              let hasTraining = false;
              for (const s of daySessions) {
                if (s.type === "match") hasMatch = true;
                else hasTraining = true;
                if (hasMatch && hasTraining) break;
              }

              let glowClass = "";
              if (!isSelected) {
                if (isToday && !isFreePeriod) glowClass = "cal-glow-today";
                else if (hasMatch && hasTraining) glowClass = "cal-glow-both";
                else if (hasMatch) glowClass = "cal-glow-match";
                else if (hasTraining) glowClass = "cal-glow-training";
              }

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
                  className={`aspect-square rounded-xl flex flex-col items-center pt-1.5 pb-1 px-0.5 text-xs transition-all relative ${glowClass} ${
                    isSelected
                      ? "bg-orange-500 text-white shadow-md"
                      : isFreePeriod
                      ? "bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/40 hover:bg-purple-100 dark:hover:bg-slate-700/80"
                      : isToday
                      ? "bg-sky-500/20 text-sky-600 dark:text-sky-300 font-bold border border-sky-500/40"
                      : "bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700/50"
                  }`}
                >
                  <span className="font-semibold">{date.getDate()}</span>
                  {isFreePeriod && !daySessions.length && (
                    <span className="text-purple-400 text-[8px] leading-none mt-0.5">🚫</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-sky-500/20 border border-sky-500/40 inline-block cal-glow-today" />
              Idag
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gray-200 dark:bg-slate-800 inline-block cal-glow-training" />
              Träning
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gray-200 dark:bg-slate-800 inline-block cal-glow-match" />
              Match
            </div>
            {freePeriods.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-gray-200 dark:bg-slate-800 border border-purple-400 dark:border-purple-700/50 inline-block" />
                Träningsfri period
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {/* Selected date panel */}
          {selectedDate && (
            <div ref={dateListRef} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">
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
                {canEdit && createableTeams.length > 0 && (
                  <button
                    onClick={() => {
                      setCreateModalDate(selectedDate);
                      setRecurStartDate(selectedDate);
                      setCreateModalTeamId(
                        createableTeams.find((t) => t.id === team?.id)?.id ??
                        createableTeams[0].id
                      );
                      setNewTitle("");
                      setNewType("träning");
                      setNewTime("17:00");
                      setNewEndTime("18:30");
                      setNewHallId("");
                      setIsRecurring(false);
                      setShowCreateModal(true);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors shrink-0"
                  >
                    + Lägg till
                  </button>
                )}
              </div>

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
                const note = s.planYear && s.planSessionNumber
                  ? sessionNotes[`${s.planYear}_${s.planSessionNumber}`]
                  : sessionNotes[`session_${s.id}`];
                const isExpanded = selectedSession?.id === s.id;
                // Find team name for multi-team view
                const sessionTeam = s.teamId ? allTeams.find((t) => t.id === s.teamId) : null;
                const showTeamName = selectedTeamId === "__all__" && sessionTeam;
                return (
                  <div
                    key={s.id}
                    className={`mb-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      isExpanded
                        ? "border-orange-400 bg-orange-500/20"
                        : "border-gray-200 dark:border-slate-600 hover:border-orange-400"
                    }`}
                    onClick={() =>
                      setSelectedSession(isExpanded ? null : s)
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
                        {showTeamName && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            👥 {sessionTeam.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/session/${s.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-500 dark:text-slate-400 hover:text-orange-400 transition-colors text-sm px-1"
                          title="Öppna träningssida"
                        >
                          ↗
                        </Link>
                        {canEdit && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                requestEditSession(s);
                              }}
                              className="text-slate-500 dark:text-slate-400 hover:text-orange-500 transition-colors text-sm px-1"
                              title="Redigera"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteSession(s);
                              }}
                              className="text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors text-sm"
                              title="Ställ in"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-sm text-slate-700 dark:text-slate-200 mt-1">
                      {s.title}
                    </p>
                    {/* Match meta: opponent, location, result */}
                    {s.type === "match" && (s.opponent || s.location || s.result) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.homeOrAway && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                            {s.homeOrAway === "home" ? "🏠 Hemma" : "✈️ Borta"}
                          </span>
                        )}
                        {s.opponent && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium">
                            vs {s.opponent}
                          </span>
                        )}
                        {s.location && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">📍 {s.location}</span>
                        )}
                        {s.result && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold">
                            {s.result}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Coach name */}
                    {s.coachName && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">🏃 {s.coachName}</p>
                    )}
                    {/* RSVP count for coaches */}
                    {canEdit && rsvpCounts[s.id] && (rsvpCounts[s.id].coming + rsvpCounts[s.id].not_coming + rsvpCounts[s.id].maybe) > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        RSVP: <span className="text-emerald-600 dark:text-emerald-400">{rsvpCounts[s.id].coming}✓</span>{" "}
                        <span className="text-red-600 dark:text-red-400">{rsvpCounts[s.id].not_coming}✗</span>{" "}
                        <span className="text-amber-600 dark:text-amber-400">{rsvpCounts[s.id].maybe}?</span>
                      </p>
                    )}
                    {s.planSessionNumber && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Pass {s.planSessionNumber}{s.planYear ? ` · År ${s.planYear}` : ""}
                        {!isExpanded && note && note.subActivities.length > 0 && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-orange-500 font-semibold">
                            🏋️ {note.subActivities.length} övning{note.subActivities.length !== 1 ? "ar" : ""}
                          </span>
                        )}
                        {!isExpanded && s.planYear && s.planSessionNumber && (() => {
                          const ps = getPlanSession(s.planYear, s.planSessionNumber);
                          return ps ? (
                            <span className="ml-2 text-slate-500 dark:text-slate-400">· {ps.activities.length} planövningar</span>
                          ) : null;
                        })()}
                      </p>
                    )}
                    {!s.planSessionNumber && !isExpanded && note && note.subActivities.length > 0 && (
                      <p className="text-xs text-orange-500 font-semibold mt-0.5">
                        🏋️ {note.subActivities.length} övning{note.subActivities.length !== 1 ? "ar" : ""}
                      </p>
                    )}
                    {players.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        {summary.present}✓ {summary.absent}✗ {summary.sick}🤒
                        av {players.length}
                      </p>
                    )}

                    {/* Expanded session detail: plan exercises + notes + reminder */}
                    {isExpanded && (
                      <div className="mt-2 border-t border-orange-200 pt-2 space-y-2" onClick={(e) => e.stopPropagation()}>

                        {/* Link to session detail page */}
                        <Link
                          href={`/session/${s.id}`}
                          className="flex items-center justify-center gap-2 w-full py-1.5 text-xs font-semibold bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors"
                        >
                          Öppna träningssida →
                        </Link>

                        {/* RSVP buttons for non-coach users on upcoming sessions */}
                        {!canEdit && s.date >= toYMD(today) && (
                          <div className="bg-gray-100 dark:bg-slate-700/50 rounded-lg px-2.5 py-2">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Kommer du?</p>
                            <div className="flex gap-1.5">
                              {([["coming", "✓ Ja", "emerald"], ["maybe", "? Kanske", "amber"], ["not_coming", "✗ Nej", "red"]] as const).map(([st, label, color]) => (
                                <button
                                  key={st}
                                  disabled={rsvpBusy === s.id}
                                  onClick={(e) => { e.stopPropagation(); submitRsvp(s.id, st); }}
                                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                                    myRsvps[s.id] === st
                                      ? color === "emerald" ? "bg-emerald-600 text-white" : color === "amber" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                                      : "bg-gray-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-500"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tränarkommentar */}
                        {note?.comment && (
                          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg px-2.5 py-1.5">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-0.5">💬 Tränarkommentar</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{note.comment}</p>
                          </div>
                        )}

                        {/* Plan exercises from exercise bank */}
                        {s.planYear && s.planSessionNumber && (() => {
                          const ps = getPlanSession(s.planYear, s.planSessionNumber);
                          if (!ps) return null;
                          return (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                📋 Planövningar ({ps.activities.length})
                              </p>
                              <div className="space-y-1.5">
                                {ps.activities.map((act, idx) => {
                                  const tags = autoTag(act);
                                  return (
                                    <div key={idx} className="bg-white dark:bg-slate-700 rounded-lg px-2.5 py-2 border border-orange-200 dark:border-orange-800/40">
                                      <div className="flex items-start justify-between gap-1 mb-0.5">
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{act.name}</p>
                                        <div className="flex gap-1 flex-wrap shrink-0">
                                          {tags.slice(0, 2).map((tag) => (
                                            <span key={tag} className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${TAG_COLORS[tag]}`}>
                                              {TAG_LABELS[tag]}
                                            </span>
                                          ))}
                                          {act.durationMinutes && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400">⏱{act.durationMinutes}m</span>
                                          )}
                                          {act.intensityLevel && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400">{"🔥".repeat(act.intensityLevel)}</span>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{act.description}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Coach-added sub-activities */}
                        {note && note.subActivities.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 mb-1">🏋️ Tillagda övningar ({note.subActivities.length})</p>
                            <div className="space-y-1">
                              {note.subActivities.map((sub) => (
                                <div key={sub.id} className="bg-white dark:bg-slate-700 rounded-lg px-2.5 py-1.5 border border-blue-200 dark:border-blue-800/40">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{sub.name}</p>
                                      {sub.description && (
                                        <p className="text-xs text-slate-400 leading-relaxed">{sub.description}</p>
                                      )}
                                    </div>
                                    {canEdit && (
                                      <button
                                        onClick={() => {
                                          if (s.planYear && s.planSessionNumber) {
                                            // handled by SeasonPage; no-op here
                                          } else {
                                            deleteCalendarExercise(s.id, sub.id);
                                          }
                                        }}
                                        className="text-slate-500 dark:text-slate-300 hover:text-red-500 transition-colors text-xs shrink-0 ml-1"
                                        title="Ta bort övning"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Inline add-exercise form (training sessions only) */}
                        {canEdit && s.type === "träning" && !s.planYear && (
                          <div className="border-t border-orange-100 pt-2">
                            {addingExerciseFor === s.id ? (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">➕ Lägg till övning</p>
                                <input
                                  type="text"
                                  value={calExerciseName[s.id] ?? ""}
                                  onChange={(e) =>
                                    setCalExerciseName((prev) => ({ ...prev, [s.id]: e.target.value }))
                                  }
                                  placeholder="Övningens namn..."
                                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                                />
                                <textarea
                                  value={calExerciseDesc[s.id] ?? ""}
                                  onChange={(e) =>
                                    setCalExerciseDesc((prev) => ({ ...prev, [s.id]: e.target.value }))
                                  }
                                  placeholder="Beskrivning (valfritt)..."
                                  rows={2}
                                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setAddingExerciseFor(null)}
                                    className="flex-1 py-1.5 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                                  >
                                    Avbryt
                                  </button>
                                  <button
                                    disabled={
                                      savingCalExercise === s.id ||
                                      !(calExerciseName[s.id] ?? "").trim()
                                    }
                                    onClick={() => addCalendarExercise(s.id)}
                                    className="flex-1 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-40"
                                  >
                                    {savingCalExercise === s.id ? "Sparar…" : "Spara övning"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddingExerciseFor(s.id)}
                                className="text-xs text-orange-600 hover:text-orange-800 font-semibold flex items-center gap-1"
                              >
                                🏋️ + Lägg till övning
                              </button>
                            )}
                          </div>
                        )}

                        {/* Action links */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {s.planYear && (
                            <Link
                              href={`/ar${s.planYear}`}
                              className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline"
                            >
                              📋 Se träningsplan →
                            </Link>
                          )}
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sendReminder(s);
                              }}
                              disabled={sendingReminder === s.id}
                              className="ml-auto flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                              title="Skicka påminnelse till laget"
                            >
                              {sendingReminder === s.id ? "…" : "🔔 Skicka påminnelse"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {sessionsOnDate(selectedDate).length === 0 && !isInFreePeriod(selectedDate, freePeriods) && (
                <p className="text-slate-400 text-sm">Inga aktiviteter på detta datum.</p>
              )}
            </div>
          )}

          {/* Attendance panel */}
          {selectedSession && players.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Närvaro</h3>
                <button
                  onClick={async () => {
                    for (const p of players) {
                      await setPlayerAttendance(selectedSession.id, p.id, "present");
                    }
                  }}
                  className="text-xs px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 text-emerald-700 dark:text-emerald-400 rounded-lg font-semibold transition-colors"
                >
                  ✓ Markera alla
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-3">
                {selectedSession.title}
              </p>
              <div className="space-y-2">
                {players.map((p) => {
                  const current = getAttendance(selectedSession.id, p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
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
                                  : "bg-gray-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
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
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 flex gap-4 text-xs">
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
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">💡</span>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
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
                          <span className="text-xs font-bold px-2 py-0.5 bg-gray-200 dark:bg-slate-900/50 rounded-full">
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

          {/* Smart exercise recommendations based on session tags (AI-recommendation) */}
          {selectedSession && selectedSession.planYear && selectedSession.planSessionNumber && (() => {
            const ps = getPlanSession(selectedSession.planYear, selectedSession.planSessionNumber);
            if (!ps) return null;
            // Collect tags from all plan activities
            const allTags = new Set(ps.activities.flatMap((a) => autoTag(a)));
            if (allTags.size === 0) return null;
            // Find exercises from OTHER sessions that share those tags (recommendations)
            const allPlans = [year1Plan, year2Plan, year3Plan];
            const recommended = allPlans
              .flatMap((plan) =>
                plan.sessions
                  .filter((sess) => sess.number !== selectedSession.planSessionNumber || plan.year !== selectedSession.planYear)
                  .flatMap((sess) =>
                    sess.activities
                      .filter((act) => autoTag(act).some((t) => allTags.has(t)))
                      .slice(0, 1)
                      .map((act) => ({ ...act, planYear: plan.year, sessionNumber: sess.number, sessionTitle: sess.title }))
                  )
              )
              .slice(0, 3);
            if (recommended.length === 0) return null;
            return (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🤖</span>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">AI-rekommendationer</h3>
                    <p className="text-xs text-slate-500">
                      Liknande övningar från övningsbanken
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {recommended.map((rec, i) => {
                    const tags = autoTag(rec);
                    return (
                      <div key={i} className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700">
                        <div className="flex items-start justify-between gap-1 mb-0.5">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{rec.name}</p>
                          <div className="flex gap-1 shrink-0">
                            {tags.slice(0, 1).map((tag) => (
                              <span key={tag} className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${TAG_COLORS[tag]}`}>
                                {TAG_LABELS[tag]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">År {rec.planYear} · {rec.sessionTitle}</p>
                      </div>
                    );
                  })}
                </div>
                <Link
                  href="/traningsdatabas"
                  className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:underline mt-3"
                >
                  📚 Fler övningar i övningsbanken →
                </Link>
              </div>
            );
          })()}

          {/* Player panel */}
          {showPlayerPanel && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Spelarlistan</h3>
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
                      className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl px-3 py-2"
                    >
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-8">
                        #{p.number}
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                        {p.name}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => deletePlayer(p.id)}
                          className="text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors text-sm"
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
