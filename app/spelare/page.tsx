"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

/* ─── Types ─────────────────────────────────────────────────── */
interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
}

interface SessionSummary {
  id: string;
  date: string;
  title: string;
  type: string;
}

interface AttendanceRow {
  sessionId: string;
  status: "present" | "absent" | "sick";
}

interface PlayerNote {
  id: string;
  authorName: string;
  note: string;
  createdAt: string;
  shared: boolean;
}

interface PlayerDetail {
  attendance: AttendanceRow[];
  notes: PlayerNote[];
}

/* ─── Helpers ─────────────────────────────────────────────────── */
const DAY_NAMES = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
const MONTHS_SV = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function computeStreak(att: AttendanceRow[], sessions: SessionSummary[]): number {
  const attMap = new Map(att.map((a) => [a.sessionId, a.status]));
  const sorted = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((s) => attMap.has(s.id));
  let streak = 0;
  for (const s of sorted) {
    if (attMap.get(s.id) === "present") streak++;
    else break;
  }
  return streak;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS_SV[d.getMonth()]}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function AttendanceBar({ present, total }: { present: number; total: number }) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400"}`}>
        {pct}%
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function SpelarePage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();

  const canEdit = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;

  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [allAttendance, setAllAttendance] = useState<Record<string, AttendanceRow[]>>({}); // keyed by player_id
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, PlayerDetail>>({}); // keyed by player_id
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  // New note form
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [noteShared, setNoteShared] = useState<Record<string, boolean>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  // Edit player
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [savingPlayer, setSavingPlayer] = useState(false);

  // Add player
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addName, setAddName] = useState("");
  const [addNumber, setAddNumber] = useState("");
  const [addPosition, setAddPosition] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);

  /* ── Load all data ── */
  const loadData = useCallback(async () => {
    if (!team) { setLoading(false); return; }

    const [{ data: pl }, { data: sess }, { data: att }] = await Promise.all([
      supabase.from("players").select("id, name, number, position").eq("team_id", team.id).order("number"),
      supabase.from("sessions").select("id, date, title, type").eq("team_id", team.id).order("date", { ascending: false }).limit(50),
      supabase.from("attendance").select("player_id, session_id, status").eq("team_id", team.id),
    ]);

    setPlayers((pl ?? []).map((p) => ({
      id: p.id, name: p.name, number: p.number ?? 0, position: p.position ?? "",
    })));

    setSessions((sess ?? []).map((s) => ({
      id: s.id, date: s.date, title: s.title, type: s.type,
    })));

    // Group attendance by player_id
    const grouped: Record<string, AttendanceRow[]> = {};
    for (const row of att ?? []) {
      if (!grouped[row.player_id]) grouped[row.player_id] = [];
      grouped[row.player_id].push({ sessionId: row.session_id, status: row.status as AttendanceRow["status"] });
    }
    setAllAttendance(grouped);
    setLoading(false);
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Load player detail (notes) ── */
  const loadDetail = useCallback(async (playerId: string) => {
    if (!team || !canEdit) {
      setDetail((prev) => ({ ...prev, [playerId]: { attendance: [], notes: [] } }));
      return;
    }
    setLoadingDetail(playerId);
    const { data: notes } = await supabase
      .from("player_notes")
      .select("id, author_name, note, created_at, shared")
      .eq("player_id", playerId)
      .eq("team_id", team.id)
      .order("created_at", { ascending: false });

    setDetail((prev) => ({
      ...prev,
      [playerId]: {
        attendance: allAttendance[playerId] ?? [],
        notes: (notes ?? []).map((n) => ({
          id: n.id, authorName: n.author_name ?? "", note: n.note,
          createdAt: n.created_at, shared: n.shared ?? false,
        })),
      },
    }));
    setLoadingDetail(null);
  }, [team?.id, canEdit, allAttendance]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Toggle expand ── */
  const toggleExpand = (playerId: string) => {
    if (expandedId === playerId) { setExpandedId(null); return; }
    setExpandedId(playerId);
    if (!detail[playerId]) loadDetail(playerId);
  };

  /* ── Add note ── */
  const addNote = async (playerId: string) => {
    const text = noteDraft[playerId]?.trim();
    if (!text || !team || !user) return;
    setSavingNote(playerId);
    const shared = noteShared[playerId] ?? false;
    const { error } = await supabase.from("player_notes").insert({
      team_id: team.id, player_id: playerId,
      author_id: user.id, author_name: user.name, note: text, shared,
    });
    setSavingNote(null);
    if (error) { toast("Kunde inte spara anteckning.", "error"); return; }
    setNoteDraft((p) => ({ ...p, [playerId]: "" }));
    loadDetail(playerId);
    toast("Anteckning sparad!", "success");
  };

  /* ── Delete note ── */
  const deleteNote = async (playerId: string, noteId: string) => {
    await supabase.from("player_notes").delete().eq("id", noteId);
    loadDetail(playerId);
  };

  /* ── Save player edit ── */
  const savePlayerEdit = async (playerId: string) => {
    if (!editName.trim()) return;
    setSavingPlayer(true);
    const { error } = await supabase.from("players").update({
      name: editName.trim(),
      number: parseInt(editNumber) || 0,
      position: editPosition || null,
    }).eq("id", playerId);
    setSavingPlayer(false);
    if (error) { toast("Kunde inte spara.", "error"); return; }
    setEditingPlayer(null);
    loadData();
    toast("Sparat!", "success");
  };

  /* ── Add player ── */
  const addPlayer = async () => {
    if (!addName.trim() || !team) return;
    setAddingPlayer(true);
    const { error } = await supabase.from("players").insert({
      team_id: team.id, name: addName.trim(),
      number: parseInt(addNumber) || 0,
      position: addPosition || null,
    });
    setAddingPlayer(false);
    if (error) { toast("Kunde inte lägga till spelare.", "error"); return; }
    setAddName(""); setAddNumber(""); setAddPosition(""); setShowAddPlayer(false);
    loadData();
    toast("Spelare tillagd!", "success");
  };

  /* ── Delete player ── */
  const deletePlayer = async (playerId: string, name: string) => {
    if (!confirm(`Ta bort ${name} från truppen?`)) return;
    await supabase.from("players").delete().eq("id", playerId);
    if (expandedId === playerId) setExpandedId(null);
    loadData();
    toast(`${name} borttagen.`, "success");
  };

  /* ── Sorted players by attendance % desc ── */
  const sortedPlayers = [...players].sort((a, b) => {
    const attA = allAttendance[a.id] ?? [];
    const attB = allAttendance[b.id] ?? [];
    const pctA = attA.length > 0 ? attA.filter((x) => x.status === "present").length / attA.length : -1;
    const pctB = attB.length > 0 ? attB.filter((x) => x.status === "present").length / attB.length : -1;
    return pctB - pctA;
  });

  const POSITIONS = ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"];

  if (loading) {
    return <div className="text-center py-16 text-slate-500">Laddar truppen…</div>;
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🏀</span>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Spelartruppen</h1>
          </div>
          <p className="text-slate-500 text-sm">
            {players.length} spelare{team ? ` · ${team.name}` : ""}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddPlayer((v) => !v)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {showAddPlayer ? "Avbryt" : "+ Lägg till spelare"}
          </button>
        )}
      </div>

      {/* ── Add player form ── */}
      {showAddPlayer && canEdit && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 mb-5">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">Ny spelare</h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Namn <span className="text-red-400">*</span></label>
              <input autoFocus value={addName} onChange={(e) => setAddName(e.target.value)}
                placeholder="För- och efternamn"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Tröjnummer</label>
              <input type="number" value={addNumber} onChange={(e) => setAddNumber(e.target.value)}
                placeholder="T.ex. 12" min="0" max="99"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-semibold text-slate-400 block mb-1">Position</label>
            <select value={addPosition} onChange={(e) => setAddPosition(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400">
              <option value="">Välj position</option>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addPlayer} disabled={addingPlayer || !addName.trim()}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {addingPlayer ? "Lägger till…" : "Lägg till"}
            </button>
            <button onClick={() => { setShowAddPlayer(false); setAddName(""); setAddNumber(""); setAddPosition(""); }}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* ── Player list ── */}
      {players.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🏀</p>
          <p className="text-slate-500 text-sm">
            {canEdit ? "Inga spelare ännu. Klicka \"+ Lägg till spelare\" för att komma igång." : "Inga spelare registrerade ännu."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedPlayers.map((player) => {
            const att = allAttendance[player.id] ?? [];
            const present = att.filter((a) => a.status === "present").length;
            const streak = computeStreak(att, sessions);
            const isExpanded = expandedId === player.id;
            const playerDetail = detail[player.id];
            const isEditingThis = editingPlayer === player.id;

            return (
              <div key={player.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                {/* ── Player row ── */}
                {isEditingThis ? (
                  <div className="p-4">
                    <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wide">Redigera spelare</p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Namn</label>
                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Tröjnummer</label>
                        <input type="number" value={editNumber} onChange={(e) => setEditNumber(e.target.value)} min="0" max="99"
                          className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="text-xs text-slate-500 block mb-1">Position</label>
                      <select value={editPosition} onChange={(e) => setEditPosition(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400">
                        <option value="">Ingen position</option>
                        {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => savePlayerEdit(player.id)} disabled={savingPlayer || !editName.trim()}
                        className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                        {savingPlayer ? "Sparar…" : "Spara"}
                      </button>
                      <button onClick={() => setEditingPlayer(null)}
                        className="px-4 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                        Avbryt
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleExpand(player.id)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    {/* Jersey number */}
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-extrabold text-orange-400">#{player.number}</span>
                    </div>
                    {/* Name + position + streak */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{player.name}</p>
                        {streak >= 3 && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${streak >= 10 ? "bg-amber-400/20 text-amber-300" : "bg-orange-500/20 text-orange-400"}`}>
                            🔥 {streak}
                          </span>
                        )}
                      </div>
                      {player.position && (
                        <p className="text-xs text-slate-500 mt-0.5">{player.position}</p>
                      )}
                    </div>
                    {/* Attendance bar */}
                    <div className="w-28 shrink-0">
                      <AttendanceBar present={present} total={att.length} />
                      <p className="text-xs text-slate-600 text-right mt-0.5">{present}/{att.length} pass</p>
                    </div>
                    {/* Chevron */}
                    <span className={`text-slate-500 text-xs shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                  </button>
                )}

                {/* ── Expanded detail ── */}
                {isExpanded && !isEditingThis && (
                  <div className="border-t border-gray-200 dark:border-slate-700 p-4 space-y-5">

                    {/* Attendance history */}
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Närvaro – senaste pass</p>
                      {sessions.length === 0 ? (
                        <p className="text-xs text-slate-600 italic">Inga pass loggade.</p>
                      ) : (
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                          {sessions.slice(0, 20).map((s) => {
                            const row = att.find((a) => a.sessionId === s.id);
                            return (
                              <div key={s.id} className="flex items-center gap-2 text-xs">
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                                  row?.status === "present" ? "bg-emerald-900/60 text-emerald-400" :
                                  row?.status === "absent"  ? "bg-red-900/60 text-red-400" :
                                  row?.status === "sick"    ? "bg-amber-900/60 text-amber-400" :
                                  "bg-gray-200 dark:bg-slate-700 text-slate-400"
                                }`}>
                                  {row?.status === "present" ? "✓" : row?.status === "absent" ? "✗" : row?.status === "sick" ? "🤒" : "—"}
                                </span>
                                <span className="text-slate-400 truncate flex-1">{s.title}</span>
                                <span className="text-slate-600 shrink-0">{formatDate(s.date)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Coach notes (only for coaches) */}
                    {canEdit && (
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tränaranteckningar</p>
                        {loadingDetail === player.id ? (
                          <p className="text-xs text-slate-600 italic">Laddar…</p>
                        ) : (
                          <>
                            {/* Add note */}
                            <div className="mb-3 space-y-2">
                              <textarea
                                value={noteDraft[player.id] ?? ""}
                                onChange={(e) => setNoteDraft((p) => ({ ...p, [player.id]: e.target.value }))}
                                placeholder="Lägg till en anteckning om spelarens utveckling…"
                                rows={2}
                                className="w-full text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none"
                              />
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={noteShared[player.id] ?? false}
                                    onChange={(e) => setNoteShared((p) => ({ ...p, [player.id]: e.target.checked }))}
                                    className="accent-orange-500 w-3.5 h-3.5"
                                  />
                                  <span className="text-xs text-slate-400">Dela med spelaren</span>
                                </label>
                                <button
                                  onClick={() => addNote(player.id)}
                                  disabled={!noteDraft[player.id]?.trim() || savingNote === player.id}
                                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors"
                                >
                                  {savingNote === player.id ? "…" : "Spara anteckning"}
                                </button>
                              </div>
                            </div>
                            {/* Note list */}
                            {(playerDetail?.notes ?? []).length === 0 ? (
                              <p className="text-xs text-slate-600 italic">Inga anteckningar än.</p>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {(playerDetail?.notes ?? []).map((n) => (
                                  <div key={n.id} className="bg-gray-50 dark:bg-slate-900/60 rounded-xl px-3 py-2.5 relative group">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-orange-400">{n.authorName}</span>
                                        {n.shared && (
                                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded-full border border-emerald-700/40">
                                            Delad
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-600">{formatDateTime(n.createdAt)}</span>
                                        <button
                                          onClick={() => deleteNote(player.id, n.id)}
                                          className="text-slate-700 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{n.note}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Edit / Delete buttons (coaches only) */}
                    {canEdit && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setEditingPlayer(player.id); setEditName(player.name); setEditNumber(String(player.number)); setEditPosition(player.position); }}
                          className="flex-1 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
                        >
                          ✏️ Redigera
                        </button>
                        <button
                          onClick={() => deletePlayer(player.id, player.name)}
                          className="px-4 py-1.5 text-xs font-semibold bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-xl transition-colors"
                        >
                          Ta bort
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
