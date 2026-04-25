"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { toast } from "../../../lib/toast";

/* ─── Types ─────────────────────────────────────────────────── */
interface Cup {
  id: string; teamId: string; name: string; location: string;
  startDate: string; endDate: string; accommodation: string; notes: string;
}
interface CupMatch {
  id: string; date: string; time: string; opponent: string;
  location: string; result: string; sortOrder: number;
}
interface Contact { name: string; role: string; phone: string; }
interface CupRsvp {
  id: string; userId: string; userName: string;
  status: "coming" | "not_coming" | "maybe"; note: string;
}

/* ─── Helpers ─────────────────────────────────────────────────── */
const MONTHS_SV = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
const DAY_NAMES = ["Sön","Mån","Tis","Ons","Tor","Fre","Lör"];
function fmtDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${DAY_NAMES[dt.getDay()]} ${dt.getDate()} ${MONTHS_SV[dt.getMonth()]}`;
}

const RSVP_LABELS = { coming: "Kommer", not_coming: "Kommer inte", maybe: "Kanske" };
const RSVP_COLORS = {
  coming:     "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  not_coming: "bg-red-900/40 text-red-300 border-red-700/40",
  maybe:      "bg-amber-900/40 text-amber-300 border-amber-700/40",
};

/* ─── Section heading ─────────────────────────────────────────── */
function SH({ children }: { children: React.ReactNode }) {
  return <h2 className="font-bold text-slate-100 mb-3">{children}</h2>;
}

/* ═══════════════════════════════════════════════════════════════ */
export default function CupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();
  const canEdit = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;

  const [cup, setCup] = useState<Cup | null>(null);
  const [matches, setMatches] = useState<CupMatch[]>([]);
  const [packingList, setPackingList] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [rsvps, setRsvps] = useState<CupRsvp[]>([]);
  const [loading, setLoading] = useState(true);

  // Match form
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [mDate, setMDate] = useState("");
  const [mTime, setMTime] = useState("10:00");
  const [mOpponent, setMOpponent] = useState("");
  const [mLocation, setMLocation] = useState("");
  const [savingMatch, setSavingMatch] = useState(false);

  // Match result editing
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [resultDraft, setResultDraft] = useState("");

  // Packing list
  const [newItem, setNewItem] = useState("");
  const [savingPacking, setSavingPacking] = useState(false);

  // Contacts
  const [showContactForm, setShowContactForm] = useState(false);
  const [cName, setCName] = useState("");
  const [cRole, setCRole] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // RSVP
  const [myRsvp, setMyRsvp] = useState<CupRsvp["status"] | null>(null);
  const [myNote, setMyNote] = useState("");
  const [rsvpBusy, setRsvpBusy] = useState(false);

  // Edit cup info
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoDraft, setInfoDraft] = useState({ name: "", location: "", startDate: "", endDate: "", accommodation: "", notes: "" });
  const [savingInfo, setSavingInfo] = useState(false);

  /* ── Load ── */
  const load = useCallback(async () => {
    const [{ data: cupData }, { data: matchData }, { data: rsvpData }] = await Promise.all([
      supabase.from("cups").select("id, team_id, name, location, start_date, end_date, accommodation, notes, packing_list, contacts").eq("id", id).single(),
      supabase.from("cup_matches").select("id, date, time, opponent, location, result, sort_order").eq("cup_id", id).order("sort_order"),
      supabase.from("cup_rsvps").select("id, user_id, user_name, status, note").eq("cup_id", id),
    ]);
    if (cupData) {
      setCup({ id: cupData.id, teamId: cupData.team_id, name: cupData.name, location: cupData.location ?? "", startDate: cupData.start_date ?? "", endDate: cupData.end_date ?? "", accommodation: cupData.accommodation ?? "", notes: cupData.notes ?? "" });
      setPackingList(Array.isArray(cupData.packing_list) ? cupData.packing_list as string[] : []);
      setContacts(Array.isArray(cupData.contacts) ? cupData.contacts as Contact[] : []);
    }
    setMatches((matchData ?? []).map((m) => ({ id: m.id, date: m.date ?? "", time: m.time ?? "", opponent: m.opponent ?? "", location: m.location ?? "", result: m.result ?? "", sortOrder: m.sort_order ?? 0 })));
    const rows = (rsvpData ?? []).map((r) => ({ id: r.id, userId: r.user_id, userName: r.user_name ?? "", status: r.status as CupRsvp["status"], note: r.note ?? "" }));
    setRsvps(rows);
    if (user) { const mine = rows.find((r) => r.userId === user.id); setMyRsvp(mine?.status ?? null); setMyNote(mine?.note ?? ""); }
    setLoading(false);
  }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  /* ── Save cup info ── */
  const saveInfo = async () => {
    if (!cup) return;
    setSavingInfo(true);
    const { error } = await supabase.from("cups").update({
      name: infoDraft.name.trim(), location: infoDraft.location.trim() || null,
      start_date: infoDraft.startDate || null, end_date: infoDraft.endDate || null,
      accommodation: infoDraft.accommodation.trim() || null, notes: infoDraft.notes.trim() || null,
    }).eq("id", cup.id);
    setSavingInfo(false);
    if (error) { toast("Kunde inte spara.", "error"); return; }
    setCup((prev) => prev ? { ...prev, ...infoDraft } : prev);
    setEditingInfo(false);
    toast("Sparat!", "success");
  };

  /* ── Add match ── */
  const addMatch = async () => {
    if (!mOpponent.trim() || !cup) return;
    setSavingMatch(true);
    const { error } = await supabase.from("cup_matches").insert({
      cup_id: id, team_id: cup.teamId, date: mDate || null, time: mTime || null,
      opponent: mOpponent.trim(), location: mLocation.trim() || null, sort_order: matches.length,
    });
    setSavingMatch(false);
    if (error) { toast("Kunde inte lägga till match.", "error"); return; }
    setMOpponent(""); setMDate(""); setMTime("10:00"); setMLocation(""); setShowMatchForm(false);
    load();
  };

  /* ── Save match result ── */
  const saveResult = async (matchId: string) => {
    await supabase.from("cup_matches").update({ result: resultDraft.trim() || null }).eq("id", matchId);
    setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, result: resultDraft.trim() } : m));
    setEditingResultId(null);
  };

  /* ── Delete match ── */
  const deleteMatch = async (matchId: string) => {
    await supabase.from("cup_matches").delete().eq("id", matchId);
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  /* ── Packing list ── */
  const addPackingItem = async () => {
    if (!newItem.trim() || !cup) return;
    setSavingPacking(true);
    const updated = [...packingList, newItem.trim()];
    const { error } = await supabase.from("cups").update({ packing_list: updated }).eq("id", id);
    setSavingPacking(false);
    if (error) { toast("Kunde inte lägga till.", "error"); return; }
    setPackingList(updated); setNewItem("");
  };

  const removePackingItem = async (idx: number) => {
    const updated = packingList.filter((_, i) => i !== idx);
    await supabase.from("cups").update({ packing_list: updated }).eq("id", id);
    setPackingList(updated);
  };

  /* ── Contacts ── */
  const addContact = async () => {
    if (!cName.trim() || !cup) return;
    setSavingContact(true);
    const updated = [...contacts, { name: cName.trim(), role: cRole.trim(), phone: cPhone.trim() }];
    const { error } = await supabase.from("cups").update({ contacts: updated }).eq("id", id);
    setSavingContact(false);
    if (error) { toast("Kunde inte lägga till kontakt.", "error"); return; }
    setContacts(updated); setCName(""); setCRole(""); setCPhone(""); setShowContactForm(false);
  };

  const removeContact = async (idx: number) => {
    const updated = contacts.filter((_, i) => i !== idx);
    await supabase.from("cups").update({ contacts: updated }).eq("id", id);
    setContacts(updated);
  };

  /* ── RSVP ── */
  const submitRsvp = async (status: CupRsvp["status"]) => {
    if (!user || !cup || rsvpBusy) return;
    setRsvpBusy(true);
    if (myRsvp === status) {
      await supabase.from("cup_rsvps").delete().eq("cup_id", id).eq("user_id", user.id);
      setMyRsvp(null);
    } else {
      await supabase.from("cup_rsvps").upsert(
        { cup_id: id, team_id: cup.teamId, user_id: user.id, user_name: user.name, status, note: myNote.trim() || null },
        { onConflict: "cup_id,user_id" }
      );
      setMyRsvp(status);
    }
    setRsvpBusy(false);
    load();
  };

  /* ── Save RSVP note ── */
  const saveRsvpNote = async () => {
    if (!user || !cup || !myRsvp) return;
    await supabase.from("cup_rsvps").upsert(
      { cup_id: id, team_id: cup.teamId, user_id: user.id, user_name: user.name, status: myRsvp, note: myNote.trim() || null },
      { onConflict: "cup_id,user_id" }
    );
    load();
    toast("Kommentar sparad!", "success");
  };

  if (loading) return <div className="text-center py-16 text-slate-500">Laddar cup…</div>;
  if (!cup) return (
    <div className="text-center py-16">
      <p className="text-slate-400 mb-4">Cupen hittades inte.</p>
      <button onClick={() => router.push("/cup")} className="text-orange-400 hover:text-orange-300 text-sm">← Tillbaka till cuper</button>
    </div>
  );

  const coming     = rsvps.filter((r) => r.status === "coming");
  const notComing  = rsvps.filter((r) => r.status === "not_coming");
  const maybe      = rsvps.filter((r) => r.status === "maybe");

  return (
    <div className="max-w-2xl mx-auto pb-12 space-y-4">
      {/* Back */}
      <button onClick={() => router.push("/cup")} className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors">
        ← Tillbaka till cuper
      </button>

      {/* ── Cup header ── */}
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5">
        {editingInfo ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Namn</label>
              <input autoFocus value={infoDraft.name} onChange={(e) => setInfoDraft((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Plats</label>
                <input value={infoDraft.location} onChange={(e) => setInfoDraft((p) => ({ ...p, location: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Boende</label>
                <input value={infoDraft.accommodation} onChange={(e) => setInfoDraft((p) => ({ ...p, accommodation: e.target.value }))}
                  placeholder="T.ex. Hotell Scandic"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Start</label>
                <input type="date" value={infoDraft.startDate} onChange={(e) => setInfoDraft((p) => ({ ...p, startDate: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Slut</label>
                <input type="date" value={infoDraft.endDate} onChange={(e) => setInfoDraft((p) => ({ ...p, endDate: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Info</label>
              <textarea value={infoDraft.notes} onChange={(e) => setInfoDraft((p) => ({ ...p, notes: e.target.value }))}
                rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveInfo} disabled={savingInfo}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {savingInfo ? "Sparar…" : "Spara"}
              </button>
              <button onClick={() => setEditingInfo(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🏆</span>
                  <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">{cup.name}</h1>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-slate-400 mt-1">
                  {cup.location && <span>📍 {cup.location}</span>}
                  {cup.startDate && (
                    <span>📅 {cup.endDate && cup.endDate !== cup.startDate
                      ? `${fmtDate(cup.startDate)} – ${fmtDate(cup.endDate)}`
                      : fmtDate(cup.startDate)}</span>
                  )}
                  {cup.accommodation && <span>🏨 {cup.accommodation}</span>}
                </div>
                {cup.notes && <p className="text-sm text-slate-400 mt-2">{cup.notes}</p>}
              </div>
              {canEdit && (
                <button onClick={() => { setInfoDraft({ name: cup.name, location: cup.location, startDate: cup.startDate, endDate: cup.endDate, accommodation: cup.accommodation, notes: cup.notes }); setEditingInfo(true); }}
                  className="text-xs px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition-colors shrink-0">
                  ✏️ Redigera
                </button>
              )}
            </div>
            {/* RSVP summary chips */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-900/40 text-emerald-300 font-semibold">✓ {coming.length} kommer</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-900/40 text-red-300 font-semibold">✗ {notComing.length} kommer inte</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-900/40 text-amber-300 font-semibold">? {maybe.length} kanske</span>
            </div>
          </div>
        )}
      </div>

      {/* ── My RSVP ── */}
      {user && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <SH>Din anmälan</SH>
          <div className="flex gap-2 mb-3">
            {(["coming", "not_coming", "maybe"] as const).map((st) => (
              <button key={st} disabled={rsvpBusy} onClick={() => submitRsvp(st)}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  myRsvp === st
                    ? st === "coming" ? "bg-emerald-600 text-white" : st === "maybe" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                    : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                }`}>
                {st === "coming" ? "✓ Jag kommer" : st === "not_coming" ? "✗ Kan inte" : "? Kanske"}
              </button>
            ))}
          </div>
          {myRsvp && (
            <div className="flex gap-2">
              <input value={myNote} onChange={(e) => setMyNote(e.target.value)}
                placeholder="Kommentar (valfri)…"
                onKeyDown={(e) => { if (e.key === "Enter") saveRsvpNote(); }}
                className="flex-1 text-sm bg-slate-700 border border-slate-600 rounded-xl px-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              <button onClick={saveRsvpNote}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors">
                Spara
              </button>
            </div>
          )}
          {/* RSVP list */}
          {rsvps.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {rsvps.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === "coming" ? "bg-emerald-400" : r.status === "maybe" ? "bg-amber-400" : "bg-red-400"}`} />
                  <span className="text-sm text-slate-300 flex-1">{r.userName}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${RSVP_COLORS[r.status]}`}>{RSVP_LABELS[r.status]}</span>
                  {r.note && <span className="text-xs text-slate-500 italic truncate max-w-[120px]">"{r.note}"</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Match schedule ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <SH>Matchschema</SH>
          {canEdit && (
            <button onClick={() => setShowMatchForm((v) => !v)}
              className="text-xs px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors">
              + Lägg till match
            </button>
          )}
        </div>

        {showMatchForm && (
          <div className="bg-slate-900/60 rounded-xl p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Datum</label>
                <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Tid</label>
                <input type="time" value={mTime} onChange={(e) => setMTime(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
            </div>
            <input autoFocus value={mOpponent} onChange={(e) => setMOpponent(e.target.value)}
              placeholder="Motståndare *" required
              className="w-full px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            <input value={mLocation} onChange={(e) => setMLocation(e.target.value)}
              placeholder="Hall / Plats"
              className="w-full px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            <div className="flex gap-2">
              <button onClick={addMatch} disabled={savingMatch || !mOpponent.trim()}
                className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {savingMatch ? "…" : "Lägg till"}
              </button>
              <button onClick={() => setShowMatchForm(false)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        )}

        {matches.length === 0 ? (
          <p className="text-sm text-slate-500 italic">{canEdit ? "Inga matcher inlagda än." : "Inget schema publicerat än."}</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.id} className="flex items-center gap-3 bg-slate-900/40 rounded-xl px-3 py-2.5">
                <div className="shrink-0 text-center w-14">
                  {m.date && <p className="text-xs text-slate-400">{fmtDate(m.date)}</p>}
                  {m.time && <p className="text-sm font-bold text-slate-200">{m.time}</p>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">vs {m.opponent}</p>
                  {m.location && <p className="text-xs text-slate-500">{m.location}</p>}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {editingResultId === m.id ? (
                    <>
                      <input autoFocus value={resultDraft} onChange={(e) => setResultDraft(e.target.value)}
                        placeholder="T.ex. 78-65" onKeyDown={(e) => { if (e.key === "Enter") saveResult(m.id); if (e.key === "Escape") setEditingResultId(null); }}
                        className="w-20 text-xs bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                      <button onClick={() => saveResult(m.id)} className="text-xs px-2 py-1 bg-orange-500 text-white rounded-lg">OK</button>
                    </>
                  ) : m.result ? (
                    <button onClick={() => canEdit && (setEditingResultId(m.id), setResultDraft(m.result))}
                      className={`text-sm font-extrabold text-emerald-300 ${canEdit ? "hover:opacity-70 cursor-pointer" : ""}`}>
                      {m.result}
                    </button>
                  ) : canEdit ? (
                    <button onClick={() => { setEditingResultId(m.id); setResultDraft(""); }}
                      className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg transition-colors">
                      + Resultat
                    </button>
                  ) : null}
                  {canEdit && (
                    <button onClick={() => deleteMatch(m.id)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Packing list ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <SH>🎒 Packlista</SH>
        {packingList.length === 0 && !canEdit && (
          <p className="text-sm text-slate-500 italic">Ingen packlista publicerad än.</p>
        )}
        <div className="space-y-1.5 mb-3">
          {packingList.map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-2">
              <span className="text-sm text-slate-300 flex-1">{item}</span>
              {canEdit && (
                <button onClick={() => removePackingItem(i)} className="text-slate-600 hover:text-red-400 text-xs transition-colors">✕</button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)}
              placeholder="T.ex. Matchkläder, vattenflaska, mungisskydd…"
              onKeyDown={(e) => { if (e.key === "Enter") addPackingItem(); }}
              className="flex-1 text-sm bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            <button onClick={addPackingItem} disabled={savingPacking || !newItem.trim()}
              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              +
            </button>
          </div>
        )}
      </div>

      {/* ── Contacts ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <SH>📞 Kontakter</SH>
          {canEdit && (
            <button onClick={() => setShowContactForm((v) => !v)}
              className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-semibold transition-colors">
              + Lägg till
            </button>
          )}
        </div>
        {showContactForm && (
          <div className="bg-slate-900/60 rounded-xl p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input autoFocus value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Namn *"
                className="px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              <input value={cRole} onChange={(e) => setCRole(e.target.value)} placeholder="Roll (t.ex. Chaufför)"
                className="px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <input value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="Telefon"
              className="w-full px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            <div className="flex gap-2">
              <button onClick={addContact} disabled={savingContact || !cName.trim()}
                className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {savingContact ? "…" : "Lägg till"}
              </button>
              <button onClick={() => setShowContactForm(false)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        )}
        {contacts.length === 0 ? (
          <p className="text-sm text-slate-500 italic">{canEdit ? "Inga kontakter tillagda." : "Inga kontakter publicerade."}</p>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((c, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-700/40 rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">{c.name}</p>
                  {c.role && <p className="text-xs text-slate-500">{c.role}</p>}
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="text-sm font-mono text-orange-400 hover:text-orange-300 transition-colors shrink-0">
                    {c.phone}
                  </a>
                )}
                {canEdit && (
                  <button onClick={() => removeContact(i)} className="text-slate-600 hover:text-red-400 text-xs transition-colors shrink-0">✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
