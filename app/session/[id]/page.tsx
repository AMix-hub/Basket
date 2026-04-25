"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../../lib/toast";

/* ─── Types ─────────────────────────────────────────────────── */
interface Session {
  id: string;
  teamId: string;
  date: string;
  title: string;
  type: "träning" | "match";
  time: string;
  endTime: string;
  hallName: string;
  opponent: string;
  homeOrAway: "home" | "away";
  coachName: string;
  theme: string;
  focusArea: string;
  material: string;
  reflection: string;
  result: string;
}

interface PlanItem {
  id: string;
  title: string;
  durationMinutes: number;
  description: string;
  sortOrder: number;
}

interface RsvpRow {
  userId: string;
  userName: string;
  status: "coming" | "not_coming" | "maybe";
  comment: string;
}

interface AttendanceRow {
  playerId: string;
  status: "present" | "absent" | "sick";
}

interface Player {
  id: string;
  name: string;
  number: number;
}

/* ─── Helpers ─────────────────────────────────────────────────── */
const DAY_NAMES = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
const MONTHS_SV = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS_SV[d.getMonth()]}`;
}

const RSVP_CONFIG = {
  coming:     { label: "Kommer",       color: "bg-emerald-900/40 text-emerald-300", dot: "bg-emerald-400" },
  not_coming: { label: "Kommer inte",  color: "bg-red-900/40 text-red-300",         dot: "bg-red-400" },
  maybe:      { label: "Kanske",       color: "bg-amber-900/40 text-amber-300",     dot: "bg-amber-400" },
};

const ATTENDANCE_CONFIG = {
  present: { label: "Närvarande", icon: "✓", active: "bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-500/50" },
  absent:  { label: "Frånvar.",   icon: "✗", active: "bg-red-900/50 text-red-300 ring-1 ring-red-500/50" },
  sick:    { label: "Sjuk",       icon: "🤒", active: "bg-amber-900/50 text-amber-300 ring-1 ring-amber-500/50" },
};

/* ═══════════════════════════════════════════════════════════════ */
export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const canEdit = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;

  const [session, setSession] = useState<Session | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [teamExercises, setTeamExercises] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState({ theme: "", focusArea: "", material: "", reflection: "" });
  const [savingMeta, setSavingMeta] = useState(false);

  // Plan item form
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDuration, setNewItemDuration] = useState("15");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");

  // Match result
  const [editingResult, setEditingResult] = useState(false);
  const [resultDraft, setResultDraft] = useState("");
  const [savingResult, setSavingResult] = useState(false);

  // My RSVP (for non-coach users)
  const [myRsvp, setMyRsvp] = useState<"coming" | "not_coming" | "maybe" | null>(null);
  const [myRsvpComment, setMyRsvpComment] = useState("");
  const [rsvpBusy, setRsvpBusy] = useState(false);

  /* ── Load session ── */
  const loadSession = useCallback(async () => {
    const { data } = await supabase.from("sessions")
      .select("id, team_id, date, title, type, time, end_time, hall_name, opponent, home_or_away, coach_name, theme, focus_area, material, reflection, result")
      .eq("id", id).single();
    if (!data) { setLoading(false); return; }
    setSession({
      id: data.id, teamId: data.team_id, date: data.date, title: data.title,
      type: data.type as "träning" | "match", time: data.time ?? "",
      endTime: data.end_time ?? "", hallName: data.hall_name ?? "",
      opponent: data.opponent ?? "", homeOrAway: data.home_or_away ?? "home",
      coachName: data.coach_name ?? "",
      theme: data.theme ?? "", focusArea: data.focus_area ?? "",
      material: data.material ?? "", reflection: data.reflection ?? "",
      result: data.result ?? "",
    });
    setLoading(false);
  }, [id]);

  /* ── Load plan items ── */
  const loadPlanItems = useCallback(async () => {
    const { data } = await supabase.from("session_plan_items")
      .select("id, title, duration_minutes, description, sort_order")
      .eq("session_id", id).order("sort_order");
    setPlanItems((data ?? []).map((d) => ({
      id: d.id, title: d.title, durationMinutes: d.duration_minutes,
      description: d.description ?? "", sortOrder: d.sort_order,
    })));
  }, [id]);

  /* ── Load RSVPs ── */
  const loadRsvps = useCallback(async () => {
    const { data } = await supabase.from("rsvps")
      .select("user_id, user_name, status, comment")
      .eq("session_id", id);
    const rows = (data ?? []).map((d) => ({
      userId: d.user_id, userName: d.user_name ?? "Okänd",
      status: d.status as RsvpRow["status"], comment: d.comment ?? "",
    }));
    setRsvps(rows);
    // Sync own RSVP
    if (user) {
      const mine = rows.find((r) => r.userId === user.id);
      setMyRsvp(mine?.status ?? null);
      setMyRsvpComment(mine?.comment ?? "");
    }
  }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load attendance + players + exercises ── */
  const loadAttendanceAndPlayers = useCallback(async () => {
    if (!session?.teamId) return;
    const [{ data: att }, { data: pl }, { data: members }, { data: exs }] = await Promise.all([
      supabase.from("attendance").select("player_id, status").eq("session_id", id),
      supabase.from("players").select("id, name, number").eq("team_id", session.teamId).order("number"),
      supabase.from("team_members").select("user_id, profiles(name)").eq("team_id", session.teamId),
      supabase.from("team_exercises").select("id, title, description").eq("team_id", session.teamId).order("title"),
    ]);
    setAttendance((att ?? []).map((d) => ({ playerId: d.player_id, status: d.status as AttendanceRow["status"] })));
    setPlayers((pl ?? []).map((d) => ({ id: d.id, name: d.name, number: d.number ?? 0 })));
    setTeamMembers((members ?? []).map((d) => ({
      id: d.user_id,
      name: (Array.isArray(d.profiles) ? (d.profiles[0] as { name: string } | undefined)?.name : (d.profiles as { name: string } | null)?.name) ?? "Okänd",
    })));
    setTeamExercises((exs ?? []).map((d) => ({ id: d.id, name: d.title, description: d.description ?? "" })));
  }, [id, session?.teamId]);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => { if (session) { loadPlanItems(); loadRsvps(); loadAttendanceAndPlayers(); } }, [session?.id, loadPlanItems, loadRsvps, loadAttendanceAndPlayers]);

  /* ── Save meta ── */
  const saveMeta = async () => {
    if (!session) return;
    setSavingMeta(true);
    const { error } = await supabase.from("sessions").update({
      theme: metaDraft.theme, focus_area: metaDraft.focusArea,
      material: metaDraft.material, reflection: metaDraft.reflection,
    }).eq("id", session.id);
    setSavingMeta(false);
    if (error) { toast("Kunde inte spara.", "error"); return; }
    setSession((prev) => prev ? { ...prev, ...metaDraft } : prev);
    setEditingMeta(false);
    toast("Sparat!", "success");
  };

  /* ── Save match result ── */
  const saveResult = async () => {
    if (!session) return;
    setSavingResult(true);
    const { error } = await supabase.from("sessions").update({ result: resultDraft.trim() || null }).eq("id", session.id);
    setSavingResult(false);
    if (error) { toast("Kunde inte spara resultatet.", "error"); return; }
    setSession((prev) => prev ? { ...prev, result: resultDraft.trim() } : prev);
    setEditingResult(false);
    toast("Resultat sparat!", "success");
  };

  /* ── Add plan item ── */
  const addPlanItem = async () => {
    if (!newItemTitle.trim() || !session) return;
    const sortOrder = planItems.length;
    const { error } = await supabase.from("session_plan_items").insert({
      session_id: id, team_id: session.teamId, title: newItemTitle.trim(),
      duration_minutes: parseInt(newItemDuration) || 15,
      description: newItemDesc.trim() || null, sort_order: sortOrder,
    });
    if (error) { toast("Kunde inte lägga till.", "error"); return; }
    setNewItemTitle(""); setNewItemDuration("15"); setNewItemDesc(""); setAddingItem(false);
    loadPlanItems();
  };

  /* ── Delete plan item ── */
  const deletePlanItem = async (itemId: string) => {
    await supabase.from("session_plan_items").delete().eq("id", itemId);
    loadPlanItems();
  };

  /* ── Mark attendance ── */
  const markAttendance = async (playerId: string, status: AttendanceRow["status"]) => {
    if (!session) return;
    await supabase.from("attendance").upsert(
      { session_id: id, player_id: playerId, status, team_id: session.teamId, updated_by: user?.id ?? null },
      { onConflict: "session_id,player_id" }
    );
    setAttendance((prev) => {
      const existing = prev.find((a) => a.playerId === playerId);
      if (existing) return prev.map((a) => a.playerId === playerId ? { ...a, status } : a);
      return [...prev, { playerId, status }];
    });
  };

  /* ── Submit own RSVP ── */
  const submitRsvp = async (status: "coming" | "not_coming" | "maybe") => {
    if (!user || !session || rsvpBusy) return;
    setRsvpBusy(true);
    const comment = myRsvpComment.trim() || null;
    if (myRsvp === status) {
      await supabase.from("rsvps").delete().eq("session_id", id).eq("user_id", user.id);
    } else {
      await supabase.from("rsvps").upsert(
        { session_id: id, user_id: user.id, user_name: user.name, team_id: session.teamId, status, comment },
        { onConflict: "session_id,user_id" }
      );
    }
    setRsvpBusy(false);
    loadRsvps();
  };

  /* ── Computed ── */
  const today = new Date().toISOString().slice(0, 10);
  const isPast = session ? session.date <= today : false;
  const totalDuration = planItems.reduce((s, i) => s + i.durationMinutes, 0);

  const rsvpComing = rsvps.filter((r) => r.status === "coming");
  const rsvpNotComing = rsvps.filter((r) => r.status === "not_coming");
  const rsvpMaybe = rsvps.filter((r) => r.status === "maybe");

  // Members who haven't answered
  const answeredIds = new Set(rsvps.map((r) => r.userId));
  const unanswered = teamMembers.filter((m) => !answeredIds.has(m.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-400">Laddar…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-slate-400">Aktiviteten hittades inte.</p>
        <Link href="/kalender" className="text-orange-400 hover:text-orange-300 text-sm">← Tillbaka till kalendern</Link>
      </div>
    );
  }

  const isMatch = session.type === "match";

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5 pb-10">

      {/* ── Back ── */}
      <div>
        <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1">
          ← Tillbaka
        </button>
      </div>

      {/* ── Header ── */}
      <div className={`rounded-2xl p-5 border ${isMatch ? "bg-red-900/20 border-red-800/40" : "bg-slate-800 border-slate-700"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isMatch ? "bg-red-800/60 text-red-300" : "bg-emerald-900/50 text-emerald-300"}`}>
                {isMatch ? "Match" : "Träning"}
              </span>
              {session.hallName && (
                <span className="text-xs text-slate-500">📍 {session.hallName}</span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">{session.title}</h1>
            {isMatch && session.opponent && (
              <p className="text-sm text-red-300 mt-1">
                {session.homeOrAway === "home" ? "🏠 Hemma" : "✈️ Borta"} mot {session.opponent}
              </p>
            )}
            {isMatch && isPast && (
              <div className="mt-2">
                {editingResult ? (
                  <div className="flex gap-2 items-center">
                    <input
                      autoFocus
                      value={resultDraft}
                      onChange={(e) => setResultDraft(e.target.value)}
                      placeholder="T.ex. 78-65"
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1 text-sm text-slate-100 w-28 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      onKeyDown={(e) => { if (e.key === "Enter") saveResult(); if (e.key === "Escape") setEditingResult(false); }}
                    />
                    <button onClick={saveResult} disabled={savingResult} className="text-xs px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors">
                      {savingResult ? "…" : "Spara"}
                    </button>
                    <button onClick={() => setEditingResult(false)} className="text-xs text-slate-500 hover:text-slate-300">Avbryt</button>
                  </div>
                ) : session.result ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-emerald-300">{session.result}</span>
                    {canEdit && (
                      <button onClick={() => { setResultDraft(session.result); setEditingResult(true); }} className="text-xs text-slate-500 hover:text-slate-300">✏️</button>
                    )}
                  </div>
                ) : canEdit ? (
                  <button
                    onClick={() => { setResultDraft(""); setEditingResult(true); }}
                    className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg transition-colors"
                  >
                    + Lägg till resultat
                  </button>
                ) : null}
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-400">
              <span>📅 {formatDate(session.date)}</span>
              {session.time && <span>🕐 {session.time}{session.endTime ? `–${session.endTime}` : ""}</span>}
              {session.coachName && <span>👤 {session.coachName}</span>}
            </div>
          </div>
          {/* Quick links */}
          <div className="flex flex-col gap-2 shrink-0">
            <Link
              href={`/taktik`}
              className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-semibold transition-colors"
            >
              🎯 Taktiktavla
            </Link>
            <Link
              href="/kalender"
              className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-semibold transition-colors"
            >
              📅 Kalender
            </Link>
          </div>
        </div>
      </div>

      {/* ── Theme / Focus / Material / Notes ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-100">Träningsinformation</h2>
          {canEdit && !editingMeta && (
            <button
              onClick={() => { setMetaDraft({ theme: session.theme, focusArea: session.focusArea, material: session.material, reflection: session.reflection }); setEditingMeta(true); }}
              className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg transition-colors"
            >
              ✏️ Redigera
            </button>
          )}
        </div>

        {editingMeta ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Tema</label>
              <input value={metaDraft.theme} onChange={(e) => setMetaDraft((p) => ({ ...p, theme: e.target.value }))}
                placeholder="T.ex. Passningsspel och rörelse"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Fokusområde</label>
              <input value={metaDraft.focusArea} onChange={(e) => setMetaDraft((p) => ({ ...p, focusArea: e.target.value }))}
                placeholder="T.ex. Kommunikation och timing"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Material som behövs</label>
              <input value={metaDraft.material} onChange={(e) => setMetaDraft((p) => ({ ...p, material: e.target.value }))}
                placeholder="T.ex. 12 bollar, 8 koner, västar"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">{isPast ? "Reflektion efter passet" : "Anteckningar"}</label>
              <textarea value={metaDraft.reflection} onChange={(e) => setMetaDraft((p) => ({ ...p, reflection: e.target.value }))}
                rows={3} placeholder={isPast ? "Vad gick bra? Vad kan bli bättre?" : "Förberedelseanteckningar…"}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveMeta} disabled={savingMeta} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {savingMeta ? "Sparar…" : "Spara"}
              </button>
              <button onClick={() => setEditingMeta(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {session.theme && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">TEMA</p>
                <p className="text-sm text-slate-200">{session.theme}</p>
              </div>
            )}
            {session.focusArea && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">FOKUS</p>
                <p className="text-sm text-slate-200">{session.focusArea}</p>
              </div>
            )}
            {session.material && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">MATERIAL</p>
                <p className="text-sm text-slate-200">{session.material}</p>
              </div>
            )}
            {session.reflection && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-0.5">{isPast ? "REFLEKTION" : "ANTECKNINGAR"}</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{session.reflection}</p>
              </div>
            )}
            {!session.theme && !session.focusArea && !session.material && !session.reflection && (
              <p className="text-sm text-slate-500 italic">
                {canEdit ? "Klicka Redigera för att lägga till tema, material och anteckningar." : "Ingen information tillagd ännu."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Training plan ── */}
      {!isMatch && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-slate-100">Träningsplan</h2>
              {totalDuration > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">Totalt {totalDuration} min</p>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => setAddingItem(!addingItem)}
                className="text-xs px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors"
              >
                + Lägg till
              </button>
            )}
          </div>

          {/* Add item form */}
          {addingItem && (
            <div className="bg-slate-900/60 rounded-xl p-3 mb-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="T.ex. Uppvärmning, Rondo, Matchspel…"
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={newItemDuration}
                    onChange={(e) => setNewItemDuration(e.target.value)}
                    min="1" max="120"
                    className="w-14 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-100 text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <span className="text-xs text-slate-500">min</span>
                </div>
              </div>
              <input
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                placeholder="Beskrivning (valfritt)"
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              {/* Exercise picker */}
              {teamExercises.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowExercisePicker((v) => !v)}
                    className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
                  >
                    📚 {showExercisePicker ? "Dölj övningsbank" : "Välj från övningsbank"}
                  </button>
                  {showExercisePicker && (
                    <div className="mt-2 bg-slate-800 rounded-xl border border-slate-600 overflow-hidden">
                      <input
                        type="text"
                        value={exerciseSearch}
                        onChange={(e) => setExerciseSearch(e.target.value)}
                        placeholder="Sök övning…"
                        className="w-full bg-slate-700 text-slate-200 text-xs px-3 py-2 border-b border-slate-600 focus:outline-none placeholder-slate-500"
                      />
                      <div className="max-h-36 overflow-y-auto">
                        {teamExercises
                          .filter((e) => !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase()))
                          .map((ex) => (
                            <button
                              key={ex.id}
                              onClick={() => {
                                setNewItemTitle(ex.name);
                                if (ex.description) setNewItemDesc(ex.description);
                                setShowExercisePicker(false);
                                setExerciseSearch("");
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                            >
                              <span className="font-medium">{ex.name}</span>
                              {ex.description && (
                                <span className="ml-2 text-slate-500 truncate">{ex.description.slice(0, 50)}</span>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={addPlanItem} disabled={!newItemTitle.trim()}
                  className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
                  Lägg till
                </button>
                <button onClick={() => { setAddingItem(false); setShowExercisePicker(false); setExerciseSearch(""); }}
                  className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors">
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {planItems.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              {canEdit ? "Lägg till delmoment för att bygga träningsplanen." : "Ingen plan skapad ännu."}
            </p>
          ) : (
            <div className="space-y-2">
              {planItems.map((item, i) => (
                <div key={item.id} className="flex items-start gap-3 bg-slate-900/40 rounded-xl px-3 py-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-orange-400">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-200">{item.title}</span>
                      <span className="text-xs text-slate-500 shrink-0">{item.durationMinutes} min</span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                    )}
                  </div>
                  {canEdit && (
                    <button onClick={() => deletePlanItem(item.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors text-xs shrink-0 mt-0.5">✕</button>
                  )}
                </div>
              ))}

              {/* Time summary bar */}
              <div className="flex gap-1 mt-2 rounded-full overflow-hidden h-2">
                {planItems.map((item) => (
                  <div
                    key={item.id}
                    style={{ flex: item.durationMinutes }}
                    className="bg-orange-500/60 hover:bg-orange-500 transition-colors"
                    title={`${item.title} – ${item.durationMinutes} min`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RSVP overview ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <h2 className="font-bold text-slate-100 mb-3">Kallelse</h2>

        {/* My RSVP (non-coach users) */}
        {!canEdit && user && session.date >= today && (
          <div className="bg-slate-900/50 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">Kommer du?</p>
            <div className="flex gap-2 mb-2">
              {([["coming", "✓ Ja", "emerald"], ["maybe", "? Kanske", "amber"], ["not_coming", "✗ Nej", "red"]] as const).map(([st, lbl, color]) => (
                <button key={st} disabled={rsvpBusy} onClick={() => submitRsvp(st)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    myRsvp === st
                      ? color === "emerald" ? "bg-emerald-600 text-white" : color === "amber" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
            {myRsvp && (
              <div className="flex gap-2">
                <input type="text" value={myRsvpComment}
                  onChange={(e) => setMyRsvpComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && myRsvp) submitRsvp(myRsvp); }}
                  placeholder="Kommentar (valfri)..."
                  className="flex-1 bg-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-slate-600 placeholder-slate-500 focus:outline-none focus:border-orange-500" />
                <button onClick={() => myRsvp && submitRsvp(myRsvp)} disabled={rsvpBusy}
                  className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors">
                  Spara
                </button>
              </div>
            )}
          </div>
        )}

        {/* Summary chips */}
        <div className="flex gap-2 flex-wrap mb-4">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-900/40 text-emerald-300">
            ✓ {rsvpComing.length} kommer
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-900/40 text-red-300">
            ✗ {rsvpNotComing.length} kommer inte
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-900/40 text-amber-300">
            ? {rsvpMaybe.length} kanske
          </span>
          {unanswered.length > 0 && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-700 text-slate-400">
              — {unanswered.length} ej svarat
            </span>
          )}
        </div>

        {/* RSVP list */}
        {rsvps.length === 0 && unanswered.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Inga svar ännu.</p>
        ) : (
          <div className="space-y-1.5">
            {rsvps.map((r) => {
              const cfg = RSVP_CONFIG[r.status];
              return (
                <div key={r.userId} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="text-sm text-slate-300 flex-1">{r.userName}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  {r.comment && (
                    <span className="text-xs text-slate-500 italic truncate max-w-[120px]" title={r.comment}>
                      &ldquo;{r.comment}&rdquo;
                    </span>
                  )}
                </div>
              );
            })}
            {unanswered.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0 bg-slate-600" />
                <span className="text-sm text-slate-500 flex-1">{m.name}</span>
                <span className="text-xs text-slate-600 px-2 py-0.5 rounded-full bg-slate-700">Ej svarat</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Attendance (today or past) ── */}
      {players.length > 0 && (isPast || session.date === today) && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-slate-100">Närvaro</h2>
            {canEdit && (
              <button
                onClick={async () => {
                  for (const p of players) await markAttendance(p.id, "present");
                  toast("Alla markerade som närvarande.", "success");
                }}
                className="text-xs px-2.5 py-1 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-400 rounded-lg font-semibold transition-colors"
              >
                ✓ Markera alla
              </button>
            )}
          </div>
          {(() => {
            const present = attendance.filter((a) => a.status === "present").length;
            const absent  = attendance.filter((a) => a.status === "absent").length;
            const sick    = attendance.filter((a) => a.status === "sick").length;
            return (
              <p className="text-xs text-slate-500 mb-3">
                {present} ✓ · {absent} ✗ · {sick} 🤒
              </p>
            );
          })()}
          <div className="space-y-2">
            {players.map((p) => {
              const att = attendance.find((a) => a.playerId === p.id);
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-sm text-slate-300 flex-1">#{p.number} {p.name}</span>
                  <div className="flex gap-1">
                    {(["present", "absent", "sick"] as const).map((s) => {
                      const cfg = ATTENDANCE_CONFIG[s];
                      return (
                        <button key={s} onClick={() => canEdit && markAttendance(p.id, s)}
                          disabled={!canEdit}
                          title={cfg.label}
                          className={`text-xs px-2 py-1 rounded-lg font-medium transition-all ${att?.status === s ? cfg.active : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}>
                          {cfg.icon}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
