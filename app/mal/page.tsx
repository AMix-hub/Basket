"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

/* ─── Types ──────────────────────────────────────────────────── */
type GoalType = "win_rate" | "attendance" | "manual";

interface Goal {
  id: string;
  title: string;
  type: GoalType;
  targetValue: number;
  manualValue: number;
  season: string;
  sortOrder: number;
}

interface LiveStats {
  wins: number;
  matchesPlayed: number;
  attendancePct: number;
}

/* ─── Helpers ─────────────────────────────────────────────────── */
function currentSeason() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 7 ? `${y}–${y + 1}` : `${y - 1}–${y}`;
}

function parseWin(result: string, homeOrAway: string): boolean | null {
  const parts = result.trim().split(/[-–:]/);
  if (parts.length < 2) return null;
  const a = parseInt(parts[0]);
  const b = parseInt(parts[1]);
  if (isNaN(a) || isNaN(b)) return null;
  return homeOrAway === "home" ? a > b : b > a;
}

function progressColor(pct: number, target: number) {
  const ratio = pct / target;
  if (ratio >= 1) return "bg-emerald-500";
  if (ratio >= 0.7) return "bg-amber-400";
  return "bg-red-500";
}

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  win_rate:   "Vinstandel",
  attendance: "Närvaro",
  manual:     "Eget mål",
};
const GOAL_TYPE_ICONS: Record<GoalType, string> = {
  win_rate:   "🏆",
  attendance: "📋",
  manual:     "✏️",
};

const PRESETS: { title: string; type: GoalType; target: number }[] = [
  { title: "Vinna 60% av matcherna",    type: "win_rate",   target: 60 },
  { title: "Vinna 75% av matcherna",    type: "win_rate",   target: 75 },
  { title: "80% närvaro på träningar",  type: "attendance", target: 80 },
  { title: "90% närvaro på träningar",  type: "attendance", target: 90 },
];

/* ═══════════════════════════════════════════════════════════════ */
export default function MalPage() {
  const { user, getMyTeams } = useAuth();
  const teams = getMyTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const activeTeam = teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null;
  const canEdit = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;
  const season = currentSeason();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats>({ wins: 0, matchesPlayed: 0, attendancePct: 0 });
  const [loading, setLoading] = useState(true);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<GoalType>("win_rate");
  const [formTarget, setFormTarget] = useState("60");
  const [saving, setSaving] = useState(false);

  /* ── Load goals ── */
  const loadGoals = useCallback(async () => {
    if (!activeTeam) { setLoading(false); return; }
    const { data } = await supabase
      .from("season_goals")
      .select("id, title, type, target_value, manual_value, season, sort_order")
      .eq("team_id", activeTeam.id)
      .eq("season", season)
      .order("sort_order");
    setGoals((data ?? []).map((d) => ({
      id: d.id, title: d.title, type: d.type as GoalType,
      targetValue: d.target_value, manualValue: d.manual_value ?? 0,
      season: d.season, sortOrder: d.sort_order ?? 0,
    })));
    setLoading(false);
  }, [activeTeam?.id, season]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load live stats ── */
  const loadLiveStats = useCallback(async () => {
    if (!activeTeam) return;

    // Matches with results
    const today = new Date().toISOString().slice(0, 10);
    const { data: matches } = await supabase
      .from("sessions")
      .select("result, home_or_away")
      .eq("team_id", activeTeam.id)
      .eq("type", "match")
      .lte("date", today)
      .not("result", "is", null);

    let wins = 0;
    const matchesPlayed = (matches ?? []).length;
    for (const m of matches ?? []) {
      if (m.result && parseWin(m.result, m.home_or_away ?? "home") === true) wins++;
    }

    // Attendance
    const { data: att } = await supabase
      .from("attendance")
      .select("status")
      .eq("team_id", activeTeam.id);
    const total = (att ?? []).length;
    const present = (att ?? []).filter((a) => a.status === "present").length;
    const attendancePct = total > 0 ? Math.round((present / total) * 100) : 0;

    setLiveStats({ wins, matchesPlayed, attendancePct });
  }, [activeTeam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadGoals(); loadLiveStats(); }, [loadGoals, loadLiveStats]);

  /* ── Compute actual value for a goal ── */
  function getActual(goal: Goal): { value: number; detail: string } {
    if (goal.type === "win_rate") {
      const pct = liveStats.matchesPlayed > 0
        ? Math.round((liveStats.wins / liveStats.matchesPlayed) * 100)
        : 0;
      return { value: pct, detail: `${liveStats.wins} vinster av ${liveStats.matchesPlayed} matcher` };
    }
    if (goal.type === "attendance") {
      return { value: liveStats.attendancePct, detail: `${liveStats.attendancePct}% genomsnittlig närvaro` };
    }
    return { value: goal.manualValue, detail: `${goal.manualValue} av ${goal.targetValue}` };
  }

  /* ── Add goal ── */
  const addGoal = async () => {
    if (!formTitle.trim() || !activeTeam) return;
    setSaving(true);
    const { error } = await supabase.from("season_goals").insert({
      team_id: activeTeam.id,
      title: formTitle.trim(),
      type: formType,
      target_value: parseInt(formTarget) || 100,
      manual_value: 0,
      season,
      sort_order: goals.length,
    });
    setSaving(false);
    if (error) { toast("Kunde inte spara målet.", "error"); return; }
    setFormTitle(""); setFormType("win_rate"); setFormTarget("60"); setShowForm(false);
    loadGoals();
    toast("Mål sparat!", "success");
  };

  /* ── Update manual value ── */
  const updateManual = async (goal: Goal, delta: number) => {
    const next = Math.max(0, Math.min(goal.targetValue, goal.manualValue + delta));
    setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, manualValue: next } : g));
    await supabase.from("season_goals").update({ manual_value: next }).eq("id", goal.id);
  };

  /* ── Delete goal ── */
  const deleteGoal = async (id: string) => {
    if (!confirm("Ta bort målet?")) return;
    await supabase.from("season_goals").delete().eq("id", id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
    toast("Mål borttaget.", "success");
  };

  /* ── Apply preset ── */
  const applyPreset = (p: typeof PRESETS[number]) => {
    setFormTitle(p.title);
    setFormType(p.type);
    setFormTarget(String(p.target));
    setShowForm(true);
  };

  if (!activeTeam) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <span className="text-5xl">🎯</span>
        <p className="text-slate-400 text-sm">Du tillhör inget lag ännu.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-12 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎯</span>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Säsongsmål</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-slate-400">Säsong {season}</span>
            {teams.length > 1 && (
              <select
                value={activeTeam.id}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="text-xs bg-slate-700 border border-slate-600 text-slate-300 px-2 py-1 rounded-lg focus:outline-none"
              >
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {showForm ? "Avbryt" : "+ Nytt mål"}
          </button>
        )}
      </div>

      {/* Live stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Matcher spelade", value: liveStats.matchesPlayed, icon: "⚽" },
          { label: "Vinster", value: liveStats.wins, icon: "🏆" },
          { label: "Vinstandel", value: liveStats.matchesPlayed > 0 ? `${Math.round((liveStats.wins / liveStats.matchesPlayed) * 100)}%` : "–", icon: "📈" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-extrabold text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && canEdit && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold text-slate-100">Nytt säsongsmål</h2>

          {/* Presets */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Snabbval:</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.title} onClick={() => applyPreset(p)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 border-dashed transition-colors">
                  {p.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Beskrivning <span className="text-red-400">*</span></label>
            <input
              autoFocus
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addGoal(); }}
              placeholder="T.ex. Vinna minst 60% av matcherna"
              className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Typ</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as GoalType)}
                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
              >
                <option value="win_rate">🏆 Vinstandel (auto)</option>
                <option value="attendance">📋 Närvaro (auto)</option>
                <option value="manual">✏️ Eget mål (manuellt)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                {formType === "manual" ? "Målvärde" : "Målprocent (%)"}
              </label>
              <input
                type="number"
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                min={1}
                max={formType === "manual" ? 9999 : 100}
                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={addGoal} disabled={saving || !formTitle.trim()}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? "Sparar…" : "Spara mål"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Goals list */}
      {loading ? (
        <p className="text-center text-slate-500 py-12">Laddar mål…</p>
      ) : goals.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-slate-400 text-sm mb-1">Inga säsongsmål satta ännu.</p>
          {canEdit && <p className="text-slate-500 text-xs">Klicka "+ Nytt mål" för att sätta ett mål för säsongen.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const { value, detail } = getActual(goal);
            const pct = goal.type === "manual"
              ? Math.round((value / goal.targetValue) * 100)
              : value;
            const reached = pct >= goal.targetValue;

            return (
              <div key={goal.id} className={`bg-slate-800 border rounded-2xl p-5 ${reached ? "border-emerald-500/40" : "border-slate-700"}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span>{GOAL_TYPE_ICONS[goal.type]}</span>
                      <p className="font-bold text-slate-100 text-sm">{goal.title}</p>
                      {reached && <span className="text-xs font-bold text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">✓ Uppnått!</span>}
                    </div>
                    <p className="text-xs text-slate-500">
                      {GOAL_TYPE_LABELS[goal.type]}
                      {goal.type !== "manual" && " · automatisk spårning"}
                    </p>
                  </div>
                  {canEdit && (
                    <button onClick={() => deleteGoal(goal.id)}
                      className="text-slate-600 hover:text-red-400 text-xs transition-colors shrink-0 px-1">
                      ✕
                    </button>
                  )}
                </div>

                {/* Progress */}
                <div className="flex items-end gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className={`text-3xl font-extrabold ${reached ? "text-emerald-400" : "text-slate-100"}`}>
                        {goal.type === "manual" ? value : `${pct}%`}
                      </span>
                      <span className="text-sm text-slate-500">
                        mål: {goal.type === "manual" ? goal.targetValue : `${goal.targetValue}%`}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressColor(pct, goal.targetValue)}`}
                        style={{ width: `${Math.min((pct / goal.targetValue) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">{detail}</p>
                  </div>
                </div>

                {/* Manual controls */}
                {goal.type === "manual" && canEdit && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700">
                    <span className="text-xs text-slate-500 flex-1">Uppdatera manuellt:</span>
                    <div className="flex items-center gap-1">
                      {[-10, -1, +1, +10].map((d) => (
                        <button key={d} onClick={() => updateManual(goal, d)}
                          className={`w-9 h-8 text-xs font-bold rounded-lg transition-colors ${
                            d < 0
                              ? "bg-slate-700 hover:bg-red-900/40 text-slate-300 hover:text-red-300"
                              : "bg-slate-700 hover:bg-emerald-900/40 text-slate-300 hover:text-emerald-300"
                          }`}>
                          {d > 0 ? `+${d}` : d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Attendance note */}
      {goals.some((g) => g.type === "attendance") && liveStats.attendancePct === 0 && (
        <p className="text-xs text-slate-500 text-center">
          Närvaro räknas när tränare markerar närvaro i kalender-passen.
        </p>
      )}
    </div>
  );
}
