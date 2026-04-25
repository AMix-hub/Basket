"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

interface TemplateItem {
  title: string;
  duration_minutes: number;
  description: string | null;
}

interface Template {
  id: string;
  name: string;
  items: TemplateItem[];
  createdAt: string;
}

export default function MallarPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();
  const canEdit = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create template
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formItems, setFormItems] = useState<{ title: string; duration: string; description: string }[]>([
    { title: "", duration: "15", description: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!team) { setLoading(false); return; }
    const { data } = await supabase.from("session_templates")
      .select("id, name, items, created_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false });
    setTemplates((data ?? []).map((t) => ({
      id: t.id, name: t.name,
      items: Array.isArray(t.items) ? t.items : [],
      createdAt: t.created_at,
    })));
    setLoading(false);
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const addFormItem = () =>
    setFormItems((prev) => [...prev, { title: "", duration: "15", description: "" }]);

  const updateFormItem = (i: number, field: "title" | "duration" | "description", value: string) =>
    setFormItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const removeFormItem = (i: number) =>
    setFormItems((prev) => prev.filter((_, idx) => idx !== i));

  const createTemplate = async () => {
    if (!formName.trim() || !team) return;
    const validItems = formItems.filter((i) => i.title.trim());
    if (validItems.length === 0) { toast("Lägg till minst ett moment.", "error"); return; }
    setSaving(true);
    const items = validItems.map((i) => ({
      title: i.title.trim(),
      duration_minutes: parseInt(i.duration) || 15,
      description: i.description.trim() || null,
    }));
    const { error } = await supabase.from("session_templates").insert({
      team_id: team.id, name: formName.trim(), items, created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast("Kunde inte spara mall.", "error"); return; }
    setShowForm(false);
    setFormName("");
    setFormItems([{ title: "", duration: "15", description: "" }]);
    loadTemplates();
    toast("Mall skapad!", "success");
  };

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Ta bort mallen "${name}"?`)) return;
    setDeletingId(id);
    await supabase.from("session_templates").delete().eq("id", id);
    setDeletingId(null);
    loadTemplates();
    toast("Mall borttagen.", "success");
  };

  if (loading) return <div className="text-center py-16 text-slate-500">Laddar mallar…</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">📋</span>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Träningsmallar</h1>
          </div>
          <p className="text-slate-500 text-sm">Spara och återanvänd träningsupplägg direkt från ett träningspass.</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            {showForm ? "Avbryt" : "+ Ny mall"}
          </button>
        )}
      </div>

      {/* How-to hint */}
      {templates.length === 0 && !showForm && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-5 text-sm text-slate-400">
          <p className="font-semibold text-slate-300 mb-1">Hur skapar du mallar?</p>
          <p>Öppna ett träningspass med moment och klicka <strong>💾 Mall</strong> i träningsplanens rubrik — momenteten sparas direkt som en mall.</p>
          <p className="mt-1">Du kan också skapa en mall manuellt här med knappen ovan.</p>
        </div>
      )}

      {/* Create form */}
      {showForm && canEdit && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-slate-100 mb-4">Skapa mall</h2>
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-400 block mb-1">Mallnamn <span className="text-red-400">*</span></label>
            <input autoFocus value={formName} onChange={(e) => setFormName(e.target.value)}
              placeholder="T.ex. Passningsfokus 60 min"
              className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>

          <div className="space-y-2 mb-3">
            <p className="text-xs font-semibold text-slate-400">Moment</p>
            {formItems.map((item, i) => (
              <div key={i} className="bg-slate-700/50 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input value={item.title} onChange={(e) => updateFormItem(i, "title", e.target.value)}
                    placeholder={`Moment ${i + 1}, t.ex. Uppvärmning`}
                    className="flex-1 px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  <div className="flex items-center gap-1 shrink-0">
                    <input type="number" value={item.duration} onChange={(e) => updateFormItem(i, "duration", e.target.value)}
                      min="1" max="120"
                      className="w-14 text-center px-2 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                    <span className="text-xs text-slate-500">min</span>
                  </div>
                  {formItems.length > 1 && (
                    <button onClick={() => removeFormItem(i)} className="text-slate-600 hover:text-red-400 transition-colors text-sm px-1">✕</button>
                  )}
                </div>
                <input value={item.description} onChange={(e) => updateFormItem(i, "description", e.target.value)}
                  placeholder="Beskrivning (valfritt)"
                  className="px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
            ))}
            <button onClick={addFormItem} className="text-xs text-orange-400 hover:text-orange-300 font-semibold transition-colors">
              + Lägg till moment
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={createTemplate} disabled={saving || !formName.trim()}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? "Sparar…" : "Spara mall"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates.length === 0 && !showForm ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-slate-500 text-sm">Inga mallar skapade ännu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const isExpanded = expandedId === t.id;
            const totalMin = t.items.reduce((s, i) => s + i.duration_minutes, 0);
            return (
              <div key={t.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-slate-700/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                    <span className="text-lg">📋</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-100">{t.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t.items.length} moment · {totalMin} min totalt</p>
                  </div>
                  <span className={`text-slate-500 text-xs shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-700 px-4 pb-4 pt-3">
                    {/* Items */}
                    <div className="space-y-1.5 mb-4">
                      {t.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 bg-slate-900/40 rounded-xl px-3 py-2.5">
                          <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-orange-400">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-200">{item.title}</span>
                              <span className="text-xs text-slate-500 shrink-0">{item.duration_minutes} min</span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Timebar */}
                    {t.items.length > 0 && (
                      <div className="flex gap-1 mb-4 rounded-full overflow-hidden h-2">
                        {t.items.map((item, i) => (
                          <div key={i} style={{ flex: item.duration_minutes }}
                            className="bg-orange-500/60"
                            title={`${item.title} – ${item.duration_minutes} min`} />
                        ))}
                      </div>
                    )}

                    {canEdit && (
                      <button onClick={() => deleteTemplate(t.id, t.name)} disabled={deletingId === t.id}
                        className="text-xs px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors disabled:opacity-50">
                        {deletingId === t.id ? "Tar bort…" : "✕ Ta bort mall"}
                      </button>
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
