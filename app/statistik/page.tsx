"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

/* ─── Types ─────────────────────────────────────────────────── */
interface Player {
  id: string;
  name: string;
  number: number;
}

interface Shot {
  id: string;
  x: number;
  y: number;
  made: boolean;
  playerId: string | null;
  timestamp: string;
}

type ViewMode = "log" | "stats" | "närvaro";

/* ─── Streak helpers ───────────────────────────────────────── */
function isoWeekKey(dateStr: string): string {
  // Returns "YYYY-WNN" for a given date string (YYYY-MM-DD)
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function calcStreak(
  playerId: string,
  sessions: { id: string; date: string; type: string }[],
  attendance: { sessionId: string; playerId: string; status: string }[],
): { current: number; best: number } {
  const trainingSessions = sessions.filter((s) => s.type === "träning");
  if (trainingSessions.length === 0) return { current: 0, best: 0 };

  const presentIds = new Set(
    attendance
      .filter((a) => a.playerId === playerId && a.status === "present")
      .map((a) => a.sessionId),
  );

  // Unique weeks that had at least one training, sorted ascending
  const allWeeks = [...new Set(trainingSessions.map((s) => isoWeekKey(s.date)))].sort();

  // Weeks where the player was present
  const attendedWeeks = new Set<string>();
  for (const s of trainingSessions) {
    if (presentIds.has(s.id)) attendedWeeks.add(isoWeekKey(s.date));
  }

  // Best streak (full scan)
  let best = 0, run = 0;
  for (const w of allWeeks) {
    if (attendedWeeks.has(w)) { run++; best = Math.max(best, run); }
    else run = 0;
  }

  // Current streak (scan backwards from most recent training week)
  let current = 0;
  for (let i = allWeeks.length - 1; i >= 0; i--) {
    if (attendedWeeks.has(allWeeks[i])) current++;
    else break;
  }

  return { current, best };
}

/* ─── Court dimensions ─────────────────────────────────────── */
const CW = 400;
const CH = 300;

function HalfCourt() {
  const line = { stroke: "rgba(255,255,255,0.85)", strokeWidth: 1.5, fill: "none" };
  return (
    <g>
      <rect x={0} y={0} width={CW} height={CH} fill="#c87428" />
      <rect x={10} y={10} width={CW - 20} height={CH - 10} {...line} />
      <line x1={10} y1={CH - 10} x2={CW - 10} y2={CH - 10} {...line} />
      <rect x={140} y={10} width={120} height={130} {...line} fill="rgba(255,255,255,0.08)" />
      <line x1={140} y1={140} x2={260} y2={140} {...line} />
      <path d={`M 140 140 A 60 60 0 0 0 260 140`} {...line} />
      <path d={`M 175 10 A 35 35 0 0 0 225 10`} {...line} />
      <line x1={165} y1={26} x2={235} y2={26} stroke="rgba(255,255,255,0.85)" strokeWidth={3} />
      <circle cx={200} cy={38} r={13} {...line} />
      <path d={`M 10 120 A 195 195 0 0 1 390 120`} {...line} />
      <line x1={10} y1={10} x2={10} y2={120} {...line} />
      <line x1={390} y1={10} x2={390} y2={120} {...line} />
    </g>
  );
}

function getZone(xPct: number, yPct: number): string {
  const x = (xPct / 100) * CW;
  const y = (yPct / 100) * CH;
  const dist = Math.sqrt((x - 200) ** 2 + (y - 38) ** 2);
  if (dist < 60) return "Nära korg";
  if (y < 145 && x > 140 && x < 260) return "Nyckeln";
  if (dist < 195) {
    if (x < 140) return "Vänster mittdistans";
    if (x > 260) return "Höger mittdistans";
    return "Mittdistans";
  }
  if (x < 100) return "Vänster hörna 3p";
  if (x > 300) return "Höger hörna 3p";
  if (y < 80) return "Top 3p";
  if (x < 200) return "Vänster 3p";
  return "Höger 3p";
}

const SHOTS_KEY = "basketball_shots";
const HIT_RADIUS    = 14; // px in SVG units to detect click on existing shot

export default function StatistikPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();
  const [players, setPlayers]         = useState<Player[]>([]);
  const [shots, setShots]             = useState<Shot[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [shotResult, setShotResult]   = useState<"made" | "missed">("made");
  const [viewMode, setViewMode]       = useState<ViewMode>("log");
  const [filterPlayerId, setFilterPlayerId] = useState<string | "all">("all");
  const [newPlayerName, setNewPlayerName]   = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  const [calSessions, setCalSessions] = useState<{ id: string; date: string; title: string; type: string }[]>([]);
  const [calAttendance, setCalAttendance] = useState<{ sessionId: string; playerId: string; status: string }[]>([]);

  useEffect(() => {
    if (!team) { setCalSessions([]); return; }
    supabase.from("sessions").select("id, date, title, type").eq("team_id", team.id)
      .then(({ data }) => setCalSessions((data ?? []).map((d) => ({ id: d.id, date: d.date, title: d.title, type: d.type }))));
  }, [team?.id]);

  useEffect(() => {
    if (!team) { setCalAttendance([]); return; }
    supabase.from("attendance").select("session_id, player_id, status").eq("team_id", team.id)
      .then(({ data }) => setCalAttendance((data ?? []).map((d) => ({ sessionId: d.session_id, playerId: d.player_id, status: d.status }))));
  }, [team?.id]);

  const loadPlayers = useCallback(async () => {
    if (!team) { setPlayers([]); return; }
    const { data } = await supabase.from("players").select("id, name, number").eq("team_id", team.id).order("number");
    setPlayers((data ?? []).map((d) => ({ id: d.id, name: d.name, number: d.number ?? 0 })));
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  useEffect(() => {
    const s = localStorage.getItem(SHOTS_KEY);
    if (s) setShots(JSON.parse(s));
  }, []);

  const saveShots = (updated: Shot[]) => {
    setShots(updated);
    localStorage.setItem(SHOTS_KEY, JSON.stringify(updated));
  };

  const getSVGCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleCourtClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (viewMode !== "log") return;
    const { x, y } = getSVGCoords(e.clientX, e.clientY);
    const svgX = (x / 100) * CW;
    const svgY = (y / 100) * CH;

    // Check if click hit an existing shot
    const hit = shots.find((s) => {
      const sx = (s.x / 100) * CW;
      const sy = (s.y / 100) * CH;
      return Math.sqrt((svgX - sx) ** 2 + (svgY - sy) ** 2) < HIT_RADIUS;
    });

    if (hit) {
      setSelectedShotId(hit.id === selectedShotId ? null : hit.id);
      return;
    }

    // Click on empty court → add new shot
    setSelectedShotId(null);
    const shot: Shot = {
      id: crypto.randomUUID(),
      x, y,
      made: shotResult === "made",
      playerId: selectedPlayerId,
      timestamp: new Date().toISOString(),
    };
    saveShots([...shots, shot]);
  };

  const toggleShotResult = (id: string) => {
    saveShots(shots.map((s) => s.id === id ? { ...s, made: !s.made } : s));
  };

  const deleteShot = (id: string) => {
    saveShots(shots.filter((s) => s.id !== id));
    if (selectedShotId === id) setSelectedShotId(null);
  };

  const addPlayer = async () => {
    if (!newPlayerName.trim() || !team) return;
    await supabase.from("players").insert({ team_id: team.id, name: newPlayerName.trim(), number: parseInt(newPlayerNumber) || 0 });
    setNewPlayerName("");
    setNewPlayerNumber("");
    loadPlayers();
  };

  const deletePlayer = async (id: string) => {
    await supabase.from("players").delete().eq("id", id);
    loadPlayers();
  };

  const getPlayerStats = (playerId: string | null) => {
    const ps = playerId ? shots.filter((s) => s.playerId === playerId) : shots;
    const made = ps.filter((s) => s.made).length;
    return { made, attempted: ps.length, percentage: ps.length > 0 ? Math.round((made / ps.length) * 100) : 0 };
  };

  const getZoneStats = (filteredShots: Shot[]) => {
    const zoneMap: Record<string, { made: number; attempted: number }> = {};
    filteredShots.forEach((s) => {
      const zone = getZone(s.x, s.y);
      if (!zoneMap[zone]) zoneMap[zone] = { made: 0, attempted: 0 };
      zoneMap[zone].attempted++;
      if (s.made) zoneMap[zone].made++;
    });
    return Object.entries(zoneMap)
      .map(([zone, stats]) => ({ zone, ...stats, percentage: Math.round((stats.made / stats.attempted) * 100) }))
      .sort((a, b) => b.attempted - a.attempted);
  };

  const displayShots = filterPlayerId === "all" ? shots : shots.filter((s) => s.playerId === filterPlayerId);
  const zoneStats = getZoneStats(displayShots);
  const overallStats = {
    made: displayShots.filter((s) => s.made).length,
    attempted: displayShots.length,
    percentage: displayShots.length > 0 ? Math.round((displayShots.filter((s) => s.made).length / displayShots.length) * 100) : 0,
  };

  const selectedShot = shots.find((s) => s.id === selectedShotId) ?? null;

  const recentShots = [...shots].reverse().slice(0, 15);

  if (user?.roles.some((r) => ["player", "parent"].includes(r))) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-slate-600">Den här sidan är inte tillgänglig för spelare och föräldrar.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎯</span>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Shot Tracker & Statistik</h1>
        </div>
        <p className="text-slate-500 text-sm">Klicka på planen för att logga skott. Klicka på ett befintligt skott för att redigera.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["log", "stats", "närvaro"] as const).map((tab) => (
          <button key={tab} onClick={() => setViewMode(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${viewMode === tab ? "bg-orange-500 text-white" : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/30"}`}>
            {tab === "log" ? "🏀 Logga skott" : tab === "stats" ? "📊 Statistik" : "📋 Närvaro"}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">

        {/* Court */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CW} ${CH}`}
              className={`w-full select-none ${viewMode === "log" ? "cursor-crosshair" : "cursor-default"}`}
              onPointerUp={handleCourtClick}
            >
              <HalfCourt />
              {displayShots.map((s) => {
                const cx = (s.x / 100) * CW;
                const cy = (s.y / 100) * CH;
                const isSelected = s.id === selectedShotId;
                return (
                  <g key={s.id}>
                    {isSelected && <circle cx={cx} cy={cy} r={14} fill="none" stroke="#facc15" strokeWidth={2} strokeDasharray="4 2" />}
                    {s.made ? (
                      <circle cx={cx} cy={cy} r={7} fill="#22c55e" stroke="white" strokeWidth={1.5} opacity={0.9} />
                    ) : (
                      <g transform={`translate(${cx},${cy})`}>
                        <circle r={7} fill="#ef4444" stroke="white" strokeWidth={1.5} opacity={0.9} />
                        <line x1={-4} y1={-4} x2={4} y2={4} stroke="white" strokeWidth={1.5} />
                        <line x1={4} y1={-4} x2={-4} y2={4} stroke="white" strokeWidth={1.5} />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Shot popover */}
            {selectedShot && (() => {
              const svg = svgRef.current;
              const svgRect = svg?.getBoundingClientRect();
              const containerRect = svg?.parentElement?.getBoundingClientRect();
              if (!svgRect || !containerRect) return null;
              const pctX = selectedShot.x / 100;
              const pctY = selectedShot.y / 100;
              const leftPx = (pctX * svgRect.width) + (svgRect.left - containerRect.left);
              const topPx  = (pctY * svgRect.height) + (svgRect.top - containerRect.top);
              const player = players.find((p) => p.id === selectedShot.playerId);
              return (
                <div
                  className="absolute z-10 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl p-3 flex flex-col gap-2 min-w-[160px]"
                  style={{ left: Math.min(leftPx + 16, containerRect.width - 180), top: Math.max(topPx - 80, 4) }}
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {player ? `#${player.number} ${player.name}` : "Alla spelare"} · {getZone(selectedShot.x, selectedShot.y)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleShotResult(selectedShot.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${selectedShot.made ? "bg-red-600 hover:bg-red-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
                      {selectedShot.made ? "✗ Ändra till miss" : "✓ Ändra till satt"}
                    </button>
                  </div>
                  <button
                    onClick={() => deleteShot(selectedShot.id)}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors">
                    Ta bort skott
                  </button>
                  <button
                    onClick={() => setSelectedShotId(null)}
                    className="w-full py-1 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                    Stäng
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Satt</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Miss</span>
            {viewMode === "log" && <span className="text-slate-400">Klicka på skott för att redigera</span>}
          </div>

          {/* Recent shots list */}
          {viewMode === "log" && shots.length > 0 && (
            <div className="mt-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Senaste skott</h3>
                <button onClick={() => { if (confirm("Rensa alla skott?")) saveShots([]); }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors">
                  Rensa alla
                </button>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {recentShots.map((s) => {
                  const player = players.find((p) => p.id === s.playerId);
                  return (
                    <div key={s.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${s.id === selectedShotId ? "bg-gray-200 dark:bg-slate-600" : "bg-gray-50 dark:bg-slate-900/40 hover:bg-gray-100 dark:hover:bg-slate-700"}`}
                      onClick={() => setSelectedShotId(s.id === selectedShotId ? null : s.id)}>
                      <span className={`text-xs font-bold w-12 shrink-0 ${s.made ? "text-emerald-400" : "text-red-400"}`}>
                        {s.made ? "✓ Satt" : "✗ Miss"}
                      </span>
                      <span className="text-xs text-slate-400 flex-1 min-w-0 truncate">
                        {player ? `#${player.number} ${player.name}` : "–"} · {getZone(s.x, s.y)}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); toggleShotResult(s.id); }}
                          className="text-xs px-1.5 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors">
                          ↔
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteShot(s.id); }}
                          className="text-xs px-1.5 py-0.5 rounded-lg bg-red-50 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors">
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">

          {viewMode === "log" && (
            <>
              {/* Shot result toggle */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Nästa skott</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShotResult("made")}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${shotResult === "made" ? "bg-emerald-500 text-white shadow-md scale-105" : "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-800/30"}`}>
                    ✓ Satt
                  </button>
                  <button onClick={() => setShotResult("missed")}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${shotResult === "missed" ? "bg-red-600 text-white shadow-md scale-105" : "bg-red-900/30 text-red-400 hover:bg-red-900/50"}`}>
                    ✗ Miss
                  </button>
                </div>
              </div>

              {/* Player selection */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Spelare</h3>
                  <button onClick={() => setShowPlayerForm((s) => !s)} className="text-xs text-orange-500 font-semibold hover:text-orange-600">
                    + Lägg till
                  </button>
                </div>
                {showPlayerForm && (
                  <div className="flex gap-2 mb-3">
                    <input type="number" value={newPlayerNumber} onChange={(e) => setNewPlayerNumber(e.target.value)} placeholder="#"
                      className="w-14 px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100" />
                    <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlayer()} placeholder="Namn..."
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100" />
                    <button onClick={addPlayer} disabled={!newPlayerName.trim()}
                      className="px-2 py-1.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors">+</button>
                  </div>
                )}
                <button onClick={() => setSelectedPlayerId(null)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm mb-1 font-medium transition-colors ${selectedPlayerId === null ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"}`}>
                  🏀 Alla spelare
                </button>
                {players.map((p) => (
                  <div key={p.id} className="flex items-center gap-1 mb-1">
                    <button onClick={() => setSelectedPlayerId(selectedPlayerId === p.id ? null : p.id)}
                      className={`flex-1 text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${selectedPlayerId === p.id ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"}`}>
                      #{p.number} {p.name}
                    </button>
                    <button onClick={() => deletePlayer(p.id)} className="text-slate-400 hover:text-red-500 transition-colors px-1">✕</button>
                  </div>
                ))}
                {(() => {
                  const stats = getPlayerStats(selectedPlayerId);
                  return stats.attempted > 0 ? (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 flex gap-4 text-xs">
                      <span className="text-emerald-400 font-semibold">{stats.made}/{stats.attempted} satt</span>
                      <span className="text-slate-800 dark:text-slate-100 font-bold text-sm">{stats.percentage}%</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </>
          )}

          {viewMode === "stats" && (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Visa statistik för</h3>
                <select value={filterPlayerId} onChange={(e) => setFilterPlayerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  <option value="all">Alla spelare</option>
                  {players.map((p) => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
                </select>
                {overallStats.attempted > 0 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-center flex-1">
                      <div className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{overallStats.percentage}%</div>
                      <div className="text-xs text-slate-500">Träffprocent</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-emerald-400">{overallStats.made}</div>
                      <div className="text-xs text-slate-500">Satt</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-red-400">{overallStats.attempted - overallStats.made}</div>
                      <div className="text-xs text-slate-500">Miss</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-slate-600 dark:text-slate-300">{overallStats.attempted}</div>
                      <div className="text-xs text-slate-500">Totalt</div>
                    </div>
                  </div>
                )}
              </div>

              {filterPlayerId === "all" && players.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Per spelare</h3>
                  <div className="space-y-2">
                    {players.map((p) => ({ player: p, stats: getPlayerStats(p.id) }))
                      .filter(({ stats }) => stats.attempted > 0)
                      .sort((a, b) => b.stats.percentage - a.stats.percentage)
                      .map(({ player, stats }) => (
                        <div key={player.id} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">#{player.number} {player.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${stats.percentage}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{stats.percentage}%</span>
                            <p className="text-xs text-slate-400">{stats.made}/{stats.attempted}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {zoneStats.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Per zon</h3>
                  <div className="space-y-2">
                    {zoneStats.map(({ zone, made, attempted, percentage }) => (
                      <div key={zone} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">{zone}</span>
                            <span className="text-xs text-slate-400 shrink-0 ml-2">{made}/{attempted}</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${percentage >= 50 ? "bg-emerald-400" : "bg-orange-400"}`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 w-10 text-right shrink-0">{percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {zoneStats.length === 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 text-sm text-slate-500 text-center">
                  Logga skott på planen för att se statistik här.
                </div>
              )}
            </>
          )}

          {viewMode === "närvaro" && (
            <>
              {players.length === 0 || calSessions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 text-center text-slate-500 text-sm">
                  <p className="text-2xl mb-2">📋</p>
                  {players.length === 0 ? "Lägg till spelare i Kalender-sidan för att se närvaro här." : "Inga träningspass registrerade ännu."}
                </div>
              ) : (
                <>
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Närvaro per spelare</h3>
                      <button
                        onClick={() => {
                          const trainingSessions = calSessions.filter((s) => s.type === "träning").sort((a, b) => a.date.localeCompare(b.date));
                          const header = ["Spelare", "Nummer", "Närvarande", "Totalt registrerade", "Närvaro%", ...trainingSessions.map((s) => `${s.date} ${s.title}`)];
                          const rows = players.map((p) => {
                            const att = calAttendance.filter((a) => a.playerId === p.id);
                            const present = att.filter((a) => a.status === "present").length;
                            const total = att.length;
                            const pct = total > 0 ? Math.round((present / total) * 100) : "";
                            const perSession = trainingSessions.map((s) => {
                              const a = calAttendance.find((x) => x.sessionId === s.id && x.playerId === p.id);
                              return a ? (a.status === "present" ? "Ja" : a.status === "sick" ? "Sjuk" : "Nej") : "-";
                            });
                            return [p.name, p.number, present, total, pct, ...perSession];
                          });
                          const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
                          const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url; a.download = "narvaro.csv"; a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-semibold transition-colors"
                      >
                        ⬇ Exportera CSV
                      </button>
                    </div>
                    <div className="space-y-3">
                      {[...players].sort((a, b) => {
                        const attA = calAttendance.filter((x) => x.playerId === a.id);
                        const attB = calAttendance.filter((x) => x.playerId === b.id);
                        const pctA = attA.length > 0 ? attA.filter((x) => x.status === "present").length / attA.length : -1;
                        const pctB = attB.length > 0 ? attB.filter((x) => x.status === "present").length / attB.length : -1;
                        return pctB - pctA;
                      }).map((p) => {
                        const playerAtt = calAttendance.filter((a) => a.playerId === p.id);
                        const present = playerAtt.filter((a) => a.status === "present").length;
                        const total = playerAtt.length;
                        const pct = total > 0 ? Math.round((present / total) * 100) : null;
                        const streak = calcStreak(p.id, calSessions, calAttendance);
                        return (
                          <div key={p.id} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">#{p.number} {p.name}</p>
                              <p className="text-xs text-slate-400">{present} av {total} pass</p>
                            </div>
                            {streak.current > 0 && (
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-lg shrink-0 ${streak.current >= 4 ? "bg-orange-500/20 text-orange-400" : "bg-slate-700 text-slate-400"}`}
                                title={`Bästa: ${streak.best} v`}>
                                🔥{streak.current}v
                              </span>
                            )}
                            {pct !== null ? (
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="w-20 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className={`text-sm font-bold w-10 text-right ${pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 shrink-0">Ej registrerat</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Streak leaderboard */}
                  {(() => {
                    const streaks = players
                      .map((p) => ({ player: p, ...calcStreak(p.id, calSessions, calAttendance) }))
                      .filter((r) => r.current > 0 || r.best > 0)
                      .sort((a, b) => b.current - a.current || b.best - a.best);
                    if (streaks.length === 0) return null;
                    return (
                      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">🔥 Träningssvit</h3>
                        <p className="text-xs text-slate-400 mb-3">Antal veckor i rad med minst en närvaro</p>
                        <div className="space-y-2">
                          {streaks.map((r, i) => (
                            <div key={r.player.id} className="flex items-center gap-3">
                              <span className={`text-sm font-extrabold w-5 shrink-0 text-center ${i === 0 ? "text-orange-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-slate-500"}`}>
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                  #{r.player.number} {r.player.name}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <div
                                    className="h-1.5 rounded-full bg-orange-400 transition-all"
                                    style={{ width: `${Math.min((r.current / Math.max(streaks[0].current, 1)) * 100, 100)}%`, minWidth: r.current > 0 ? "8px" : "0" }}
                                  />
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`text-base font-extrabold ${r.current >= 4 ? "text-orange-400" : "text-slate-300"}`}>
                                  {r.current}v
                                </span>
                                {r.best > r.current && (
                                  <p className="text-xs text-slate-500">bäst: {r.best}v</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Sessionshistorik</h3>
                    <div className="space-y-2">
                      {calSessions.filter((s) => s.type === "träning").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((s) => {
                        const sessAtt = calAttendance.filter((a) => a.sessionId === s.id);
                        const presentCount = sessAtt.filter((a) => a.status === "present").length;
                        const d = new Date(s.date + "T12:00:00");
                        return (
                          <Link key={s.id} href={`/session/${s.id}`}
                            className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900/40 hover:bg-gray-100 dark:hover:bg-slate-700/40 rounded-xl px-3 py-2 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{s.title}</p>
                              <p className="text-xs text-slate-400">{d.toLocaleDateString("sv-SE", { weekday: "short", month: "short", day: "numeric" })}</p>
                            </div>
                            {sessAtt.length > 0 ? (
                              <span className="text-xs font-semibold text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full shrink-0">
                                ✓ {presentCount}/{players.length}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 shrink-0">Ej registrerat</span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
