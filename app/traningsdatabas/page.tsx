"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { getSport } from "../../lib/sports";
import { autoTag, TAG_LABELS, TAG_COLORS, ALL_TAGS } from "../../lib/exerciseTags";
import type { ExerciseTag } from "../data/types";
import { year1Plan } from "../data/year1";
import { year2Plan } from "../data/year2";
import { year3Plan } from "../data/year3";
import { extraExercises } from "../data/extraExercises";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

interface TeamExercise {
  id: string;
  name: string;
  description: string;
  tips?: string;
  durationMinutes?: number;
  intensityLevel?: 1 | 2 | 3;
  createdBy: string;
  createdAt: string;
}

const yearPlans = [
  {
    year: 1,
    ageGroup: "Upp till 7 år",
    accentColor: "border-t-emerald-500",
    badgeBg: "bg-emerald-500",
    tagBg: "bg-emerald-900/30 text-emerald-400",
    linkColor: "text-emerald-400 group-hover:text-emerald-300",
    icon: "🌱",
    description:
      "Glädje, lek och grundläggande motorik. 36 träningspass med fokus på att introducera grunderna och ha riktigt kul.",
    highlights: ["Bollbekantskap", "Dribbling", "Skott mot mål", "Roliga lekar"],
  },
  {
    year: 2,
    ageGroup: "8 år",
    accentColor: "border-t-blue-500",
    badgeBg: "bg-blue-500",
    tagBg: "bg-blue-50 text-blue-300",
    linkColor: "text-blue-300 group-hover:text-blue-800",
    icon: "⚡",
    description:
      "Repetera grunderna och introducera matchspelet. 36 träningspass med progression mot mer sportspecifika färdigheter.",
    highlights: ["Passningar", "Rörelse", "Matchspel", "Lagövningar"],
  },
  {
    year: 3,
    ageGroup: "9 år",
    accentColor: "border-t-orange-500",
    badgeBg: "bg-orange-500",
    tagBg: "bg-orange-500/20 text-orange-400",
    linkColor: "text-orange-700 group-hover:text-orange-800",
    icon: "🔥",
    description:
      "Teknisk finslipning och taktisk förståelse. 36 träningspass indelade i två cykler med helt nya moment.",
    highlights: ["Teknik", "Taktik", "Spelövningar", "Matchspel"],
  },
];

export default function TraningsdatabasPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();
  const sportId = user?.sport ?? "basket";
  const sport = getSport(sportId);

  const canEdit =
    user?.roles.some((r) => r === "coach" || r === "admin" || r === "assistant") ?? false;

  const [activeTag, setActiveTag] = useState<ExerciseTag | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  // ── Custom exercises (team-specific) ──────────────────────────────────────
  const [teamExercises, setTeamExercises] = useState<TeamExercise[]>([]);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExDesc, setNewExDesc] = useState("");
  const [newExTips, setNewExTips] = useState("");
  const [newExDuration, setNewExDuration] = useState("");
  const [newExIntensity, setNewExIntensity] = useState<1 | 2 | 3 | "">("");
  const [savingExercise, setSavingExercise] = useState(false);

  useEffect(() => {
    if (!team) return;
    let mounted = true;
    const load = () =>
      supabase.from("team_exercises").select("*").eq("team_id", team.id)
        .then(({ data }) => {
          if (!mounted) return;
          setTeamExercises((data ?? []).map((d) => ({
            id: d.id, name: d.title, description: d.description ?? "",
            createdBy: d.created_by ?? "", createdAt: d.created_at,
          })));
        });
    load();
    const ch = supabase.channel(`team-exercises:${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_exercises", filter: `team_id=eq.${team.id}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [team?.id]);

  const resetExerciseForm = () => {
    setNewExName("");
    setNewExDesc("");
    setNewExTips("");
    setNewExDuration("");
    setNewExIntensity("");
    setShowAddExercise(false);
  };

  const saveCustomExercise = async () => {
    if (!team || !user || !newExName.trim()) return;
    setSavingExercise(true);
    try {
      const { error } = await supabase.from("team_exercises").insert({
        team_id: team.id, title: newExName.trim(),
        description: newExDesc.trim(), created_by: user.id,
      });
      if (error) { toast("Kunde inte spara övningen.", "error"); return; }
      toast("Övning sparad!", "success");
      resetExerciseForm();
    } finally {
      setSavingExercise(false);
    }
  };

  const deleteCustomExercise = async (id: string) => {
    if (!canEdit) return;
    const { error } = await supabase.from("team_exercises").delete().eq("id", id);
    if (error) { toast("Kunde inte ta bort övningen.", "error"); return; }
    toast("Övning borttagen.", "info");
  };

  function yearHref(year: number) {
    if (sportId === "basket") return `/ar${year}`;
    return `/${sportId}/ar${year}`;
  }

  // Build a flat list of all exercises across all year plans with their context
  const yearPlanExercises = useMemo(() => {
    const plans = [year1Plan, year2Plan, year3Plan];
    return plans.flatMap((plan) =>
      plan.sessions.flatMap((session) =>
        session.activities.map((activity) => ({
          ...activity,
          computedTags: autoTag(activity),
          planYear: plan.year as number,
          sessionNumber: session.number,
          sessionTitle: session.title,
          source: "year" as const,
        }))
      )
    );
  }, []);

  // Extra exercises (from training resources)
  const extraExerciseItems = useMemo(() => {
    return extraExercises.map((ex) => ({
      ...ex,
      computedTags: autoTag(ex),
      planYear: undefined as number | undefined,
      sessionNumber: undefined as number | undefined,
      sessionTitle: ex.source ?? "Extra övningar",
      source: "extra" as const,
    }));
  }, []);

  // Team's custom exercises
  const customExerciseItems = useMemo(() => {
    return teamExercises.map((ex) => ({
      name: ex.name,
      description: ex.description,
      tips: ex.tips,
      durationMinutes: ex.durationMinutes,
      intensityLevel: ex.intensityLevel,
      computedTags: autoTag({ name: ex.name, description: ex.description }),
      planYear: undefined as number | undefined,
      sessionNumber: undefined as number | undefined,
      sessionTitle: "Egna övningar",
      source: "custom" as const,
      id: ex.id,
    }));
  }, [teamExercises]);

  // All exercises combined
  const allExercises = useMemo(
    () => [...yearPlanExercises, ...extraExerciseItems, ...customExerciseItems],
    [yearPlanExercises, extraExerciseItems, customExerciseItems]
  );

  // Filter exercises by active tag and/or search query
  const filteredExercises = useMemo(() => {
    return allExercises.filter((ex) => {
      const matchesTag = !activeTag || ex.computedTags.includes(activeTag);
      const matchesSearch =
        !searchQuery.trim() ||
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTag && matchesSearch;
    });
  }, [allExercises, activeTag, searchQuery]);

  // Count exercises per tag (for the tag pill badges)
  const tagCounts = useMemo(() => {
    const counts: Partial<Record<ExerciseTag, number>> = {};
    for (const tag of ALL_TAGS) {
      counts[tag] = allExercises.filter((ex) => ex.computedTags.includes(tag)).length;
    }
    return counts;
  }, [allExercises]);

  const showExerciseBank = activeTag !== null || searchQuery.trim() !== "";

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
      {/* Hero */}
      <div className="relative text-center mb-10 py-14 px-4 rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,_#f97316_0%,_transparent_60%)]" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 tracking-wide uppercase">
            {sport.emoji} Träningsdatabas
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Träningsdatabas<br className="hidden sm:block" /> – {sport.name}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-lg max-w-xl mx-auto leading-relaxed">
            Välj säsongsår, filtrera med Smart-Tagging, skapa egna övningar eller
            bygg din egna årsplanering.
          </p>
          <div className="flex justify-center gap-6 mt-8 text-slate-400 text-sm">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-white">3</span>
              <span>årsplaner</span>
            </div>
            <div className="w-px bg-gray-300 dark:bg-slate-700" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-white">36</span>
              <span>pass / år</span>
            </div>
            <div className="w-px bg-gray-300 dark:bg-slate-700" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-white">{allExercises.length}</span>
              <span>övningar totalt</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Link
              href="/traningsdatabas/arsplanering"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              📋 Mina årsplaneringar
            </Link>
            {canEdit && (
              <button
                onClick={() => setShowAddExercise(true)}
                className="inline-flex items-center gap-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors border border-gray-200 dark:border-slate-600"
              >
                ➕ Skapa egen övning
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Smart-Tagging övningsbank ── */}
      <div className="mb-10 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🏷️</span>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Övningsbank – Smart-Tagging</h2>
            <p className="text-sm text-slate-500">
              Filtrera {allExercises.length} övningar efter kategori eller sök på nyckelord.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök övning, t.ex. dribbling, skott eller kull…"
            className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Tag filter pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all ${
              activeTag === null
                ? "bg-slate-800 dark:bg-slate-800 text-white"
                : "bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
            }`}
          >
            Alla ({allExercises.length})
          </button>
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all ${
                activeTag === tag
                  ? "bg-orange-500 text-white"
                  : `${TAG_COLORS[tag]} hover:opacity-80`
              }`}
            >
              {TAG_LABELS[tag]}
              <span className="ml-1 opacity-70 text-xs">({tagCounts[tag] ?? 0})</span>
            </button>
          ))}
        </div>

        {/* Exercise list */}
        {showExerciseBank && (
          <div>
            {filteredExercises.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Inga övningar matchade din sökning. Prova ett annat filter.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 mb-3">
                  {filteredExercises.length} övning{filteredExercises.length !== 1 ? "ar" : ""} hittades
                </p>
                {filteredExercises.map((ex) => {
                  const key = `${ex.source}-${ex.planYear ?? "x"}-${ex.sessionNumber ?? "x"}-${ex.name}`;
                  const isExpanded = expandedActivity === key;
                  return (
                    <div
                      key={key}
                      className="border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden"
                    >
                      <button
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                        onClick={() => setExpandedActivity(isExpanded ? null : key)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{ex.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {ex.source === "year"
                                ? `År ${ex.planYear} · ${ex.sessionTitle}`
                                : ex.sessionTitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap shrink-0">
                            {ex.computedTags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${TAG_COLORS[tag]}`}
                              >
                                {TAG_LABELS[tag]}
                              </span>
                            ))}
                            <span className="text-slate-400 text-xs">
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 bg-slate-50 border-t border-slate-200">
                          <p className="text-sm text-slate-600 leading-relaxed mt-3 mb-2">
                            {ex.description}
                          </p>
                          {ex.tips && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                              <p className="text-xs font-semibold text-amber-400 mb-0.5">💡 Coachetips</p>
                              <p className="text-xs text-amber-300 leading-relaxed">{ex.tips}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-3">
                            {ex.durationMinutes && (
                              <span className="text-xs text-slate-500">
                                ⏱ {ex.durationMinutes} min
                              </span>
                            )}
                            {ex.intensityLevel && (
                              <span className="text-xs text-slate-500">
                                {"🔥".repeat(ex.intensityLevel)} Intensitet {ex.intensityLevel}/3
                              </span>
                            )}
                            {ex.source === "year" && ex.planYear && ex.sessionNumber && (
                              <Link
                                href={yearHref(ex.planYear)}
                                className="ml-auto text-xs font-semibold text-orange-600 hover:underline"
                              >
                                Se träningspass {ex.sessionNumber} →
                              </Link>
                            )}
                            {ex.source === "custom" && canEdit && (
                              <button
                                onClick={() =>
                                  deleteCustomExercise(
                                    (ex as typeof ex & { id?: string }).id ?? ""
                                  )
                                }
                                className="ml-auto text-xs text-red-400 hover:text-red-300"
                              >
                                Ta bort
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!showExerciseBank && (
          <p className="text-sm text-slate-400 text-center py-4">
            Klicka på en kategori eller skriv i sökrutan för att bläddra i övningsbanken.
          </p>
        )}
      </div>

      {/* Year plan cards */}
      <div className="grid sm:grid-cols-3 gap-6 mb-14">
        {yearPlans.map((s) => (
          <Link
            key={s.year}
            href={yearHref(s.year)}
            className={`group block bg-white dark:bg-slate-800 rounded-2xl border border-t-4 ${s.accentColor} border-gray-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{s.icon}</span>
              <div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${s.tagBg}`}
                >
                  År {s.year}
                </span>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-300 mt-0.5">
                  {s.ageGroup}
                </p>
              </div>
            </div>

            <p className="text-slate-500 text-sm leading-relaxed mb-5">
              {s.description}
            </p>

            <ul className="space-y-1.5 mb-5">
              {s.highlights.map((h) => (
                <li
                  key={h}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-300 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>

            <div
              className={`text-sm font-semibold flex items-center gap-1 ${s.linkColor} transition-colors`}
            >
              Visa träningsplan
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Info section ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">
          Schemalägg träningar direkt från planen
        </h2>
        <div className="grid sm:grid-cols-4 gap-6 text-sm text-slate-600">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl shrink-0">
              📚
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Välj årsplan</p>
              <p>Välj rätt år baserat på spelarnas åldersgrupp.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl shrink-0">
              📅
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Schemalägg säsongen
              </p>
              <p>
                Använd knappen &quot;Schemalägg säsong&quot; i årsplanen för att
                automatiskt lägga in alla pass i kalendern.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl shrink-0">
              🏷️
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Smart-Tagging</p>
              <p>
                Filtrera övningar efter kategori – försvar, skytte, kondition och
                mer. Hitta rätt övning snabbt.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl shrink-0">
              📋
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Egna årsplaneringar</p>
              <p>
                Bygg en skräddarsydd plan med övningar du väljer ur databasen.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Create Custom Exercise Modal ─────────────────────── */}
      {showAddExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-5">Skapa egen övning</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Namn *
                </label>
                <input
                  type="text"
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  placeholder="T.ex. Rörelselekar med boll"
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Beskrivning *
                </label>
                <textarea
                  value={newExDesc}
                  onChange={(e) => setNewExDesc(e.target.value)}
                  placeholder="Beskriv hur övningen genomförs…"
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Coachetips
                </label>
                <textarea
                  value={newExTips}
                  onChange={(e) => setNewExTips(e.target.value)}
                  placeholder="Valfria tips till tränaren…"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Tid (min)
                  </label>
                  <input
                    type="number"
                    value={newExDuration}
                    onChange={(e) => setNewExDuration(e.target.value)}
                    placeholder="T.ex. 10"
                    min={1}
                    max={120}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Intensitet
                  </label>
                  <select
                    value={newExIntensity}
                    onChange={(e) =>
                      setNewExIntensity(
                        e.target.value === "" ? "" : (Number(e.target.value) as 1 | 2 | 3)
                      )
                    }
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Välj…</option>
                    <option value={1}>🔥 Låg (1)</option>
                    <option value={2}>🔥🔥 Medel (2)</option>
                    <option value={3}>🔥🔥🔥 Hög (3)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={resetExerciseForm}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={saveCustomExercise}
                disabled={!newExName.trim() || !newExDesc.trim() || savingExercise}
                className="flex-1 py-2.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingExercise ? "Sparar…" : "Spara övning"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
