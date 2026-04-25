"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

interface Cup {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
}

const MONTHS_SV = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
function fmtDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${dt.getDate()} ${MONTHS_SV[dt.getMonth()]} ${dt.getFullYear()}`;
}
function fmtDateShort(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${dt.getDate()} ${MONTHS_SV[dt.getMonth()]}`;
}

export default function CupPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();
  const canEdit = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;

  const [cups, setCups] = useState<Cup[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCups = useCallback(async () => {
    if (!team) { setLoading(false); return; }
    const { data } = await supabase.from("cups")
      .select("id, name, location, start_date, end_date, notes, created_at")
      .eq("team_id", team.id)
      .order("start_date", { ascending: false });
    setCups((data ?? []).map((c) => ({
      id: c.id, name: c.name, location: c.location ?? "",
      startDate: c.start_date ?? "", endDate: c.end_date ?? "",
      notes: c.notes ?? "", createdAt: c.created_at,
    })));
    setLoading(false);
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCups(); }, [loadCups]);

  const createCup = async () => {
    if (!name.trim() || !team) return;
    setSaving(true);
    const { error } = await supabase.from("cups").insert({
      team_id: team.id, name: name.trim(),
      location: location.trim() || null,
      start_date: startDate || null, end_date: endDate || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast("Kunde inte skapa cup.", "error"); return; }
    setName(""); setLocation(""); setStartDate(""); setEndDate(""); setNotes("");
    setShowForm(false);
    loadCups();
    toast("Cup skapad!", "success");
  };

  const deleteCup = async (id: string, name: string) => {
    if (!confirm(`Ta bort "${name}"? Alla matchscheman och RSVPs tas bort.`)) return;
    await supabase.from("cups").delete().eq("id", id);
    loadCups();
    toast("Cup borttagen.", "success");
  };

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = cups.filter((c) => !c.endDate || c.endDate >= today);
  const past     = cups.filter((c) => c.endDate && c.endDate < today);

  if (loading) return <div className="text-center py-16 text-slate-500">Laddar cuper…</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🏆</span>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Cuper & Läger</h1>
          </div>
          <p className="text-slate-500 text-sm">Hantera matchschema, packlistor, boende och kallelser.</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            {showForm ? "Avbryt" : "+ Ny cup / läger"}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && canEdit && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-6">
          <h2 className="font-bold text-slate-100 mb-3">Skapa cup eller läger</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Namn <span className="text-red-400">*</span></label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                placeholder="T.ex. Göteborgscupen 2025"
                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Plats / Ort</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="T.ex. Göteborg, Frölundaborg"
                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Startdatum</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Slutdatum</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Info / Anteckningar</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={2} placeholder="Samlingsplats, bussinfo, annat viktigt…"
                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={createCup} disabled={saving || !name.trim()}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {saving ? "Skapar…" : "Skapa"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {cups.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-slate-500 text-sm">
            {canEdit ? "Inga cuper skapade. Klicka \"+ Ny cup / läger\" för att komma igång." : "Inga cuper inlagda."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <section>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Kommande</p>
              <div className="space-y-3">
                {upcoming.map((cup) => (
                  <CupCard key={cup.id} cup={cup} canEdit={canEdit} onDelete={deleteCup}
                    fmtDate={fmtDate} fmtDateShort={fmtDateShort} isUpcoming />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Genomförda</p>
              <div className="space-y-3">
                {past.map((cup) => (
                  <CupCard key={cup.id} cup={cup} canEdit={canEdit} onDelete={deleteCup}
                    fmtDate={fmtDate} fmtDateShort={fmtDateShort} isUpcoming={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function CupCard({ cup, canEdit, onDelete, fmtDate, fmtDateShort, isUpcoming }: {
  cup: Cup;
  canEdit: boolean;
  onDelete: (id: string, name: string) => void;
  fmtDate: (d: string) => string;
  fmtDateShort: (d: string) => string;
  isUpcoming: boolean;
}) {
  return (
    <div className={`bg-slate-800 border rounded-2xl overflow-hidden ${isUpcoming ? "border-orange-500/30" : "border-slate-700"}`}>
      <div className="flex items-center gap-4 p-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${isUpcoming ? "bg-orange-500/20" : "bg-slate-700"}`}>
          🏆
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-100">{cup.name}</p>
          <div className="flex flex-wrap gap-2 mt-0.5">
            {cup.location && <span className="text-xs text-slate-400">📍 {cup.location}</span>}
            {cup.startDate && (
              <span className="text-xs text-slate-400">
                📅 {cup.endDate && cup.endDate !== cup.startDate
                  ? `${fmtDateShort(cup.startDate)} – ${fmtDate(cup.endDate)}`
                  : fmtDate(cup.startDate)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/cup/${cup.id}`}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors">
            Öppna →
          </Link>
          {canEdit && (
            <button onClick={() => onDelete(cup.id, cup.name)}
              className="text-xs px-2 py-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors">
              ✕
            </button>
          )}
        </div>
      </div>
      {cup.notes && (
        <div className="px-4 pb-3 border-t border-slate-700/50 pt-2">
          <p className="text-xs text-slate-400">{cup.notes}</p>
        </div>
      )}
    </div>
  );
}
