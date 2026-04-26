"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";

interface Match {
  id: string;
  date: string;
  title: string;
  time: string;
  opponent: string;
  homeOrAway: "home" | "away";
  result: string;
  teamId: string;
  teamName: string;
}

const DAY_NAMES = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
const MONTHS_SV = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];

function formatDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${DAY_NAMES[dt.getDay()]} ${dt.getDate()} ${MONTHS_SV[dt.getMonth()]} ${dt.getFullYear()}`;
}

export default function MatcherPage() {
  const { user, getMyTeams } = useAuth();
  const teams = getMyTeams();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMatches = useCallback(async () => {
    if (!teams.length) { setLoading(false); return; }
    const teamIds = teams.map((t) => t.id);
    const { data } = await supabase
      .from("sessions")
      .select("id, date, title, time, opponent, home_or_away, result, team_id")
      .in("team_id", teamIds)
      .eq("type", "match")
      .order("date", { ascending: false });

    const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));
    setMatches(
      (data ?? []).map((m) => ({
        id: m.id,
        date: m.date,
        title: m.title,
        time: m.time ?? "",
        opponent: m.opponent ?? "",
        homeOrAway: m.home_or_away ?? "home",
        result: m.result ?? "",
        teamId: m.team_id,
        teamName: teamMap[m.team_id] ?? "",
      }))
    );
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.map((t) => t.id).join(",")]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...matches.filter((m) => m.date >= today)].reverse();
  const past = matches.filter((m) => m.date < today);
  const multiTeam = teams.length > 1;

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-slate-500">Du behöver logga in.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">⚔️</span>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Matcher</h1>
        </div>
        <p className="text-slate-500 text-sm">Kommande och genomförda matcher.</p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Laddar matcher…</p>
      ) : matches.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">⚔️</p>
          <p className="text-slate-500 text-sm">Inga matcher inlagda ännu.</p>
          <Link href="/kalender" className="inline-block mt-4 text-sm text-orange-500 hover:underline font-semibold">
            Lägg till i kalendern →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Upcoming */}
          <section>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Kommande matcher ({upcoming.length})
            </p>
            {upcoming.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 text-center">
                <p className="text-slate-400 text-sm">Inga kommande matcher schemalagda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((m) => (
                  <MatchCard key={m.id} match={m} isPast={false} multiTeam={multiTeam} />
                ))}
              </div>
            )}
          </section>

          {/* Past */}
          {past.length > 0 && (
            <section>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Genomförda matcher ({past.length})
              </p>
              <div className="space-y-3">
                {past.map((m) => (
                  <MatchCard key={m.id} match={m} isPast={true} multiTeam={multiTeam} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, isPast, multiTeam }: { match: Match; isPast: boolean; multiTeam: boolean }) {
  return (
    <Link
      href={`/session/${match.id}`}
      className={`flex items-center gap-4 rounded-2xl p-4 border transition-colors hover:opacity-90 ${
        isPast
          ? "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
          : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40"
      }`}
    >
      {/* Date block */}
      <div className={`shrink-0 w-14 text-center rounded-xl py-2 ${
        isPast ? "bg-gray-100 dark:bg-slate-700" : "bg-red-100 dark:bg-red-900/30"
      }`}>
        {(() => {
          const dt = new Date(match.date + "T12:00:00");
          return (
            <>
              <p className={`text-xs font-semibold ${isPast ? "text-slate-400 dark:text-slate-500" : "text-red-500 dark:text-red-400"}`}>
                {["Sön","Mån","Tis","Ons","Tor","Fre","Lör"][dt.getDay()]}
              </p>
              <p className={`text-2xl font-extrabold leading-none ${isPast ? "text-slate-600 dark:text-slate-300" : "text-red-600 dark:text-red-300"}`}>
                {dt.getDate()}
              </p>
              <p className={`text-xs ${isPast ? "text-slate-400 dark:text-slate-500" : "text-red-500 dark:text-red-400"}`}>
                {["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"][dt.getMonth()]}
              </p>
            </>
          );
        })()}
      </div>

      {/* Match info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {match.opponent ? `${match.homeOrAway === "home" ? "🏠" : "✈️"} mot ${match.opponent}` : match.title}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {match.time && (
            <span className="text-xs text-slate-400 dark:text-slate-500">🕐 {match.time}</span>
          )}
          {multiTeam && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{match.teamName}</span>
          )}
          {match.homeOrAway && match.opponent && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              match.homeOrAway === "home"
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                : "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
            }`}>
              {match.homeOrAway === "home" ? "Hemma" : "Borta"}
            </span>
          )}
        </div>
      </div>

      {/* Result / arrow */}
      <div className="shrink-0 text-right">
        {isPast ? (
          match.result ? (
            <span className="text-lg font-extrabold text-emerald-500 dark:text-emerald-400 tabular-nums">
              {match.result}
            </span>
          ) : (
            <span className="text-sm text-slate-400 dark:text-slate-500 italic">–</span>
          )
        ) : (
          <span className="text-red-400 text-sm">→</span>
        )}
      </div>
    </Link>
  );
}
