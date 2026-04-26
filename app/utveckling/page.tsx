"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
}

interface Skill {
  id: string;
  name: string;
  sortOrder: number;
}

interface RatingRow {
  id: string;
  skillId: string;
  rating: number;
  ratedAt: string;
  ratedByName: string;
  notes: string | null;
}

const DEFAULT_SKILLS = ["Teknik", "Fysik", "Taktik", "Laganda"];

const RATING_LABELS = ["", "Nybörjare", "Utveckling", "Godkänd", "Bra", "Utmärkt"];
const RATING_COLORS = [
  "",
  "bg-red-500 text-white",
  "bg-orange-500 text-white",
  "bg-amber-400 text-slate-900",
  "bg-teal-500 text-white",
  "bg-emerald-500 text-white",
];
const RATING_BAR_COLORS = ["", "bg-red-500", "bg-orange-500", "bg-amber-400", "bg-teal-500", "bg-emerald-500"];

const MONTHS_SV = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS_SV[d.getMonth()]} ${d.getFullYear()}`;
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          disabled={!onChange}
          className={`text-2xl leading-none transition-transform ${onChange ? "hover:scale-110 cursor-pointer" : "cursor-default"} ${
            star <= value ? "text-amber-400" : "text-slate-600"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function UtvecklingPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();
  const canEdit = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;

  const [players, setPlayers] = useState<Player[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRatings, setLoadingRatings] = useState(false);

  const [ratingDraft, setRatingDraft] = useState<Record<string, number>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingRating, setSavingRating] = useState<string | null>(null);

  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [addingSkill, setAddingSkill] = useState(false);

  /* ── Load players & skills ── */
  const loadBase = useCallback(async () => {
    if (!team) { setLoading(false); return; }

    const [{ data: pl }, { data: sk }] = await Promise.all([
      supabase.from("players").select("id, name, number, position").eq("team_id", team.id).order("number"),
      supabase.from("team_skills").select("id, name, sort_order").eq("team_id", team.id).order("sort_order"),
    ]);

    setPlayers((pl ?? []).map((p) => ({ id: p.id, name: p.name, number: p.number ?? 0, position: p.position ?? "" })));

    let skillList = (sk ?? []).map((s) => ({ id: s.id, name: s.name, sortOrder: s.sort_order }));

    if (skillList.length === 0 && canEdit) {
      const toInsert = DEFAULT_SKILLS.map((name, i) => ({ team_id: team.id, name, sort_order: i }));
      const { data: inserted } = await supabase.from("team_skills").insert(toInsert).select("id, name, sort_order");
      skillList = (inserted ?? []).map((s) => ({ id: s.id, name: s.name, sortOrder: s.sort_order }));
    }

    setSkills(skillList);
    setLoading(false);
  }, [team?.id, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadBase(); }, [loadBase]);

  /* ── Load ratings for selected player ── */
  const loadRatings = useCallback(async (playerId: string) => {
    if (!team) return;
    setLoadingRatings(true);
    const { data } = await supabase
      .from("player_ratings")
      .select("id, skill_id, rating, rated_at, rated_by_name, notes")
      .eq("team_id", team.id)
      .eq("player_id", playerId)
      .order("rated_at", { ascending: false });
    setRatings((data ?? []).map((r) => ({
      id: r.id, skillId: r.skill_id, rating: r.rating,
      ratedAt: r.rated_at, ratedByName: r.rated_by_name ?? "", notes: r.notes,
    })));
    setLoadingRatings(false);
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedPlayerId) loadRatings(selectedPlayerId);
    else setRatings([]);
  }, [selectedPlayerId, loadRatings]);

  /* ── Save rating ── */
  const saveRating = async (skillId: string) => {
    const rating = ratingDraft[skillId];
    if (!rating || !selectedPlayerId || !team || !user) return;
    setSavingRating(skillId);
    const notes = notesDraft[skillId]?.trim() || null;
    const { error } = await supabase.from("player_ratings").insert({
      team_id: team.id, player_id: selectedPlayerId, skill_id: skillId,
      rating, rated_at: new Date().toISOString().slice(0, 10),
      rated_by_name: user.name, notes,
    });
    setSavingRating(null);
    if (error) { toast("Kunde inte spara betyg.", "error"); return; }
    setRatingDraft((p) => { const n = { ...p }; delete n[skillId]; return n; });
    setNotesDraft((p) => { const n = { ...p }; delete n[skillId]; return n; });
    loadRatings(selectedPlayerId);
    toast("Betyg sparat!", "success");
  };

  /* ── Delete rating ── */
  const deleteRating = async (ratingId: string) => {
    await supabase.from("player_ratings").delete().eq("id", ratingId);
    if (selectedPlayerId) loadRatings(selectedPlayerId);
  };

  /* ── Add skill ── */
  const addSkill = async () => {
    if (!newSkillName.trim() || !team) return;
    setAddingSkill(true);
    const { error } = await supabase.from("team_skills").insert({
      team_id: team.id, name: newSkillName.trim(), sort_order: skills.length,
    });
    setAddingSkill(false);
    if (error) { toast("Kunde inte lägga till förmåga.", "error"); return; }
    setNewSkillName(""); setShowAddSkill(false);
    loadBase();
    toast("Förmåga tillagd!", "success");
  };

  /* ── Delete skill ── */
  const deleteSkill = async (skillId: string, name: string) => {
    if (!confirm(`Ta bort förmågan "${name}"? Alla betyg för denna förmåga tas bort.`)) return;
    await supabase.from("team_skills").delete().eq("id", skillId);
    setSkills((prev) => prev.filter((s) => s.id !== skillId));
    setRatings((prev) => prev.filter((r) => r.skillId !== skillId));
    toast(`${name} borttagen.`, "success");
  };

  /* ── Per-skill stats ── */
  function getSkillStats(skillId: string) {
    const rows = ratings
      .filter((r) => r.skillId === skillId)
      .sort((a, b) => b.ratedAt.localeCompare(a.ratedAt));
    const current = rows[0] ?? null;
    const previous = rows[1] ?? null;
    const trend = current && previous ? current.rating - previous.rating : 0;
    return { current, trend, history: rows.slice(0, 5) };
  }

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  if (loading) return <div className="text-center py-16 text-slate-500">Laddar…</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">📈</span>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Spelarutveckling</h1>
          </div>
          <p className="text-slate-500 text-sm">Betygsätt spelare och följ deras utveckling över tid</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddSkill((v) => !v)}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors"
          >
            {showAddSkill ? "Avbryt" : "+ Ny förmåga"}
          </button>
        )}
      </div>

      {/* Add skill form */}
      {showAddSkill && canEdit && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 mb-5">
          <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wide">Ny förmåga</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addSkill(); }}
              placeholder="T.ex. Skotteknik, Försvar, Passning…"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <button
              onClick={addSkill}
              disabled={addingSkill || !newSkillName.trim()}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {addingSkill ? "…" : "Lägg till"}
            </button>
          </div>
        </div>
      )}

      {/* Player selector */}
      {players.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-slate-500 text-sm">
            Inga spelare registrerade. Lägg till spelare på{" "}
            <a href="/spelare" className="text-orange-400 hover:underline">spelarsidan</a> först.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap mb-6">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayerId(p.id === selectedPlayerId ? null : p.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  selectedPlayerId === p.id
                    ? "bg-orange-500 text-white"
                    : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                }`}
              >
                <span className="text-xs font-extrabold opacity-60">#{p.number}</span>
                {p.name}
              </button>
            ))}
          </div>

          {!selectedPlayerId ? (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">👆</p>
              <p className="text-slate-500 text-sm">Välj en spelare för att se och redigera deras färdighetsprofil</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Player banner */}
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                  <span className="text-base font-extrabold text-orange-400">#{selectedPlayer?.number}</span>
                </div>
                <div>
                  <p className="font-extrabold text-slate-800 dark:text-slate-100">{selectedPlayer?.name}</p>
                  {selectedPlayer?.position && (
                    <p className="text-xs text-slate-500">{selectedPlayer.position}</p>
                  )}
                </div>
              </div>

              {/* Skills grid */}
              {skills.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center">
                  <p className="text-slate-500 text-sm">
                    Inga förmågor definierade.{canEdit ? ' Klicka "+ Ny förmåga" för att lägga till.' : ""}
                  </p>
                </div>
              ) : loadingRatings ? (
                <div className="text-center py-8 text-slate-500 text-sm">Laddar betyg…</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {skills.map((skill) => {
                    const { current, trend, history } = getSkillStats(skill.id);
                    const draftRating = ratingDraft[skill.id] ?? 0;

                    return (
                      <div key={skill.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
                        {/* Skill name + trend */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{skill.name}</p>
                            {trend > 0 && (
                              <span className="text-emerald-400 text-xs font-bold">▲ +{trend}</span>
                            )}
                            {trend < 0 && (
                              <span className="text-red-400 text-xs font-bold">▼ {trend}</span>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => deleteSkill(skill.id, skill.name)}
                              className="text-slate-500 hover:text-red-400 text-xs transition-colors leading-none"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Current rating */}
                        {current ? (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${RATING_COLORS[current.rating]}`}>
                                {RATING_LABELS[current.rating]}
                              </span>
                              <span className="text-xs text-slate-500">{formatDate(current.ratedAt)}</span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${RATING_BAR_COLORS[current.rating]}`}
                                style={{ width: `${(current.rating / 5) * 100}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] text-slate-600">1</span>
                              <span className="text-xs font-bold text-slate-400">{current.rating}/5</span>
                              <span className="text-[10px] text-slate-600">5</span>
                            </div>
                            {current.notes && (
                              <p className="text-xs text-slate-500 italic mt-2 bg-gray-50 dark:bg-slate-900/40 rounded-lg px-2 py-1.5">
                                "{current.notes}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600 italic mb-3">Ej bedömd ännu</p>
                        )}

                        {/* History dots */}
                        {history.length > 1 && (
                          <div className="flex items-center gap-1.5 mb-3">
                            <span className="text-[10px] text-slate-600 mr-0.5">Historik:</span>
                            {history.map((h, i) => (
                              <div
                                key={h.id}
                                title={`${h.rating}/5 – ${formatDate(h.ratedAt)}${h.ratedByName ? ` av ${h.ratedByName}` : ""}`}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${RATING_COLORS[h.rating]} ${
                                  i === 0 ? "ring-2 ring-offset-1 dark:ring-offset-slate-800 ring-orange-400" : "opacity-50"
                                }`}
                              >
                                {h.rating}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Rate form (coaches only) */}
                        {canEdit && (
                          <div className="border-t border-gray-100 dark:border-slate-700/60 pt-3 mt-1">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nytt betyg</p>
                            <StarRating
                              value={draftRating}
                              onChange={(v) => setRatingDraft((p) => ({ ...p, [skill.id]: v }))}
                            />
                            {draftRating > 0 && (
                              <>
                                <p className="text-xs text-slate-500 mt-1">{RATING_LABELS[draftRating]}</p>
                                <input
                                  type="text"
                                  value={notesDraft[skill.id] ?? ""}
                                  onChange={(e) => setNotesDraft((p) => ({ ...p, [skill.id]: e.target.value }))}
                                  placeholder="Kommentar (valfritt)…"
                                  className="w-full mt-2 px-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                                />
                                <button
                                  onClick={() => saveRating(skill.id)}
                                  disabled={savingRating === skill.id}
                                  className="w-full mt-2 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
                                >
                                  {savingRating === skill.id ? "Sparar…" : `Spara betyg (${draftRating}/5)`}
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Delete latest */}
                        {canEdit && current && (
                          <button
                            onClick={() => deleteRating(current.id)}
                            className="mt-2 text-[10px] text-slate-600 hover:text-red-400 transition-colors w-full text-right"
                          >
                            Ta bort senaste betyg
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
