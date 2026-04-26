"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "../../../lib/toast";
import { year1Plan } from "../../data/year1";
import { year2Plan } from "../../data/year2";
import { year3Plan } from "../../data/year3";
import type { Session as PlanSession } from "../../data/types";

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
  planYear?: number;
  planSessionNumber?: number;
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
  coming:     { label: "Kommer",       color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500 dark:bg-emerald-400" },
  not_coming: { label: "Kommer inte",  color: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",               dot: "bg-red-500 dark:bg-red-400" },
  maybe:      { label: "Kanske",       color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",       dot: "bg-amber-500 dark:bg-amber-400" },
};

const ATTENDANCE_CONFIG = {
  present: { label: "Närvarande", icon: "✓", active: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/50" },
  absent:  { label: "Frånvar.",   icon: "✗", active: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 ring-1 ring-red-500/50" },
  sick:    { label: "Sjuk",       icon: "🤒", active: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/50" },
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

  // Match lineup (which players are called up)
  const [lineup, setLineup] = useState<Set<string>>(new Set());
  const [savingLineup, setSavingLineup] = useState(false);

  // Copy plan from another session
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyableSessions, setCopyableSessions] = useState<{ id: string; title: string; date: string; planCount: number }[]>([]);
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [copyingFrom, setCopyingFrom] = useState<string | null>(null);

  // Templates
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; itemCount: number }[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  // Carpool
  const [carpools, setCarpools] = useState<{ id: string; userId: string; userName: string; type: "needs_ride" | "offers_ride" }[]>([]);
  const [savingCarpool, setSavingCarpool] = useState(false);

  // Checklist
  interface ChecklistItem { id: string; label: string; checked: boolean; sortOrder: number; }
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [addingCheckItem, setAddingCheckItem] = useState(false);

  // AI plan generation
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPlayers, setAiPlayers] = useState("");
  const [aiDuration, setAiDuration] = useState("90");
  const [aiFocus, setAiFocus] = useState("");
  const [aiEquipment, setAiEquipment] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);

  // My RSVP (for non-coach users)
  const [myRsvp, setMyRsvp] = useState<"coming" | "not_coming" | "maybe" | null>(null);
  const [myRsvpComment, setMyRsvpComment] = useState("");
  const [rsvpBusy, setRsvpBusy] = useState(false);

  /* ── Load session ── */
  const loadSession = useCallback(async () => {
    const { data } = await supabase.from("sessions")
      .select("id, team_id, date, title, type, time, end_time, hall_name, opponent, home_or_away, coach_name, theme, focus_area, material, reflection, result, lineup_player_ids, plan_year, plan_session_number")
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
      planYear: data.plan_year ?? undefined,
      planSessionNumber: data.plan_session_number ?? undefined,
    });
    setLineup(new Set(data.lineup_player_ids ?? []));
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

  /* ── Load carpools ── */
  const loadCarpools = useCallback(async () => {
    const { data } = await supabase.from("session_carpools")
      .select("id, user_id, user_name, type").eq("session_id", id);
    setCarpools((data ?? []).map((d) => ({
      id: d.id, userId: d.user_id, userName: d.user_name ?? "Okänd",
      type: d.type as "needs_ride" | "offers_ride",
    })));
  }, [id]);

  /* ── Load checklist ── */
  const loadChecklist = useCallback(async () => {
    const { data } = await supabase.from("session_checklist")
      .select("id, label, checked, sort_order").eq("session_id", id).order("sort_order");
    setChecklist((data ?? []).map((d) => ({
      id: d.id, label: d.label, checked: d.checked ?? false, sortOrder: d.sort_order ?? 0,
    })));
  }, [id]);

  useEffect(() => { loadSession(); }, [loadSession]);
  useEffect(() => { if (session) { loadPlanItems(); loadRsvps(); loadAttendanceAndPlayers(); loadCarpools(); loadChecklist(); } }, [session?.id, loadPlanItems, loadRsvps, loadAttendanceAndPlayers, loadCarpools, loadChecklist]);

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

  /* ── Save lineup ── */
  const saveLineup = async () => {
    if (!session) return;
    setSavingLineup(true);
    const { error } = await supabase.from("sessions")
      .update({ lineup_player_ids: [...lineup] })
      .eq("id", session.id);
    setSavingLineup(false);
    if (error) { toast("Kunde inte spara laguttagning.", "error"); return; }
    toast("Laguttagning sparad!", "success");
  };

  /* ── Open copy plan modal ── */
  const openCopyModal = async () => {
    if (!session) return;
    setLoadingCopy(true);
    setShowCopyModal(true);
    // Load recent training sessions for this team (not the current one)
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, title, date")
      .eq("team_id", session.teamId)
      .eq("type", "träning")
      .neq("id", id)
      .order("date", { ascending: false })
      .limit(30);
    if (!sessions) { setLoadingCopy(false); return; }
    // Count plan items per session in a single query
    const sessionIds = sessions.map((s) => s.id);
    const { data: counts } = await supabase
      .from("session_plan_items")
      .select("session_id")
      .in("session_id", sessionIds);
    const countMap: Record<string, number> = {};
    for (const row of counts ?? []) {
      countMap[row.session_id] = (countMap[row.session_id] ?? 0) + 1;
    }
    setCopyableSessions(
      sessions
        .filter((s) => (countMap[s.id] ?? 0) > 0)
        .map((s) => ({ id: s.id, title: s.title, date: s.date, planCount: countMap[s.id] ?? 0 }))
    );
    setLoadingCopy(false);
  };

  /* ── Copy plan items from another session ── */
  const copyPlanFrom = async (sourceId: string) => {
    if (!session || copyingFrom) return;
    setCopyingFrom(sourceId);
    const { data: items } = await supabase
      .from("session_plan_items")
      .select("title, duration_minutes, description, sort_order")
      .eq("session_id", sourceId)
      .order("sort_order");
    if (!items || items.length === 0) { setCopyingFrom(null); return; }
    const startOrder = planItems.length;
    const inserts = items.map((item, i) => ({
      session_id: id,
      team_id: session.teamId,
      title: item.title,
      duration_minutes: item.duration_minutes,
      description: item.description ?? null,
      sort_order: startOrder + i,
    }));
    const { error } = await supabase.from("session_plan_items").insert(inserts);
    setCopyingFrom(null);
    if (error) { toast("Kunde inte kopiera träningsplanen.", "error"); return; }
    setShowCopyModal(false);
    loadPlanItems();
    toast(`${items.length} moment kopierade!`, "success");
  };

  /* ── Save current plan as template ── */
  const saveAsTemplate = async () => {
    if (!newTemplateName.trim() || !session || planItems.length === 0) return;
    setSavingTemplate(true);
    const items = planItems.map((i) => ({
      title: i.title, duration_minutes: i.durationMinutes, description: i.description || null,
    }));
    const { error } = await supabase.from("session_templates").insert({
      team_id: session.teamId, name: newTemplateName.trim(), items, created_by: user?.id ?? null,
    });
    setSavingTemplate(false);
    if (error) { toast("Kunde inte spara mallen.", "error"); return; }
    setShowSaveTemplateModal(false);
    setNewTemplateName("");
    toast("Mall sparad!", "success");
  };

  /* ── Load and open template picker ── */
  const openTemplateModal = async () => {
    if (!session) return;
    setLoadingTemplates(true);
    setShowTemplateModal(true);
    const { data } = await supabase.from("session_templates")
      .select("id, name, items").eq("team_id", session.teamId).order("created_at", { ascending: false });
    setTemplates((data ?? []).map((t) => ({
      id: t.id, name: t.name,
      itemCount: Array.isArray(t.items) ? t.items.length : 0,
    })));
    setLoadingTemplates(false);
  };

  /* ── Apply template items to this session ── */
  const applyTemplate = async (templateId: string) => {
    if (!session || applyingTemplate) return;
    setApplyingTemplate(templateId);
    const { data } = await supabase.from("session_templates")
      .select("items").eq("id", templateId).single();
    if (!data?.items || !Array.isArray(data.items)) { setApplyingTemplate(null); return; }
    const startOrder = planItems.length;
    const inserts = (data.items as { title: string; duration_minutes: number; description: string | null }[]).map((item, i) => ({
      session_id: id, team_id: session.teamId, title: item.title,
      duration_minutes: item.duration_minutes || 15, description: item.description ?? null,
      sort_order: startOrder + i,
    }));
    const { error } = await supabase.from("session_plan_items").insert(inserts);
    setApplyingTemplate(null);
    if (error) { toast("Kunde inte tillämpa mallen.", "error"); return; }
    setShowTemplateModal(false);
    loadPlanItems();
    toast(`${inserts.length} moment tillagda från mall!`, "success");
  };

  /* ── Toggle carpool status ── */
  const toggleCarpool = async (type: "needs_ride" | "offers_ride") => {
    if (!user || !session || savingCarpool) return;
    setSavingCarpool(true);
    const existing = carpools.find((c) => c.userId === user.id);
    if (existing?.type === type) {
      await supabase.from("session_carpools").delete().eq("id", existing.id);
    } else {
      await supabase.from("session_carpools").upsert(
        { session_id: id, team_id: session.teamId, user_id: user.id, user_name: user.name, type },
        { onConflict: "session_id,user_id" }
      );
    }
    setSavingCarpool(false);
    loadCarpools();
  };

  /* ── Checklist ── */
  const addChecklistItem = async (label: string) => {
    if (!label.trim() || !session) return;
    setAddingCheckItem(true);
    const sortOrder = checklist.length;
    await supabase.from("session_checklist").insert({ session_id: id, label: label.trim(), sort_order: sortOrder });
    setNewCheckItem("");
    setAddingCheckItem(false);
    loadChecklist();
  };

  const toggleChecklistItem = async (item: ChecklistItem) => {
    setChecklist((prev) => prev.map((c) => c.id === item.id ? { ...c, checked: !c.checked } : c));
    await supabase.from("session_checklist").update({ checked: !item.checked }).eq("id", item.id);
  };

  const deleteChecklistItem = async (itemId: string) => {
    setChecklist((prev) => prev.filter((c) => c.id !== itemId));
    await supabase.from("session_checklist").delete().eq("id", itemId);
  };

  /* ── Generate AI plan ── */
  const generateAiPlan = async () => {
    if (!aiFocus.trim() || !session) return;
    setGeneratingAi(true);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: aiPlayers.trim() || undefined,
          duration: parseInt(aiDuration) || 90,
          focus: aiFocus.trim(),
          equipment: aiEquipment.trim() || undefined,
          sport: "basket",
        }),
      });
      const data = await res.json();
      if (data.error || !data.items) { toast("Kunde inte generera plan. Försök igen.", "error"); return; }
      // Save theme if present
      if (data.theme) {
        await supabase.from("sessions").update({ theme: data.theme }).eq("id", session.id);
        setSession((prev) => prev ? { ...prev, theme: data.theme } : prev);
      }
      // Insert items
      const startOrder = planItems.length;
      const inserts = data.items.map((item: { title: string; duration_minutes: number; description?: string }, i: number) => ({
        session_id: id, team_id: session.teamId, title: item.title,
        duration_minutes: item.duration_minutes, description: item.description ?? null,
        sort_order: startOrder + i,
      }));
      await supabase.from("session_plan_items").insert(inserts);
      setShowAiModal(false);
      setAiFocus(""); setAiPlayers(""); setAiEquipment("");
      loadPlanItems();
      toast(`AI genererade ${inserts.length} moment!`, "success");
    } catch {
      toast("Något gick fel. Kontrollera API-nyckeln.", "error");
    } finally {
      setGeneratingAi(false);
    }
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

  /* ── Linked yearly plan session ── */
  const linkedPlanSession: PlanSession | null = (() => {
    if (!session.planYear || !session.planSessionNumber) return null;
    const plans: Record<number, { sessions: PlanSession[] }> = { 1: year1Plan, 2: year2Plan, 3: year3Plan };
    return plans[session.planYear]?.sessions.find((s) => s.number === session.planSessionNumber) ?? null;
  })();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5 pb-10">

      {/* ── Back ── */}
      <div>
        <button onClick={() => router.back()} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1">
          ← Tillbaka
        </button>
      </div>

      {/* ── Header ── */}
      <div className={`rounded-2xl p-5 border ${isMatch ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40" : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isMatch ? "bg-red-100 dark:bg-red-800/60 text-red-700 dark:text-red-300" : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"}`}>
                {isMatch ? "Match" : "Träning"}
              </span>
              {session.hallName && (
                <span className="text-xs text-slate-400 dark:text-slate-500">📍 {session.hallName}</span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{session.title}</h1>
            {isMatch && session.opponent && (
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                {session.homeOrAway === "home" ? "🏠 Hemma" : "✈️ Borta"} mot {session.opponent}
              </p>
            )}
            {isMatch && session.result && (
              <div className="mt-2">
                <span className="text-2xl font-extrabold text-emerald-400">{session.result}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500 dark:text-slate-400">
              <span>📅 {formatDate(session.date)}</span>
              {session.time && <span>🕐 {session.time}{session.endTime ? `–${session.endTime}` : ""}</span>}
              {session.coachName && <span>👤 {session.coachName}</span>}
            </div>
          </div>
          {/* Quick links */}
          <div className="flex flex-col gap-2 shrink-0">
            <Link
              href={`/taktik`}
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-semibold transition-colors"
            >
              🎯 Taktiktavla
            </Link>
            <Link
              href="/kalender"
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-semibold transition-colors"
            >
              📅 Kalender
            </Link>
          </div>
        </div>
      </div>

      {/* ── Match report card ── */}
      {isMatch && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 dark:text-slate-100">🏆 Matchrapport</h2>
            {canEdit && !editingMeta && (
              <button
                onClick={() => { setMetaDraft({ theme: session.theme, focusArea: session.focusArea, material: session.material, reflection: session.reflection }); setResultDraft(session.result); setEditingMeta(true); }}
                className="text-xs px-3 py-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-600 dark:text-red-300 rounded-lg transition-colors"
              >
                ✏️ Redigera
              </button>
            )}
          </div>

          {editingMeta ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Resultat (slutresultat)</label>
                <input
                  value={resultDraft}
                  onChange={(e) => setResultDraft(e.target.value)}
                  placeholder="T.ex. 78-65"
                  className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-400 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Matchrapport / anteckningar</label>
                <textarea
                  value={metaDraft.reflection}
                  onChange={(e) => setMetaDraft((p) => ({ ...p, reflection: e.target.value }))}
                  rows={4}
                  placeholder="Hur gick matchen? Vad var bra? Vad kan bli bättre?"
                  className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => { await saveResult(); await saveMeta(); }}
                  disabled={savingResult || savingMeta}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {savingResult || savingMeta ? "Sparar…" : "Spara"}
                </button>
                <button
                  onClick={() => setEditingMeta(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Score */}
              <div className="text-center py-3">
                {session.result ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wide">Slutresultat</p>
                    <span className="text-4xl font-extrabold text-emerald-500 dark:text-emerald-400 tabular-nums">{session.result}</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                    {canEdit ? "Klicka Redigera för att fylla i resultat och matchrapport." : "Resultat ej inlagt ännu."}
                  </p>
                )}
              </div>
              {/* Match notes */}
              {session.reflection && (
                <div className="border-t border-red-200 dark:border-red-800/40 pt-4">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wide">Matchrapport</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{session.reflection}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Training info (hidden for matches) ── */}
      {!isMatch && (
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800 dark:text-slate-100">Träningsinformation</h2>
          {canEdit && !editingMeta && (
            <button
              onClick={() => { setMetaDraft({ theme: session.theme, focusArea: session.focusArea, material: session.material, reflection: session.reflection }); setEditingMeta(true); }}
              className="text-xs px-3 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 rounded-lg transition-colors"
            >
              ✏️ Redigera
            </button>
          )}
        </div>

        {editingMeta ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Tema</label>
              <input value={metaDraft.theme} onChange={(e) => setMetaDraft((p) => ({ ...p, theme: e.target.value }))}
                placeholder="T.ex. Passningsspel och rörelse"
                className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Fokusområde</label>
              <input value={metaDraft.focusArea} onChange={(e) => setMetaDraft((p) => ({ ...p, focusArea: e.target.value }))}
                placeholder="T.ex. Kommunikation och timing"
                className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Material som behövs</label>
              <input value={metaDraft.material} onChange={(e) => setMetaDraft((p) => ({ ...p, material: e.target.value }))}
                placeholder="T.ex. 12 bollar, 8 koner, västar"
                className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">{isPast ? "Reflektion efter passet" : "Anteckningar"}</label>
              <textarea value={metaDraft.reflection} onChange={(e) => setMetaDraft((p) => ({ ...p, reflection: e.target.value }))}
                rows={3} placeholder={isPast ? "Vad gick bra? Vad kan bli bättre?" : "Förberedelseanteckningar…"}
                className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveMeta} disabled={savingMeta} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {savingMeta ? "Sparar…" : "Spara"}
              </button>
              <button onClick={() => setEditingMeta(false)} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {session.theme && (
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-0.5">TEMA</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{session.theme}</p>
              </div>
            )}
            {session.focusArea && (
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-0.5">FOKUS</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{session.focusArea}</p>
              </div>
            )}
            {session.material && (
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-0.5">MATERIAL</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{session.material}</p>
              </div>
            )}
            {session.reflection && (
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-0.5">{isPast ? "REFLEKTION" : "ANTECKNINGAR"}</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{session.reflection}</p>
              </div>
            )}
            {!session.theme && !session.focusArea && !session.material && !session.reflection && (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                {canEdit ? "Klicka Redigera för att lägga till tema, material och anteckningar." : "Ingen information tillagd ännu."}
              </p>
            )}
          </div>
        )}
      </div>
      )}

      {/* ── Training plan ── */}
      {!isMatch && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Träningsplan</h2>
              {totalDuration > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Totalt {totalDuration} min</p>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-1.5 flex-wrap justify-end">
                <button onClick={() => setShowAiModal(true)}
                  className="text-xs px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold transition-colors">
                  ✨ AI
                </button>
                {planItems.length > 0 && (
                  <button onClick={() => { setNewTemplateName(""); setShowSaveTemplateModal(true); }}
                    className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-semibold transition-colors">
                    💾 Mall
                  </button>
                )}
                <button onClick={openTemplateModal}
                  className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-semibold transition-colors">
                  📁 Från mall
                </button>
                <button onClick={openCopyModal}
                  className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-semibold transition-colors">
                  📋 Kopiera
                </button>
                <button onClick={() => setAddingItem(!addingItem)}
                  className="text-xs px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors">
                  + Lägg till
                </button>
              </div>
            )}
          </div>

          {/* Add item form */}
          {addingItem && (
            <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-3 mb-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="T.ex. Uppvärmning, Rondo, Matchspel…"
                  className="flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={newItemDuration}
                    onChange={(e) => setNewItemDuration(e.target.value)}
                    min="1" max="120"
                    className="w-14 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <span className="text-xs text-slate-400 dark:text-slate-500">min</span>
                </div>
              </div>
              <input
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                placeholder="Beskrivning (valfritt)"
                className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
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
                    <div className="mt-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-300 dark:border-slate-600 overflow-hidden">
                      <input
                        type="text"
                        value={exerciseSearch}
                        onChange={(e) => setExerciseSearch(e.target.value)}
                        placeholder="Sök övning…"
                        className="w-full bg-gray-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs px-3 py-2 border-b border-gray-200 dark:border-slate-600 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
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
                              className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-slate-700/50 last:border-0"
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
                  className="px-4 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors">
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {planItems.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">
              {canEdit ? "Lägg till delmoment för att bygga träningsplanen." : "Ingen plan skapad ännu."}
            </p>
          ) : (
            <div className="space-y-2">
              {planItems.map((item, i) => (
                <div key={item.id} className="flex items-start gap-3 bg-gray-50 dark:bg-slate-900/40 rounded-xl px-3 py-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-orange-400">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.title}</span>
                      <span className="text-xs text-slate-500 shrink-0">{item.durationMinutes} min</span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
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

      {/* ── Linked yearly plan ── */}
      {linkedPlanSession && !isMatch && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Årsplan – pass {session.planSessionNumber}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">År {session.planYear} · {linkedPlanSession.title}</p>
            </div>
            <Link href={`/ar${session.planYear}`}
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-semibold transition-colors">
              Se hela årsplanen ↗
            </Link>
          </div>
          <div className="space-y-2">
            {linkedPlanSession.activities.map((act, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-50 dark:bg-slate-900/40 rounded-xl px-3 py-2.5">
                <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-violet-400">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{act.name}</span>
                    {act.durationMinutes && (
                      <span className="text-xs text-slate-500 shrink-0">{act.durationMinutes} min</span>
                    )}
                  </div>
                  {act.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{act.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Match lineup ── */}
      {isMatch && players.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100">Laguttagning</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {lineup.size > 0 ? `${lineup.size} spelare uttagna` : "Inga uttagna ännu"}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={saveLineup}
                disabled={savingLineup}
                className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
              >
                {savingLineup ? "Sparar…" : "Spara uttag"}
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {players.map((p) => {
              const inLineup = lineup.has(p.id);
              return (
                <button
                  key={p.id}
                  disabled={!canEdit}
                  onClick={() => {
                    if (!canEdit) return;
                    setLineup((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    });
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left ${
                    inLineup
                      ? "bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/50"
                      : "bg-gray-50 dark:bg-slate-700/40 border border-gray-200 dark:border-slate-700/40 hover:bg-gray-100 dark:hover:bg-slate-700"
                  } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
                >
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                    inLineup ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400"
                  }`}>
                    {inLineup ? "✓" : ""}
                  </span>
                  <span className={`text-sm flex-1 ${inLineup ? "text-slate-800 dark:text-slate-100 font-semibold" : "text-slate-500 dark:text-slate-400"}`}>
                    #{p.number} {p.name}
                  </span>
                  {inLineup && (
                    <span className="text-xs text-emerald-400 font-medium">Uttagen</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RSVP overview ── */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
        <h2 className="font-bold text-slate-100 mb-3">Kallelse</h2>

        {/* My RSVP (non-coach users) */}
        {!canEdit && user && session.date >= today && (
          <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Kommer du?</p>
            <div className="flex gap-2 mb-2">
              {([["coming", "✓ Ja", "emerald"], ["maybe", "? Kanske", "amber"], ["not_coming", "✗ Nej", "red"]] as const).map(([st, lbl, color]) => (
                <button key={st} disabled={rsvpBusy} onClick={() => submitRsvp(st)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    myRsvp === st
                      ? color === "emerald" ? "bg-emerald-600 text-white" : color === "amber" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                      : "bg-gray-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
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
                  className="flex-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-lg px-3 py-1.5 border border-gray-300 dark:border-slate-600 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500" />
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
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
            ✓ {rsvpComing.length} kommer
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
            ✗ {rsvpNotComing.length} kommer inte
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            ? {rsvpMaybe.length} kanske
          </span>
          {unanswered.length > 0 && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              — {unanswered.length} ej svarat
            </span>
          )}
        </div>

        {/* RSVP list */}
        {rsvps.length === 0 && unanswered.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">Inga svar ännu.</p>
        ) : (
          <div className="space-y-1.5">
            {rsvps.map((r) => {
              const cfg = RSVP_CONFIG[r.status];
              return (
                <div key={r.userId} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">{r.userName}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  {r.comment && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic truncate max-w-[120px]" title={r.comment}>
                      &ldquo;{r.comment}&rdquo;
                    </span>
                  )}
                </div>
              );
            })}
            {unanswered.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0 bg-slate-600" />
                <span className="text-sm text-slate-400 dark:text-slate-500 flex-1">{m.name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-600 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700">Ej svarat</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Attendance (today or past) ── */}
      {players.length > 0 && (isPast || session.date === today) && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-slate-800 dark:text-slate-100">Närvaro</h2>
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                {present} ✓ · {absent} ✗ · {sick} 🤒
              </p>
            );
          })()}
          <div className="space-y-2">
            {players.map((p) => {
              const att = attendance.find((a) => a.playerId === p.id);
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">#{p.number} {p.name}</span>
                  <div className="flex gap-1">
                    {(["present", "absent", "sick"] as const).map((s) => {
                      const cfg = ATTENDANCE_CONFIG[s];
                      return (
                        <button key={s} onClick={() => canEdit && markAttendance(p.id, s)}
                          disabled={!canEdit}
                          title={cfg.label}
                          className={`text-xs px-2 py-1 rounded-lg font-medium transition-all ${att?.status === s ? cfg.active : "bg-gray-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"}`}>
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

      {/* ── Samåkning ── */}
      {session.date >= today && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
          <h2 className="font-bold text-slate-100 mb-3">Samåkning</h2>
          {user && (
            <div className="mb-4">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Hur tar du dig dit?</p>
              <div className="flex gap-2">
                {([
                  ["needs_ride", "🙋 Behöver skjuts", "amber"],
                  ["offers_ride", "🚗 Erbjuder skjuts", "emerald"],
                ] as const).map(([type, label, color]) => {
                  const mine = carpools.find((c) => c.userId === user.id);
                  const active = mine?.type === type;
                  return (
                    <button key={type} disabled={savingCarpool} onClick={() => toggleCarpool(type)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                        active
                          ? color === "amber" ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
                          : "bg-gray-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {carpools.length > 0 ? (
            <div className="space-y-1.5">
              {carpools.filter((c) => c.type === "offers_ride").map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span>🚗</span>
                  <span className="text-slate-700 dark:text-slate-200 flex-1">{c.userName}</span>
                  <span className="text-xs text-emerald-400">erbjuder skjuts</span>
                </div>
              ))}
              {carpools.filter((c) => c.type === "needs_ride").map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span>🙋</span>
                  <span className="text-slate-700 dark:text-slate-200 flex-1">{c.userName}</span>
                  <span className="text-xs text-amber-400">behöver skjuts</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">Ingen har anmält sig för samåkning ännu.</p>
          )}
        </div>
      )}

      {/* ── Packlista ── */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-slate-100">📦 Packlista</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {checklist.length === 0 ? "Lägg till utrustning att packa" : `${checklist.filter((c) => c.checked).length} / ${checklist.length} packade`}
            </p>
          </div>
          {checklist.length > 0 && checklist.every((c) => c.checked) && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded-lg">✓ Allt packat!</span>
          )}
        </div>

        {/* Progress bar */}
        {checklist.length > 0 && (
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${(checklist.filter((c) => c.checked).length / checklist.length) * 100}%` }}
            />
          </div>
        )}

        {/* Items */}
        <div className="space-y-1.5 mb-4">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group">
              <button
                onClick={() => toggleChecklistItem(item)}
                className={`w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center transition-all ${
                  item.checked
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-slate-500 hover:border-emerald-500"
                }`}
              >
                {item.checked && <span className="text-xs leading-none">✓</span>}
              </button>
              <span className={`flex-1 text-sm transition-colors ${item.checked ? "line-through text-slate-500" : "text-slate-200"}`}>
                {item.label}
              </span>
              {canEdit && (
                <button
                  onClick={() => deleteChecklistItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {checklist.length === 0 && (
            <p className="text-sm text-slate-500 italic">Ingen utrustning tillagd ännu.</p>
          )}
        </div>

        {/* Quick-add presets */}
        {canEdit && checklist.length === 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {["🏀 Bollar", "🧢 Tröjor/Matchkläder", "🔶 Koner", "🥤 Vatten", "🩹 Första hjälpen", "📋 Namnlista"].map((preset) => (
              <button
                key={preset}
                onClick={() => addChecklistItem(preset)}
                className="text-xs px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors border border-slate-600 border-dashed"
              >
                + {preset}
              </button>
            ))}
          </div>
        )}

        {/* Add item input */}
        {canEdit && (
          <div className="flex gap-2">
            <input
              value={newCheckItem}
              onChange={(e) => setNewCheckItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addChecklistItem(newCheckItem); }}
              placeholder="Lägg till utrustning…"
              className="flex-1 px-3 py-2 text-sm bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <button
              onClick={() => addChecklistItem(newCheckItem)}
              disabled={!newCheckItem.trim() || addingCheckItem}
              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* ── AI plan generation modal ── */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">✨</span>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">AI-genererad träningsplan</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">Beskriv vad du vill träna på, så skapar AI ett förslag.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Fokusområde <span className="text-red-400">*</span></label>
                <input autoFocus value={aiFocus} onChange={(e) => setAiFocus(e.target.value)}
                  placeholder="T.ex. Passningsspel och rörelser utan boll"
                  onKeyDown={(e) => { if (e.key === "Enter") generateAiPlan(); }}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Passlängd (min)</label>
                  <input type="number" value={aiDuration} onChange={(e) => setAiDuration(e.target.value)} min="30" max="180"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Antal spelare</label>
                  <input value={aiPlayers} onChange={(e) => setAiPlayers(e.target.value)}
                    placeholder="T.ex. 12"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Tillgänglig utrustning</label>
                <input value={aiEquipment} onChange={(e) => setAiEquipment(e.target.value)}
                  placeholder="T.ex. 8 bollar, 12 koner, västar"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={generateAiPlan} disabled={generatingAi || !aiFocus.trim()}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {generatingAi ? (
                  <><span className="animate-spin text-base">⟳</span> Genererar…</>
                ) : (
                  <>✨ Generera</>
                )}
              </button>
              <button onClick={() => setShowAiModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save as template modal ── */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-5">
            <h3 className="font-bold text-slate-100 mb-3">Spara som mall</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Sparar {planItems.length} moment som en återanvändbar mall för ditt lag.</p>
            <input
              autoFocus
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveAsTemplate(); if (e.key === "Escape") setShowSaveTemplateModal(false); }}
              placeholder="T.ex. Passningsfokus 60 min"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={saveAsTemplate} disabled={savingTemplate || !newTemplateName.trim()}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {savingTemplate ? "Sparar…" : "Spara mall"}
              </button>
              <button onClick={() => setShowSaveTemplateModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pick template modal ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Välj mall</h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-3">
              {loadingTemplates ? (
                <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">Laddar mallar…</p>
              ) : templates.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">Inga mallar sparade ännu. Skapa en mall från ett träningspass med moment.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Momenteten läggs till efter eventuella befintliga.</p>
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => applyTemplate(t.id)} disabled={!!applyingTemplate}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-700/60 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-colors text-left">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.name}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">{t.itemCount} moment</span>
                        {applyingTemplate === t.id
                          ? <span className="text-xs text-orange-400">Lägger till…</span>
                          : <span className="text-xs text-orange-400 font-semibold">Använd →</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Copy plan modal ── */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Kopiera träningsplan</h3>
              <button onClick={() => setShowCopyModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-3">
              {loadingCopy ? (
                <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">Laddar pass…</p>
              ) : copyableSessions.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-8">Inga tidigare träningspass med plan hittades.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                    Välj ett pass att kopiera momenteten ifrån. De läggs till efter eventuella befintliga moment.
                  </p>
                  {copyableSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => copyPlanFrom(s.id)}
                      disabled={!!copyingFrom}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-700/60 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.title}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(s.date)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">{s.planCount} moment</span>
                        {copyingFrom === s.id ? (
                          <span className="text-xs text-orange-400">Kopierar…</span>
                        ) : (
                          <span className="text-xs text-orange-400 font-semibold">Kopiera →</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
