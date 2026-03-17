"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebaseClient";
import { useAuth } from "../context/AuthContext";

/* ─── Types ─────────────────────────────────────────────────── */
interface Player {
  id: string;
  name: string;
  number: number;
}

interface Shot {
  id: string;
  x: number; // 0-100 relative to court width
  y: number; // 0-100 relative to court height
  made: boolean;
  playerId: string | null;
  timestamp: string;
}

type ViewMode = "log" | "stats" | "närvaro";

/* ─── Court dimensions ────────────────────────────────────────── */
const CW = 400; // court width
const CH = 300; // court height (half-court portrait-ish)

/* ─── Half-court SVG ─────────────────────────────────────────── */
function HalfCourt() {
  const line = { stroke: "rgba(255,255,255,0.85)", strokeWidth: 1.5, fill: "none" };

  return (
    <g>
      {/* Floor */}
      <rect x={0} y={0} width={CW} height={CH} fill="#c87428" />
      {/* Court boundary */}
      <rect x={10} y={10} width={CW - 20} height={CH - 10} {...line} />
      {/* Half-court line */}
      <line x1={10} y1={CH - 10} x2={CW - 10} y2={CH - 10} {...line} />

      {/* Paint / key */}
      <rect x={140} y={10} width={120} height={130} {...line} fill="rgba(255,255,255,0.08)" />
      {/* Free throw line */}
      <line x1={140} y1={140} x2={260} y2={140} {...line} />
      {/* Free throw circle */}
      <path d={`M 140 140 A 60 60 0 0 0 260 140`} {...line} />

      {/* Restricted arc */}
      <path d={`M 175 10 A 35 35 0 0 0 225 10`} {...line} />

      {/* Backboard */}
      <line x1={165} y1={26} x2={235} y2={26} stroke="rgba(255,255,255,0.85)" strokeWidth={3} />
      {/* Basket */}
      <circle cx={200} cy={38} r={13} {...line} />

      {/* Three-point arc */}
      <path d={`M 10 120 A 195 195 0 0 1 390 120`} {...line} />
      <line x1={10} y1={10} x2={10} y2={120} {...line} />
      <line x1={390} y1={10} x2={390} y2={120} {...line} />
    </g>
  );
}

/* ─── Zone labels ─────────────────────────────────────────────── */
// Returns a zone name based on court position
function getZone(xPct: number, yPct: number): string {
  const x = (xPct / 100) * CW;
  const y = (yPct / 100) * CH;

  // Basket position
  const bx = 200;
  const by = 38;
  const dist = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);

  if (dist < 60) return "Nära korg";
  if (y < 145) {
    // In the key area
    if (x > 140 && x < 260) return "Nyckeln";
  }
  if (dist < 195) {
    if (x < 140) return "Vänster mittdistans";
    if (x > 260) return "Höger mittdistans";
    return "Mittdistans";
  }
  // Three-point territory
  if (x < 100) return "Vänster hörna 3p";
  if (x > 300) return "Höger hörna 3p";
  if (y < 80) return "Top 3p";
  if (x < 200) return "Vänster 3p";
  return "Höger 3p";
}

/* ─── Storage keys ──────────────────────────────────────────── */
const PLAYERS_KEY = "basketball_players";
const SHOTS_KEY = "basketball_shots";
const ATTENDANCE_KEY = "basketball_attendance";

/* ─── Main page ──────────────────────────────────────────────── */
export default function StatistikPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();
  const [players, setPlayers] = useState<Player[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [shotResult, setShotResult] = useState<"made" | "missed">("made");
  const [viewMode, setViewMode] = useState<ViewMode>("log");
  const [filterPlayerId, setFilterPlayerId] = useState<string | "all">("all");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [showPlayerForm, setShowPlayerForm] = useState(false);

  /* Sessions from Firestore (read-only for attendance view) */
  const [calSessions, setCalSessions] = useState<
    { id: string; date: string; title: string; type: string }[]
  >([]);
  const [calAttendance] = useState<
    { sessionId: string; playerId: string; status: string }[]
  >(() => {
    if (typeof window === "undefined") return [];
    const ca = localStorage.getItem(ATTENDANCE_KEY);
    return ca ? JSON.parse(ca) : [];
  });

  // Subscribe to Firestore sessions for the current team
  useEffect(() => {
    if (!team) {
      setCalSessions([]);
      return;
    }
    const q = query(collection(db, "sessions"), where("teamId", "==", team.id));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCalSessions(
        snap.docs.map((d) => ({
          id: d.id,
          date: d.data().date as string,
          title: d.data().title as string,
          type: d.data().type as string,
        }))
      );
    });
    return () => unsubscribe();
  }, [team]);

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const p = localStorage.getItem(PLAYERS_KEY);
    if (p) setPlayers(JSON.parse(p));
    const s = localStorage.getItem(SHOTS_KEY);
    if (s) setShots(JSON.parse(s));
  }, []);

  const savePlayers = (updated: Player[]) => {
    setPlayers(updated);
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(updated));
  };

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
    const shot: Shot = {
      id: crypto.randomUUID(),
      x,
      y,
      made: shotResult === "made",
      playerId: selectedPlayerId,
      timestamp: new Date().toISOString(),
    };
    saveShots([...shots, shot]);
  };

  const deleteShot = (id: string) => {
    saveShots(shots.filter((s) => s.id !== id));
  };

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

  /* ── Stats computation ── */
  const getPlayerStats = (playerId: string | null) => {
    const playerShots = playerId
      ? shots.filter((s) => s.playerId === playerId)
      : shots;
    const made = playerShots.filter((s) => s.made).length;
    const attempted = playerShots.length;
    return {
      made,
      attempted,
      percentage: attempted > 0 ? Math.round((made / attempted) * 100) : 0,
    };
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
      .map(([zone, stats]) => ({
        zone,
        ...stats,
        percentage: Math.round((stats.made / stats.attempted) * 100),
      }))
      .sort((a, b) => b.attempted - a.attempted);
  };

  /* ── Filtered shots for display ── */
  const displayShots =
    filterPlayerId === "all"
      ? shots
      : shots.filter((s) => s.playerId === filterPlayerId);

  const zoneStats = getZoneStats(displayShots);

  const overallStats = {
    made: displayShots.filter((s) => s.made).length,
    attempted: displayShots.length,
    percentage:
      displayShots.length > 0
        ? Math.round(
            (displayShots.filter((s) => s.made).length / displayShots.length) * 100
          )
        : 0,
  };

  if (user?.roles.some((r) => ["player", "parent"].includes(r))) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-slate-600">
            Den här sidan är inte tillgänglig för spelare och föräldrar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎯</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Shot Tracker & Statistik
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          Klicka på planen för att logga skott. Se statistik per spelare och zon.
        </p>
      </div>

      {/* View mode tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode("log")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            viewMode === "log"
              ? "bg-orange-500 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          🏀 Logga skott
        </button>
        <button
          onClick={() => setViewMode("stats")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            viewMode === "stats"
              ? "bg-orange-500 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          📊 Statistik
        </button>
        <button
          onClick={() => setViewMode("närvaro")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            viewMode === "närvaro"
              ? "bg-orange-500 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          📋 Närvaro
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Court */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CW} ${CH}`}
              className={`w-full select-none ${viewMode === "log" ? "cursor-crosshair" : "cursor-default"}`}
              onPointerUp={handleCourtClick}
            >
              <HalfCourt />

              {/* Shot dots */}
              {displayShots.map((s) => (
                <g
                  key={s.id}
                  onClick={() => viewMode === "log" && deleteShot(s.id)}
                  className={viewMode === "log" ? "cursor-pointer" : ""}
                >
                  {s.made ? (
                    <circle
                      cx={(s.x / 100) * CW}
                      cy={(s.y / 100) * CH}
                      r={7}
                      fill="#22c55e"
                      stroke="white"
                      strokeWidth={1.5}
                      opacity={0.85}
                    />
                  ) : (
                    <g
                      transform={`translate(${(s.x / 100) * CW}, ${(s.y / 100) * CH})`}
                    >
                      <circle r={7} fill="#ef4444" stroke="white" strokeWidth={1.5} opacity={0.85} />
                      <line x1={-4} y1={-4} x2={4} y2={4} stroke="white" strokeWidth={1.5} />
                      <line x1={4} y1={-4} x2={-4} y2={4} stroke="white" strokeWidth={1.5} />
                    </g>
                  )}
                </g>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              Satt
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              Miss
            </div>
            {viewMode === "log" && (
              <span className="text-slate-400">Klicka på ett skott för att ta bort det</span>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {viewMode === "log" && (
            <>
              {/* Shot result toggle */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h3 className="font-bold text-slate-900 mb-3">Skottresultat</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShotResult("made")}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      shotResult === "made"
                        ? "bg-emerald-500 text-white shadow-md scale-105"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    ✓ Satt
                  </button>
                  <button
                    onClick={() => setShotResult("missed")}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      shotResult === "missed"
                        ? "bg-red-500 text-white shadow-md scale-105"
                        : "bg-red-50 text-red-700 hover:bg-red-100"
                    }`}
                  >
                    ✗ Miss
                  </button>
                </div>
              </div>

              {/* Player selection */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900">Spelare</h3>
                  <button
                    onClick={() => setShowPlayerForm((s) => !s)}
                    className="text-xs text-orange-500 font-semibold hover:text-orange-600"
                  >
                    + Lägg till
                  </button>
                </div>

                {showPlayerForm && (
                  <div className="flex gap-2 mb-3">
                    <input
                      type="number"
                      value={newPlayerNumber}
                      onChange={(e) => setNewPlayerNumber(e.target.value)}
                      placeholder="#"
                      className="w-14 px-2 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                      placeholder="Namn..."
                      className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <button
                      onClick={addPlayer}
                      disabled={!newPlayerName.trim()}
                      className="px-2 py-1.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setSelectedPlayerId(null)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm mb-1 font-medium transition-colors ${
                    selectedPlayerId === null
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  🏀 Alla spelare
                </button>
                {players.map((p) => (
                  <div key={p.id} className="flex items-center gap-1 mb-1">
                    <button
                      onClick={() =>
                        setSelectedPlayerId(
                          selectedPlayerId === p.id ? null : p.id
                        )
                      }
                      className={`flex-1 text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        selectedPlayerId === p.id
                          ? "bg-orange-500 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      #{p.number} {p.name}
                    </button>
                    <button
                      onClick={() => deletePlayer(p.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Quick stats for selected player */}
                {(() => {
                  const stats = getPlayerStats(selectedPlayerId);
                  return stats.attempted > 0 ? (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4 text-xs">
                      <span className="text-emerald-600 font-semibold">
                        {stats.made}/{stats.attempted} satt
                      </span>
                      <span className="text-slate-700 font-bold text-sm">
                        {stats.percentage}%
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
            </>
          )}

          {viewMode === "stats" && (
            <>
              {/* Filter */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <h3 className="font-bold text-slate-900 mb-3">Visa statistik för</h3>
                <select
                  value={filterPlayerId}
                  onChange={(e) => setFilterPlayerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                >
                  <option value="all">Alla spelare</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.number} {p.name}
                    </option>
                  ))}
                </select>

                {/* Overall stat */}
                {overallStats.attempted > 0 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-center flex-1">
                      <div className="text-3xl font-extrabold text-slate-900">
                        {overallStats.percentage}%
                      </div>
                      <div className="text-xs text-slate-500">Träffprocent</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-emerald-600">
                        {overallStats.made}
                      </div>
                      <div className="text-xs text-slate-500">Satt</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-red-500">
                        {overallStats.attempted - overallStats.made}
                      </div>
                      <div className="text-xs text-slate-500">Miss</div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-2xl font-bold text-slate-700">
                        {overallStats.attempted}
                      </div>
                      <div className="text-xs text-slate-500">Totalt</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Per-player breakdown */}
              {filterPlayerId === "all" && players.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <h3 className="font-bold text-slate-900 mb-3">Per spelare</h3>
                  <div className="space-y-2">
                    {players
                      .map((p) => ({ player: p, stats: getPlayerStats(p.id) }))
                      .filter(({ stats }) => stats.attempted > 0)
                      .sort((a, b) => b.stats.percentage - a.stats.percentage)
                      .map(({ player, stats }) => (
                        <div key={player.id} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              #{player.number} {player.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-orange-400 rounded-full transition-all"
                                  style={{ width: `${stats.percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm font-bold text-slate-900">
                              {stats.percentage}%
                            </span>
                            <p className="text-xs text-slate-400">
                              {stats.made}/{stats.attempted}
                            </p>
                          </div>
                        </div>
                      ))}
                    {players.every((p) => getPlayerStats(p.id).attempted === 0) && (
                      <p className="text-slate-400 text-sm">Inga skott loggade än.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Zone breakdown */}
              {zoneStats.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <h3 className="font-bold text-slate-900 mb-3">Per zon</h3>
                  <div className="space-y-2">
                    {zoneStats.map(({ zone, made, attempted, percentage }) => (
                      <div key={zone} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium text-slate-700 truncate">
                              {zone}
                            </span>
                            <span className="text-xs text-slate-400 shrink-0 ml-2">
                              {made}/{attempted}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percentage >= 50 ? "bg-emerald-400" : "bg-orange-400"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-slate-900 w-10 text-right shrink-0">
                          {percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {zoneStats.length === 0 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-sm text-slate-500 text-center">
                  Logga skott på planen för att se statistik här.
                </div>
              )}
            </>
          )}

          {/* ── Attendance view ── */}
          {viewMode === "närvaro" && (
            <>
              {players.length === 0 || calSessions.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
                  <p className="text-2xl mb-2">📋</p>
                  {players.length === 0
                    ? "Lägg till spelare i Kalender-sidan för att se närvaro här."
                    : "Inga träningspass registrerade i Kalender-sidan ännu."}
                </div>
              ) : (
                <>
                  {/* Per-player attendance summary */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
                    <h3 className="font-bold text-slate-900 mb-3">Närvaro per spelare</h3>
                    <div className="space-y-3">
                      {players.map((p) => {
                        const playerAtt = calAttendance.filter(
                          (a) => a.playerId === p.id
                        );
                        const present = playerAtt.filter(
                          (a) => a.status === "present"
                        ).length;
                        const total = playerAtt.length;
                        const pct =
                          total > 0 ? Math.round((present / total) * 100) : null;
                        return (
                          <div key={p.id} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">
                                #{p.number} {p.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {present} av {total} pass
                              </p>
                            </div>
                            {pct !== null ? (
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      pct >= 70
                                        ? "bg-emerald-400"
                                        : pct >= 40
                                        ? "bg-amber-400"
                                        : "bg-red-400"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span
                                  className={`text-sm font-bold w-10 text-right ${
                                    pct >= 70
                                      ? "text-emerald-600"
                                      : pct >= 40
                                      ? "text-amber-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {pct}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 shrink-0">
                                Ej registrerat
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Session history */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <h3 className="font-bold text-slate-900 mb-3">
                      Sessionshistorik
                    </h3>
                    <div className="space-y-2">
                      {calSessions
                        .filter((s) => s.type === "träning")
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .slice(0, 10)
                        .map((s) => {
                          const sessAtt = calAttendance.filter(
                            (a) => a.sessionId === s.id
                          );
                          const presentCount = sessAtt.filter(
                            (a) => a.status === "present"
                          ).length;
                          const d = new Date(s.date + "T12:00:00");
                          return (
                            <div
                              key={s.id}
                              className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {s.title}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {d.toLocaleDateString("sv-SE", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </p>
                              </div>
                              {sessAtt.length > 0 ? (
                                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                  ✓ {presentCount}/{players.length} spelare
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
