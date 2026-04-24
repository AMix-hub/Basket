"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

/* ─── Types mirrored from kalender/page.tsx ─────────────────── */
interface TrainingSession {
  id: string;
  date: string;
  title: string;
  type: "träning" | "match";
  time: string;
  opponent?: string;
  homeOrAway?: "home" | "away";
}

type AttendanceStatus = "present" | "absent" | "sick";
type RsvpStatus = "coming" | "not_coming" | "maybe";

interface Attendance {
  sessionId: string;
  playerId: string;
  status: AttendanceStatus;
}

interface Player {
  id: string;
  name: string;
  number: number;
}

/* ─── Storage keys (players & attendance stay local) ────────── */
const ATTENDANCE_KEY = "basketball_attendance";
const PLAYERS_KEY = "basketball_players";

const MONTHS_SV = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; badge: string; icon: string }
> = {
  present: { label: "Närvarande", badge: "bg-emerald-900/30 text-emerald-400", icon: "✓" },
  absent:  { label: "Frånvarande", badge: "bg-red-900/30 text-red-400",        icon: "✗" },
  sick:    { label: "Sjuk",        badge: "bg-amber-900/30 text-amber-400",     icon: "🤒" },
};

export default function FamiljPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>(() => {
    if (typeof window === "undefined") return [];
    const a = localStorage.getItem(ATTENDANCE_KEY);
    return a ? (JSON.parse(a) as Attendance[]) : [];
  });
  const [players, setPlayers] = useState<Player[]>(() => {
    if (typeof window === "undefined") return [];
    const p = localStorage.getItem(PLAYERS_KEY);
    return p ? (JSON.parse(p) as Player[]) : [];
  });
  const [myRsvps, setMyRsvps] = useState<Record<string, RsvpStatus>>({});
  const [rsvpBusy, setRsvpBusy] = useState<string | null>(null);
  const [playerNotes, setPlayerNotes] = useState<Array<{ id: string; note: string; coachName: string; date: string }>>([]);

  // Suppress unused-setter warnings – setters kept for future use
  void setAttendance; void setPlayers;

  useEffect(() => {
    if (!team) { setSessions([]); return; }
    let mounted = true;
    const load = () =>
      supabase.from("sessions").select("id, date, title, type, time, opponent, home_or_away").eq("team_id", team.id)
        .then(({ data }) => {
          if (!mounted) return;
          setSessions((data ?? []).map((d) => ({
            id: d.id, date: d.date, title: d.title,
            type: d.type as "träning" | "match", time: d.time ?? "",
            opponent: d.opponent ?? undefined, homeOrAway: d.home_or_away ?? undefined,
          })));
        });
    load();
    const ch = supabase.channel(`familj-sessions:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `team_id=eq.${team.id}` }, load)
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
    const ch = supabase.channel(`familj-rsvps:${team.id}:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps", filter: `team_id=eq.${team.id}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user?.id, team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !team) { setPlayerNotes([]); return; }
    let mounted = true;
    supabase.from("player_notes").select("id, note, coach_name, date")
      .eq("team_id", team.id).eq("player_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!mounted) return;
        setPlayerNotes((data ?? []).map((d) => ({
          id: d.id, note: d.note, coachName: d.coach_name ?? "", date: d.date ?? "",
        })));
      });
    return () => { mounted = false; };
  }, [user?.id, team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* ── Match child name to player ── */
  const childName = user?.childName ?? "";
  const matchedPlayer = players.find(
    (p) => p.name.toLowerCase() === childName.toLowerCase()
  );

  /* ── Upcoming sessions (today or later), sorted ascending ── */
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sessions
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  /* ── Past sessions with child's attendance ── */
  const past = sessions
    .filter((s) => s.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const getStatus = (sessionId: string): AttendanceStatus | null => {
    if (!matchedPlayer) return null;
    return (
      attendance.find(
        (a) => a.sessionId === sessionId && a.playerId === matchedPlayer.id
      )?.status ?? null
    );
  };

  /* ── Attendance summary for child ── */
  const pastWithAttendance = matchedPlayer
    ? past.filter((s) => getStatus(s.id) !== null)
    : [];

  const totalPresent = pastWithAttendance.filter(
    (s) => getStatus(s.id) === "present"
  ).length;
  const totalAbsent = pastWithAttendance.filter(
    (s) => getStatus(s.id) === "absent"
  ).length;
  const totalSick = pastWithAttendance.filter(
    (s) => getStatus(s.id) === "sick"
  ).length;
  const attendanceRate =
    pastWithAttendance.length > 0
      ? Math.round((totalPresent / pastWithAttendance.length) * 100)
      : null;

  /* ─── Not logged in ─── */
  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">👪</p>
          <h1 className="text-xl font-bold text-slate-200 mb-2">
            Logga in för att se ditt barns sida
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            Föräldrar kan följa sitt barns träningsschema och närvaro.
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
              className="px-4 py-2 bg-slate-100 text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Registrera
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Wrong role ─── */
  if (!user.roles.includes("parent")) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">👪</p>
          <h1 className="text-xl font-bold text-slate-200 mb-2">
            Föräldrasidan
          </h1>
          <p className="text-slate-500 text-sm">
            Den här sidan är avsedd för föräldrar. Ditt konto har rollen{" "}
            <strong>{user.roles.join(", ")}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">👪</span>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Mitt barns sida
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          Hej {user.name}! Här kan du följa{" "}
          <strong>{childName || "ditt barn"}</strong>
          {team ? ` i laget ${team.name}` : ""}.
        </p>
      </div>

      {/* No team yet */}
      {!team && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-2xl p-6 mb-6">
          <p className="text-amber-300 font-semibold mb-1">Du är inte med i något lag ännu</p>
          <p className="text-amber-300 text-sm">
            Be coachen om en <strong>föräldrainbjudningskod</strong> och gå med via
            din profil eller registrering.
          </p>
        </div>
      )}

      {/* Attendance summary card */}
      {matchedPlayer && pastWithAttendance.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-slate-100 mb-4 flex items-center gap-2">
            <span>📊</span> Närvaro – {childName}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-slate-900/30 rounded-xl p-3">
              <p className="text-2xl font-extrabold text-slate-100">
                {pastWithAttendance.length}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Pass registrerade</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-2xl font-extrabold text-emerald-400">
                {totalPresent}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">Närvarande</p>
            </div>
            <div className="bg-red-900/30 rounded-xl p-3">
              <p className="text-2xl font-extrabold text-red-400">{totalAbsent}</p>
              <p className="text-xs text-red-600 mt-0.5">Frånvarande</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-2xl font-extrabold text-amber-400">{totalSick}</p>
              <p className="text-xs text-amber-600 mt-0.5">Sjukfrånvaro</p>
            </div>
          </div>
          {attendanceRate !== null && (
            <div className="mt-3 text-center">
              <span className="text-sm font-semibold text-slate-600">
                Närvaro­andel:{" "}
                <span
                  className={
                    attendanceRate >= 70
                      ? "text-emerald-600"
                      : attendanceRate >= 40
                      ? "text-amber-600"
                      : "text-red-600"
                  }
                >
                  {attendanceRate}%
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Player not found warning */}
      {team && !matchedPlayer && childName && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-2xl p-4 mb-6 text-sm text-amber-300">
          <strong>Obs!</strong> Hittade ingen spelare med namnet &quot;{childName}&quot; i
          spelarlistan. Kontakta coachen för att lägga till{" "}
          <strong>{childName}</strong> i laget.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming sessions */}
        <div>
          <h2 className="font-bold text-slate-100 mb-3 flex items-center gap-2">
            <span>📅</span> Kommande pass
          </h2>
          {upcoming.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center text-slate-400 text-sm">
              Inga kommande pass inlagda ännu.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 8).map((s) => {
                const d = new Date(s.date + "T12:00:00");
                const label = d.toLocaleDateString("sv-SE", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                const myRsvp = myRsvps[s.id];
                return (
                  <div
                    key={s.id}
                    className="bg-slate-800 border border-slate-700 rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 text-center shrink-0">
                        <p className="text-xs text-slate-400 font-medium uppercase">
                          {MONTHS_SV[d.getMonth()].slice(0, 3)}
                        </p>
                        <p className="text-xl font-extrabold text-slate-100 leading-tight">
                          {d.getDate()}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-200 text-sm">
                          {s.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {label} · {s.time}
                        </p>
                        {s.type === "match" && s.opponent && (
                          <p className="text-xs text-red-400 mt-0.5">
                            {s.homeOrAway === "home" ? "🏠" : "✈️"} vs {s.opponent}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                          s.type === "match"
                            ? "bg-red-900/30 text-red-400"
                            : "bg-emerald-900/30 text-emerald-400"
                        }`}
                      >
                        {s.type === "match" ? "Match" : "Träning"}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      {([["coming", "✓ Ja", "emerald"], ["maybe", "? Kanske", "amber"], ["not_coming", "✗ Nej", "red"]] as const).map(([st, lbl, color]) => (
                        <button
                          key={st}
                          disabled={rsvpBusy === s.id}
                          onClick={() => submitRsvp(s.id, st)}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                            myRsvp === st
                              ? color === "emerald" ? "bg-emerald-600 text-white" : color === "amber" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                              : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Past sessions with child's attendance */}
        <div>
          <h2 className="font-bold text-slate-100 mb-3 flex items-center gap-2">
            <span>📋</span> Genomförda pass
            {matchedPlayer && (
              <span className="text-xs font-normal text-slate-500">
                – {childName}s närvaro
              </span>
            )}
          </h2>
          {past.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center text-slate-400 text-sm">
              Inga genomförda pass ännu.
            </div>
          ) : (
            <div className="space-y-2">
              {past.slice(0, 12).map((s) => {
                const d = new Date(s.date + "T12:00:00");
                const label = d.toLocaleDateString("sv-SE", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                const status = getStatus(s.id);
                const cfg = status ? STATUS_CONFIG[status] : null;
                return (
                  <div
                    key={s.id}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {s.title}
                      </p>
                      <p className="text-xs text-slate-400">{label}</p>
                    </div>
                    {cfg ? (
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.badge}`}
                      >
                        {cfg.icon} {cfg.label}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 shrink-0">
                        Ej registrerat
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Coach notes for the child/player */}
      {playerNotes.length > 0 && (
        <div className="mt-6">
          <h2 className="font-bold text-slate-100 mb-3 flex items-center gap-2">
            <span>📝</span> Tränarens anteckningar
            {childName && <span className="text-xs font-normal text-slate-500">– om {childName}</span>}
          </h2>
          <div className="space-y-3">
            {playerNotes.map((n) => (
              <div key={n.id} className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3">
                <p className="text-sm text-slate-200 leading-relaxed">{n.note}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-indigo-400">{n.coachName}</span>
                  <span className="text-xs text-slate-600">{n.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
