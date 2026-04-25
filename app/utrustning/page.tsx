"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

const CATEGORIES = ["Bollar", "Koner & Markeringar", "Västar", "Matchkläder", "Träningsutrustning", "Övrigt"];
const STATUS_OPTIONS = ["ok", "utlånad", "skadad", "saknas"] as const;
type EquipStatus = typeof STATUS_OPTIONS[number];

const STATUS_CONFIG: Record<EquipStatus, { label: string; color: string; dot: string }> = {
  ok:       { label: "OK",       color: "bg-emerald-900/30 text-emerald-400", dot: "bg-emerald-400" },
  utlånad:  { label: "Utlånad", color: "bg-amber-900/30 text-amber-400",     dot: "bg-amber-400" },
  skadad:   { label: "Skadad",  color: "bg-red-900/30 text-red-400",         dot: "bg-red-400" },
  saknas:   { label: "Saknas",  color: "bg-slate-700 text-slate-500",         dot: "bg-slate-500" },
};

interface EquipItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  status: EquipStatus;
  loanedTo: string;
  notes: string;
  size: string;
}

export default function UtrustningPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();
  const canEdit = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;

  const [items, setItems] = useState<EquipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state (shared for add + edit)
  const [fName, setFName] = useState("");
  const [fCategory, setFCategory] = useState(CATEGORIES[0]);
  const [fQuantity, setFQuantity] = useState("1");
  const [fStatus, setFStatus] = useState<EquipStatus>("ok");
  const [fLoanedTo, setFLoanedTo] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fSize, setFSize] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFName(""); setFCategory(CATEGORIES[0]); setFQuantity("1");
    setFStatus("ok"); setFLoanedTo(""); setFNotes(""); setFSize("");
  };

  const loadItems = useCallback(async () => {
    if (!team) { setLoading(false); return; }
    const { data } = await supabase.from("equipment")
      .select("id, name, category, quantity, status, loaned_to, notes, size")
      .eq("team_id", team.id)
      .order("category").order("name");
    setItems((data ?? []).map((d) => ({
      id: d.id, name: d.name, category: d.category ?? "Övrigt",
      quantity: d.quantity ?? 1, status: (d.status ?? "ok") as EquipStatus,
      loanedTo: d.loaned_to ?? "", notes: d.notes ?? "", size: d.size ?? "",
    })));
    setLoading(false);
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadItems(); }, [loadItems]);

  const startEdit = (item: EquipItem) => {
    setEditingId(item.id);
    setFName(item.name); setFCategory(item.category); setFQuantity(String(item.quantity));
    setFStatus(item.status); setFLoanedTo(item.loanedTo); setFNotes(item.notes); setFSize(item.size);
    setShowForm(false);
  };

  const saveItem = async () => {
    if (!fName.trim() || !team) return;
    setSaving(true);
    const payload = {
      team_id: team.id, name: fName.trim(), category: fCategory,
      quantity: parseInt(fQuantity) || 1, status: fStatus,
      loaned_to: fLoanedTo.trim() || null, notes: fNotes.trim() || null,
      size: fSize.trim() || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("equipment").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("equipment").insert(payload));
    }
    setSaving(false);
    if (error) { toast("Kunde inte spara.", "error"); return; }
    setEditingId(null); setShowForm(false); resetForm();
    loadItems();
    toast(editingId ? "Uppdaterat!" : "Utrustning tillagd!", "success");
  };

  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`Ta bort "${name}"?`)) return;
    await supabase.from("equipment").delete().eq("id", id);
    loadItems();
    toast("Borttagen.", "success");
  };

  const quickStatusUpdate = async (id: string, status: EquipStatus, loanedTo?: string) => {
    await supabase.from("equipment").update({ status, loaned_to: loanedTo ?? null }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status, loanedTo: loanedTo ?? "" } : i));
  };

  // Group by category
  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  const uncategorized = items.filter((i) => !CATEGORIES.includes(i.category));
  if (uncategorized.length > 0) grouped.push({ cat: "Övrigt", items: uncategorized });

  const totalItems = items.length;
  const loaned = items.filter((i) => i.status === "utlånad").length;
  const damaged = items.filter((i) => i.status === "skadad" || i.status === "saknas").length;

  if (loading) return <div className="text-center py-16 text-slate-500">Laddar utrustning…</div>;

  const FormPanel = () => (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-6">
      <h2 className="font-bold text-slate-100 mb-4">{editingId ? "Redigera utrustning" : "Lägg till utrustning"}</h2>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-400 block mb-1">Namn <span className="text-red-400">*</span></label>
          <input autoFocus value={fName} onChange={(e) => setFName(e.target.value)}
            placeholder="T.ex. Basketbollar"
            className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">Kategori</label>
          <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">Antal</label>
          <input type="number" min="1" value={fQuantity} onChange={(e) => setFQuantity(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">Status</label>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as EquipStatus)}
            className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        </div>
        {fStatus === "utlånad" && (
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Utlånad till</label>
            <input value={fLoanedTo} onChange={(e) => setFLoanedTo(e.target.value)}
              placeholder="Namn eller lag"
              className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">Storlek (valfritt)</label>
          <input value={fSize} onChange={(e) => setFSize(e.target.value)}
            placeholder="T.ex. S/M/L eller 164–170"
            className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-400 block mb-1">Anteckningar</label>
          <input value={fNotes} onChange={(e) => setFNotes(e.target.value)}
            placeholder="T.ex. beställ fler, repareras hos X…"
            className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={saveItem} disabled={saving || !fName.trim()}
          className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
          {saving ? "Sparar…" : editingId ? "Uppdatera" : "Lägg till"}
        </button>
        <button onClick={() => { setEditingId(null); setShowForm(false); resetForm(); }}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
          Avbryt
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎒</span>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Utrustning</h1>
          </div>
          <p className="text-slate-500 text-sm">Inventarielista, utlån och utrustningsstatus.</p>
        </div>
        {canEdit && !editingId && (
          <button onClick={() => { setShowForm((v) => !v); setEditingId(null); resetForm(); }}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            {showForm ? "Avbryt" : "+ Lägg till"}
          </button>
        )}
      </div>

      {/* Stats row */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-100">{totalItems}</p>
            <p className="text-xs text-slate-500 mt-0.5">Artiklar</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <p className={`text-2xl font-extrabold ${loaned > 0 ? "text-amber-400" : "text-slate-100"}`}>{loaned}</p>
            <p className="text-xs text-slate-500 mt-0.5">Utlånade</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <p className={`text-2xl font-extrabold ${damaged > 0 ? "text-red-400" : "text-slate-100"}`}>{damaged}</p>
            <p className="text-xs text-slate-500 mt-0.5">Skadade/saknas</p>
          </div>
        </div>
      )}

      {(showForm && !editingId) && <FormPanel />}
      {editingId && <FormPanel />}

      {items.length === 0 && !showForm ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🎒</p>
          <p className="text-slate-500 text-sm">
            {canEdit ? "Ingen utrustning registrerad. Klicka \"+ Lägg till\" för att börja." : "Ingen utrustning registrerad."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ cat, items: catItems }) => (
            <section key={cat}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{cat}</p>
              <div className="space-y-2">
                {catItems.map((item) => {
                  const cfg = STATUS_CONFIG[item.status];
                  return (
                    <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-100 text-sm">{item.name}</span>
                            {item.quantity > 1 && (
                              <span className="text-xs text-slate-500">×{item.quantity}</span>
                            )}
                            {item.size && (
                              <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">{item.size}</span>
                            )}
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          {item.loanedTo && (
                            <p className="text-xs text-amber-400 mt-0.5">→ {item.loanedTo}</p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-slate-500 mt-0.5 italic">{item.notes}</p>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Quick status toggle */}
                            {item.status !== "ok" && (
                              <button onClick={() => quickStatusUpdate(item.id, "ok")}
                                title="Markera som OK"
                                className="text-xs px-2 py-1 bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-400 rounded-lg transition-colors">
                                ✓
                              </button>
                            )}
                            <button onClick={() => startEdit(item)}
                              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg transition-colors">
                              ✏️
                            </button>
                            <button onClick={() => deleteItem(item.id, item.name)}
                              className="text-xs px-2 py-1 bg-red-900/20 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors">
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
