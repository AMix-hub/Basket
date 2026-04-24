"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { toast } from "../../../lib/toast";
import { autoTag, TAG_LABELS, TAG_COLORS, ALL_TAGS } from "../../../lib/exerciseTags";
import type { ExerciseTag } from "../../data/types";
import { year1Plan } from "../../data/year1";
import { year2Plan } from "../../data/year2";
import { year3Plan } from "../../data/year3";
import { extraExercises } from "../../data/extraExercises";

// ─── Types ─────────────────────────────────────────────────────────────────

interface PlanActivity {
  name: string;
  description: string;
  tips?: string;
  durationMinutes?: number;
  intensityLevel?: 1 | 2 | 3;
  /** True when the activity comes from the team's custom exercises */
  isCustom?: boolean;
}

interface PlanSession {
  number: number;
  title: string;
  activities: PlanActivity[];
}

interface CustomSeasonPlan {
  id: string;
  teamId: string;
  name: string;
  description: string;
  sessions: PlanSession[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamExercise {
  id: string;
  name: string;
  description: string;
  durationMinutes?: number;
  intensityLevel?: 1 | 2 | 3;
  createdBy: string;
  createdAt: string;
}

interface BrowsableExercise {
  name: string;
  description: string;
  tips?: string;
  durationMinutes?: number;
  intensityLevel?: 1 | 2 | 3;
  computedTags: ExerciseTag[];
  source: string;
  /** planYear for year-plan exercises */
  planYear?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];

function formatDate(isoDate: string) {
  const d = new Date(isoDate);
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ArsplaneringPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();

  const canEdit =
    user?.roles.some((r) => r === "coach" || r === "admin" || r === "assistant") ?? false;

  // ── Custom plans ─────────────────────────────────────────────────────────
  const [plans, setPlans] = useState<CustomSeasonPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const loadPlans = useCallback(async () => {
    if (!team) { setLoadingPlans(false); return; }
    const { data } = await supabase.from("custom_season_plans").select("*").eq("team_id", team.id);
    setPlans((data ?? []).map((d) => ({
      id: d.id, teamId: d.team_id, name: d.name,
      description: "", sessions: (d.data?.sessions as PlanSession[]) ?? [],
      createdBy: d.created_by ?? "", createdAt: d.created_at, updatedAt: d.updated_at,
    })));
    setLoadingPlans(false);
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!team) { setLoadingPlans(false); return; }
    loadPlans();
    const ch = supabase.channel(`season-plans:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_season_plans", filter: `team_id=eq.${team.id}` }, loadPlans)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [team?.id, loadPlans]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Team custom exercises ────────────────────────────────────────────────
  const [teamExercises, setTeamExercises] = useState<TeamExercise[]>([]);

  useEffect(() => {
    if (!team) return;
    let mounted2 = true;
    supabase.from("team_exercises").select("*").eq("team_id", team.id)
      .then(({ data }) => {
        if (!mounted2) return;
        setTeamExercises((data ?? []).map((d) => ({
          id: d.id, name: d.title, description: d.description ?? "",
          createdBy: d.created_by ?? "", createdAt: d.created_at,
        })));
      });
    return () => { mounted2 = false; };
  }, [team]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── All browsable exercises (db + extra + custom) ────────────────────────
  const allBrowsable = useMemo<BrowsableExercise[]>(() => {
    const yearPlanExercises = [year1Plan, year2Plan, year3Plan].flatMap((plan) =>
      plan.sessions.flatMap((session) =>
        session.activities.map((a) => ({
          ...a,
          computedTags: autoTag(a),
          source: `År ${plan.year} – ${session.title}`,
          planYear: plan.year,
        }))
      )
    );
    const extra = extraExercises.map((e) => ({
      ...e,
      computedTags: autoTag(e),
      source: e.source ?? "Extra övningar",
    }));
    const custom = teamExercises.map((e) => ({
      name: e.name,
      description: e.description,
      durationMinutes: e.durationMinutes,
      intensityLevel: e.intensityLevel,
      computedTags: autoTag({ name: e.name, description: e.description }),
      source: "Egna övningar",
      isCustom: true,
    }));
    return [...yearPlanExercises, ...extra, ...custom];
  }, [teamExercises]);

  // ── Create new plan state ────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [newPlanSessions, setNewPlanSessions] = useState(12);
  const [creatingPlan, setCreatingPlan] = useState(false);

  const createPlan = async () => {
    if (!team || !user || !newPlanName.trim()) return;
    setCreatingPlan(true);
    try {
      const sessions: PlanSession[] = Array.from({ length: newPlanSessions }, (_, i) => ({
        number: i + 1,
        title: `Träning ${i + 1}`,
        activities: [],
      }));
      const { error } = await supabase.from("custom_season_plans").insert({
        team_id: team.id,
        name: newPlanName.trim(),
        data: { sessions },
        created_by: user.id,
      });
      if (error) { toast("Kunde inte skapa planeringen.", "error"); return; }
      toast("Årsplanering skapad!", "success");
      loadPlans();
      setShowCreateModal(false);
      setNewPlanName("");
      setNewPlanDesc("");
      setNewPlanSessions(12);
    } finally {
      setCreatingPlan(false);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!canEdit) return;
    if (!confirm("Är du säker på att du vill ta bort årsplaneringen? Detta kan inte ångras."))
      return;
    const { error } = await supabase.from("custom_season_plans").delete().eq("id", planId);
    if (error) { toast("Kunde inte ta bort planeringen.", "error"); return; }
    toast("Årsplanering borttagen.", "info");
    loadPlans();
  };

  // ── Plan editor state ────────────────────────────────────────────────────
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const editingPlan = plans.find((p) => p.id === editingPlanId) ?? null;

  // Session being edited inside the plan
  const [editingSessionIdx, setEditingSessionIdx] = useState<number | null>(null);

  // Exercise picker (shown when editing a session)
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTag, setPickerTag] = useState<ExerciseTag | null>(null);

  const filteredPicker = useMemo(() => {
    return allBrowsable.filter((ex) => {
      const matchTag = !pickerTag || ex.computedTags.includes(pickerTag);
      const matchSearch =
        !pickerSearch.trim() ||
        ex.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        ex.description.toLowerCase().includes(pickerSearch.toLowerCase());
      return matchTag && matchSearch;
    });
  }, [allBrowsable, pickerTag, pickerSearch]);

  // Rename session
  const [renamingSessionIdx, setRenamingSessionIdx] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const addActivityToSession = async (exercise: BrowsableExercise) => {
    if (!editingPlan || editingSessionIdx === null || !canEdit) return;
    const updated = editingPlan.sessions.map((s, idx) => {
      if (idx !== editingSessionIdx) return s;
      return {
        ...s,
        activities: [
          ...s.activities,
          {
            name: exercise.name,
            description: exercise.description,
            tips: exercise.tips,
            durationMinutes: exercise.durationMinutes,
            intensityLevel: exercise.intensityLevel,
          },
        ],
      };
    });
    await supabase.from("custom_season_plans").update({ data: { sessions: updated } }).eq("id", editingPlan.id);
  };

  const removeActivityFromSession = async (sessionIdx: number, activityIdx: number) => {
    if (!editingPlan || !canEdit) return;
    const updated = editingPlan.sessions.map((s, idx) => {
      if (idx !== sessionIdx) return s;
      return {
        ...s,
        activities: s.activities.filter((_, ai) => ai !== activityIdx),
      };
    });
    await supabase.from("custom_season_plans").update({ data: { sessions: updated } }).eq("id", editingPlan.id);
  };

  const renameSession = async (sessionIdx: number, newTitle: string) => {
    if (!editingPlan || !canEdit) return;
    const updated = editingPlan.sessions.map((s, idx) =>
      idx === sessionIdx ? { ...s, title: newTitle } : s
    );
    await supabase.from("custom_season_plans").update({ data: { sessions: updated } }).eq("id", editingPlan.id);
    setRenamingSessionIdx(null);
    setRenameDraft("");
  };

  // ── Access guard ─────────────────────────────────────────────────────────
  if (user?.roles.some((r) => ["player", "parent"].includes(r))) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-slate-400">
            Den här sidan är inte tillgänglig för spelare och föräldrar.
          </p>
        </div>
      </div>
    );
  }

  // ── Plan editor view ─────────────────────────────────────────────────────
  if (editingPlan) {
    return (
      <div className="max-w-5xl mx-auto py-6 px-4">
        {/* Back */}
        <button
          onClick={() => {
            setEditingPlanId(null);
            setEditingSessionIdx(null);
          }}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6"
        >
          ← Tillbaka till mina årsplaneringar
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{editingPlan.name}</h1>
            {editingPlan.description && (
              <p className="text-slate-400 text-sm mt-1">{editingPlan.description}</p>
            )}
          </div>
          <span className="text-xs text-slate-500 shrink-0 mt-1">
            {editingPlan.sessions.length} träningspass
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Session list */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Träningspass
            </h2>
            {editingPlan.sessions.map((session, idx) => {
              const isActive = editingSessionIdx === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-xl border transition-all ${
                    isActive
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-slate-700 bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="w-7 h-7 rounded-full bg-slate-700 text-slate-300 text-xs flex items-center justify-center font-bold shrink-0">
                      {session.number}
                    </span>
                    {renamingSessionIdx === idx ? (
                      <input
                        className="flex-1 bg-slate-700 text-white text-sm rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={renameDraft}
                        autoFocus
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameSession(idx, renameDraft);
                          if (e.key === "Escape") {
                            setRenamingSessionIdx(null);
                            setRenameDraft("");
                          }
                        }}
                      />
                    ) : (
                      <button
                        className="flex-1 text-left text-sm font-medium text-slate-200"
                        onClick={() => setEditingSessionIdx(isActive ? null : idx)}
                      >
                        {session.title}
                      </button>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-500">
                        {session.activities.length} övn.
                      </span>
                      {canEdit && renamingSessionIdx !== idx && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingSessionIdx(idx);
                            setRenameDraft(session.title);
                          }}
                          className="text-slate-500 hover:text-slate-300 text-xs px-1"
                          title="Byt namn"
                        >
                          ✏️
                        </button>
                      )}
                      {renamingSessionIdx === idx && (
                        <>
                          <button
                            onClick={() => renameSession(idx, renameDraft)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 px-1"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setRenamingSessionIdx(null);
                              setRenameDraft("");
                            }}
                            className="text-xs text-slate-500 hover:text-slate-300 px-1"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Activities in session */}
                  {session.activities.length > 0 && (
                    <div className="px-4 pb-3 space-y-1.5">
                      {session.activities.map((act, ai) => (
                        <div
                          key={ai}
                          className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-1.5"
                        >
                          <span className="flex-1 text-xs text-slate-300 truncate">{act.name}</span>
                          {canEdit && (
                            <button
                              onClick={() => removeActivityFromSession(idx, ai)}
                              className="text-slate-500 hover:text-red-400 text-xs"
                              title="Ta bort övning"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isActive && canEdit && (
                    <div className="px-4 pb-3">
                      <p className="text-xs text-orange-400 font-medium">
                        → Välj övning från banken till höger
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Exercise picker */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Övningsbank
            </h2>
            {editingSessionIdx === null ? (
              <p className="text-slate-500 text-sm py-4 text-center">
                Klicka på ett träningspass för att lägga till övningar.
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-3">
                  Lägger till i:{" "}
                  <strong className="text-slate-200">
                    {editingPlan.sessions[editingSessionIdx].title}
                  </strong>
                </p>

                {/* Search */}
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Sök övning…"
                  className="w-full px-3 py-2 text-sm bg-slate-700 text-slate-200 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 mb-3"
                />

                {/* Tag filter */}
                <div className="flex flex-wrap gap-1 mb-3">
                  <button
                    onClick={() => setPickerTag(null)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      pickerTag === null ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    }`}
                  >
                    Alla
                  </button>
                  {ALL_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setPickerTag(pickerTag === tag ? null : tag)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        pickerTag === tag ? "bg-orange-500 text-white" : `${TAG_COLORS[tag]} hover:opacity-80`
                      }`}
                    >
                      {TAG_LABELS[tag]}
                    </button>
                  ))}
                </div>

                {/* Exercise list */}
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredPicker.slice(0, 50).map((ex, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg px-3 py-2 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">{ex.name}</p>
                        <p className="text-xs text-slate-500 truncate">{ex.source}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {ex.computedTags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className={`text-xs px-1.5 py-0.5 rounded-full ${TAG_COLORS[tag]}`}
                          >
                            {TAG_LABELS[tag]}
                          </span>
                        ))}
                        {canEdit && (
                          <button
                            onClick={() => addActivityToSession(ex)}
                            className="ml-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-0.5 rounded-lg transition-colors"
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredPicker.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">
                      Inga övningar matchade din sökning.
                    </p>
                  )}
                  {filteredPicker.length > 50 && (
                    <p className="text-xs text-slate-500 text-center py-2">
                      Visar 50 av {filteredPicker.length}. Sök eller filtrera för fler.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Plans list view ──────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Back */}
      <Link
        href="/traningsdatabas"
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6"
      >
        ← Tillbaka till träningsdatabasen
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Mina årsplaneringar</h1>
          <p className="text-slate-400 text-sm mt-1">
            Bygg egna träningsplaner utifrån övningarna i databasen.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + Ny årsplanering
          </button>
        )}
      </div>

      {/* Plans grid */}
      {loadingPlans ? (
        <div className="text-center py-12 text-slate-400 text-sm">Laddar årsplaneringar…</div>
      ) : plans.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-4">📋</p>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">
            Inga årsplaneringar ännu
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Skapa din första egna årsplanering och bygg upp den med övningar från
            träningsdatabasen.
          </p>
          {canEdit && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              Skapa årsplanering
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const totalActivities = plan.sessions.reduce(
              (sum, s) => sum + s.activities.length,
              0
            );
            return (
              <div
                key={plan.id}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-100 text-base leading-tight">
                    {plan.name}
                  </h3>
                  {canEdit && (
                    <button
                      onClick={() => deletePlan(plan.id)}
                      className="text-slate-500 hover:text-red-400 text-xs shrink-0"
                      title="Ta bort"
                    >
                      🗑
                    </button>
                  )}
                </div>
                {plan.description && (
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    {plan.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                  <span>📋 {plan.sessions.length} pass</span>
                  <span>🏀 {totalActivities} övningar</span>
                </div>
                <button
                  onClick={() => setEditingPlanId(plan.id)}
                  className="w-full text-center text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Öppna och redigera →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create plan modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-5">Skapa ny årsplanering</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Namn *
                </label>
                <input
                  type="text"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="T.ex. Höststerminen 2025"
                  className="w-full px-3 py-2.5 text-sm bg-slate-700 text-white border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Beskrivning
                </label>
                <textarea
                  value={newPlanDesc}
                  onChange={(e) => setNewPlanDesc(e.target.value)}
                  placeholder="Valfri beskrivning av planeringen…"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm bg-slate-700 text-white border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Antal träningspass
                </label>
                <select
                  value={newPlanSessions}
                  onChange={(e) => setNewPlanSessions(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm bg-slate-700 text-white border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {[6, 8, 10, 12, 16, 20, 24, 30, 36].map((n) => (
                    <option key={n} value={n}>
                      {n} pass
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPlanName("");
                  setNewPlanDesc("");
                  setNewPlanSessions(12);
                }}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-400 border border-slate-600 rounded-xl hover:bg-slate-700 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={createPlan}
                disabled={!newPlanName.trim() || creatingPlan}
                className="flex-1 py-2.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingPlan ? "Skapar…" : "Skapa plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
