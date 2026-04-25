"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface TrainingSession {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: "träning" | "match";
  time: string;
  opponent?: string;
  homeOrAway?: "home" | "away";
}

const MONTHS_SV = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];
const DAYS_SV_SHORT = ["M", "T", "O", "T", "F", "L", "S"];

export default function DashboardHome() {
  const { user, getMyTeams } = useAuth();
  const router = useRouter();
  const myTeams = getMyTeams();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const team = myTeams.find((t) => t.id === selectedTeamId) ?? myTeams[0] ?? null;

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [myRsvps, setMyRsvps] = useState<Set<string>>(new Set());

  const today = new Date();
  const todayYMD = today.toISOString().slice(0, 10);

  useEffect(() => {
    if (!team || !user) { setMyRsvps(new Set()); return; }
    supabase.from("rsvps").select("session_id").eq("team_id", team.id).eq("user_id", user.id)
      .then(({ data }) => setMyRsvps(new Set((data ?? []).map((r: { session_id: string }) => r.session_id))));
  }, [team?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!team) return;
    let mounted = true;

    const load = () =>
      supabase.from("sessions").select("id, date, title, type, time, opponent, home_or_away").eq("team_id", team.id)
        .then(({ data }) => {
          if (!mounted) return;
          setSessions(
            (data ?? []).map((d) => ({
              id: d.id, date: d.date, title: d.title,
              type: (d.type as "träning" | "match") ?? "träning",
              time: d.time ?? "",
              opponent: d.opponent ?? undefined,
              homeOrAway: d.home_or_away ?? undefined,
            }))
          );
        });

    load();
    const channel = supabase
      .channel(`dashboard-sessions:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `team_id=eq.${team.id}` }, load)
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [team?.id]);

  /* ── Computed stats ── */
  const trainingSessions = sessions.filter((s) => s.type === "träning");
  const totalSessions = trainingSessions.length;
  const completedSessions = trainingSessions.filter((s) => s.date < todayYMD).length;
  const seasonPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const memberCount = team?.memberIds?.length ?? 0;

  const nextMatch = sessions
    .filter((s) => s.type === "match" && s.date >= todayYMD)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  function matchDayLabel() {
    if (!nextMatch) return "—";
    const d = new Date(nextMatch.date + "T12:00:00");
    return ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"][d.getDay()];
  }

  /* ── Mini calendar ── */
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDay = today.getDate();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const trainingDays = new Set(
    sessions
      .filter((s) => s.type === "träning" && s.date.startsWith(monthPrefix))
      .map((s) => parseInt(s.date.slice(8), 10))
  );
  const matchDays = new Set(
    sessions
      .filter((s) => s.type === "match" && s.date.startsWith(monthPrefix))
      .map((s) => parseInt(s.date.slice(8), 10))
  );

  /* ── Unanswered RSVPs (non-coach users) ── */
  const isCoachOrAdmin = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;
  const unansweredCount = isCoachOrAdmin ? 0 : sessions
    .filter((s) => s.date >= todayYMD && !myRsvps.has(s.id))
    .length;

  /* ── Today's sessions ── */
  const todaySessions = sessions
    .filter((s) => s.date === todayYMD)
    .sort((a, b) => a.time.localeCompare(b.time));

  /* ── Upcoming training sessions ── */
  const upcoming = sessions
    .filter((s) => s.type === "träning" && s.date >= todayYMD)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const DAY_NAMES = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];

  /* ── Greeting ── */
  const hour = today.getHours();
  const greeting =
    hour < 10 ? "God morgon" : hour < 18 ? "Hej" : "God kväll";
  const displayName = user?.name?.split(" ")[0] ?? "Coach";

  return (
    <div className="space-y-5">

      {/* Greeting */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting}, {displayName}! 👋
          </h1>
          {team && (
            <p className="text-sm text-slate-400 mt-1">
              {team.name} · {team.ageGroup}
            </p>
          )}
        </div>
        {myTeams.length > 1 && (
          <select
            value={team?.id ?? ""}
            onChange={(e) => {
              setSelectedTeamId(e.target.value);
              setSessions([]);
            }}
            className="text-sm text-slate-200 bg-slate-700 border border-slate-600 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            {myTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Unanswered RSVP nudge */}
      {!isCoachOrAdmin && unansweredCount > 0 && (
        <Link
          href="/familj"
          className="flex items-center gap-3 bg-amber-900/30 border border-amber-700/50 rounded-2xl px-4 py-3 hover:border-amber-600/70 transition-colors"
        >
          <span className="text-xl">📬</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">
              Du har {unansweredCount} obesvarad{unansweredCount !== 1 ? "e" : ""} kallelse{unansweredCount !== 1 ? "r" : ""}
            </p>
            <p className="text-xs text-amber-500">Svara nu →</p>
          </div>
        </Link>
      )}

      {/* Today's session banner */}
      {todaySessions.length > 0 && (
        <div className="flex flex-col gap-2">
          {todaySessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className={`flex items-center gap-4 rounded-2xl p-4 border transition-all hover:opacity-90 ${
                s.type === "match"
                  ? "bg-red-900/30 border-red-700/50"
                  : "bg-orange-500/15 border-orange-500/30"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl ${
                s.type === "match" ? "bg-red-800/60" : "bg-orange-500/30"
              }`}>
                {s.type === "match" ? "🏆" : "🏀"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-400 mb-0.5">IDAG</p>
                <p className="font-bold text-white truncate">{s.title}</p>
                {s.time && <p className="text-xs text-slate-400">{s.time}</p>}
              </div>
              <span className="text-orange-400 font-bold text-sm shrink-0">→</span>
            </Link>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Träningspass",
            value: totalSessions > 0 ? String(totalSessions) : "—",
            accent: "text-sky-400",
            bg: "bg-sky-500/10 border-sky-500/15",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            ),
          },
          {
            label: "Spelare",
            value: memberCount > 0 ? String(memberCount) : "—",
            accent: "text-violet-400",
            bg: "bg-violet-500/10 border-violet-500/15",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
          },
          {
            label: "Säsongen",
            value: totalSessions > 0 ? `${seasonPct}%` : "—",
            accent: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/15",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            ),
          },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border rounded-2xl p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">{stat.label}</span>
              <span className="text-slate-500">{stat.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${stat.accent}`}>{stat.value}</div>
          </div>
        ))}
        {/* Next match card */}
        {nextMatch ? (
          <Link
            href={`/session/${nextMatch.id}`}
            className="bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/40 rounded-2xl p-4 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Nästa match</span>
              <span className="text-lg">🏆</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">{matchDayLabel()}</div>
            {nextMatch.opponent && (
              <p className="text-xs text-amber-500 mt-1 truncate">
                {nextMatch.homeOrAway === "home" ? "🏠" : "✈️"} vs {nextMatch.opponent}
              </p>
            )}
          </Link>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/15 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Nästa match</span>
              <span className="text-lg">🏆</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">—</div>
          </div>
        )}
      </div>

      {/* Middle row: upcoming sessions + calendar */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Upcoming sessions */}
        <div className="sm:col-span-2 bg-[#1e293b] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-slate-200">Kommande träningar</span>
            <Link
              href="/kalender"
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              Se kalender →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-500 mb-3">
                Inga träningar inlagda i kalendern ännu.
              </p>
              <Link
                href="/kalender"
                className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors"
              >
                Lägg till träningar →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((s) => {
                const d = new Date(s.date + "T12:00:00");
                const dayName = DAY_NAMES[d.getDay()];
                const dateLabel = `${d.getDate()}/${d.getMonth() + 1}`;
                const isToday = s.date === todayYMD;
                return (
                  <button key={s.id} onClick={() => router.push(`/session/${s.id}`)}
                    className="flex items-center gap-3 w-full text-left hover:bg-slate-700/30 rounded-xl px-2 py-1 -mx-2 transition-colors">
                    <div
                      className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                        isToday ? "bg-sky-500" : "bg-sky-500/10"
                      }`}
                    >
                      <span className={`text-[10px] font-semibold ${isToday ? "text-white" : "text-sky-400"}`}>
                        {dayName}
                      </span>
                      <span className={`text-xs font-bold ${isToday ? "text-white" : "text-sky-400"}`}>
                        {d.getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 font-medium truncate">{s.title}</div>
                      <div className="text-xs text-slate-500">{dateLabel} · {s.time}</div>
                    </div>
                    <span className="text-slate-600 text-xs shrink-0">→</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mini calendar */}
        <div className="bg-[#1e293b] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-slate-200">Kalender</span>
            <span className="text-xs text-slate-400">{MONTHS_SV[month]}</span>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {DAYS_SV_SHORT.map((d, i) => (
              <div key={i} className="text-[10px] text-slate-500 font-medium py-0.5">
                {d}
              </div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const isToday = day === todayDay;
              const hasMatch = matchDays.has(day);
              const hasTraining = trainingDays.has(day);
              return (
                <div
                  key={day}
                  className={`text-[11px] py-1 rounded-md font-medium ${
                    isToday
                      ? "bg-sky-500 text-white"
                      : hasMatch
                      ? "bg-amber-500/25 text-amber-400"
                      : hasTraining
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "text-slate-500"
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500/40 inline-block" />
              Träning
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-amber-500/40 inline-block" />
              Match
            </span>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            href: "/taktik",
            label: "Taktiktavla",
            desc: "Rita upp spelsystem live",
            color: "text-violet-400",
            iconBg: "bg-violet-500/10",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            ),
          },
          {
            href: "/statistik",
            label: "Statistik",
            desc: "Följ spelarutveckling",
            color: "text-sky-400",
            iconBg: "bg-sky-500/10",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
          },
          {
            href: "/videor",
            label: "Videor",
            desc: "Dela klipp med laget",
            color: "text-emerald-400",
            iconBg: "bg-emerald-500/10",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ),
          },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-[#1e293b] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-center gap-4 transition-all duration-150 group"
          >
            <div className={`w-10 h-10 rounded-xl ${link.iconBg} flex items-center justify-center flex-shrink-0 ${link.color}`}>
              {link.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold ${link.color}`}>{link.label}</div>
              <div className="text-xs text-slate-500">{link.desc}</div>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-sm flex-shrink-0">
              →
            </span>
          </Link>
        ))}
      </div>

      {/* ── Quick actions for coaches/admins ── */}
      {user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) && (
        <div className="bg-[#1e293b] border border-white/5 rounded-2xl p-5">
          <p className="font-semibold text-slate-200 mb-3">Snabbåtgärder</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { href: "/kalender", label: "Skapa träning", icon: "📅", color: "bg-sky-500/10 hover:bg-sky-500/20 text-sky-300" },
              { href: "/kalender", label: "Skapa match",   icon: "🏆", color: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300" },
              { href: "/spelare",  label: "Spelartruppen", icon: "🏀", color: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-300" },
              { href: "/taktik",   label: "Taktiktavla",   icon: "🎯", color: "bg-violet-500/10 hover:bg-violet-500/20 text-violet-300" },
              { href: "/meddelanden", label: "Meddelanden", icon: "💬", color: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300" },
              { href: "/betalningar", label: "Betalningar", icon: "💰", color: "bg-pink-500/10 hover:bg-pink-500/20 text-pink-300" },
            ].map((a) => (
              <Link key={a.label} href={a.href}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-colors ${a.color}`}>
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-semibold leading-tight">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
