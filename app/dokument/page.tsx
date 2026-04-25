"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface TeamDocument {
  id: string;
  title: string;
  url: string;
  description: string;
  category: string;
  createdByName: string;
  createdAt: string;
}

const CATEGORIES = ["Policy", "Schema", "Cuper", "Regler", "Spelarsidan", "Övrigt"] as const;

const CATEGORY_ICONS: Record<string, string> = {
  Policy: "📜",
  Schema: "📅",
  Cuper: "🏆",
  Regler: "⚖️",
  Spelarsidan: "🏀",
  Övrigt: "📁",
};

export default function DokumentPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();

  const [docs, setDocs] = useState<TeamDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("Alla");

  const [form, setForm] = useState({
    title: "",
    url: "",
    description: "",
    category: "Övrigt",
  });
  const [formError, setFormError] = useState("");

  const isCoachOrAdmin = user?.roles.some((r) => ["coach", "admin"].includes(r)) ?? false;

  const loadDocs = useCallback(async () => {
    if (!team) { setDocs([]); setLoading(false); return; }
    const { data } = await supabase
      .from("team_documents")
      .select("id, title, url, description, category, created_by_name, created_at")
      .eq("team_id", team.id)
      .order("category")
      .order("created_at", { ascending: false });
    setDocs(
      (data ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        url: d.url,
        description: d.description ?? "",
        category: d.category ?? "Övrigt",
        createdByName: d.created_by_name ?? "",
        createdAt: d.created_at ?? "",
      }))
    );
    setLoading(false);
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const saveDoc = async () => {
    if (!user || !team) return;
    setFormError("");

    const title = form.title.trim();
    let url = form.url.trim();

    if (!title) { setFormError("Titel krävs."); return; }
    if (!url) { setFormError("Länk krävs."); return; }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    setSaving(true);
    const { error } = await supabase.from("team_documents").insert({
      team_id: team.id,
      title,
      url,
      description: form.description.trim() || null,
      category: form.category,
      created_by_name: user.name,
    });
    setSaving(false);

    if (error) { setFormError("Kunde inte spara dokumentet."); return; }
    setForm({ title: "", url: "", description: "", category: "Övrigt" });
    setShowForm(false);
    loadDocs();
  };

  const deleteDoc = async (id: string) => {
    setDeleteId(id);
    await supabase.from("team_documents").delete().eq("id", id);
    setDeleteId(null);
    loadDocs();
  };

  const filteredDocs =
    filterCategory === "Alla" ? docs : docs.filter((d) => d.category === filterCategory);

  const grouped = CATEGORIES.reduce<Record<string, TeamDocument[]>>((acc, cat) => {
    const items = filteredDocs.filter((d) => d.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const uncategorized = filteredDocs.filter(
    (d) => !CATEGORIES.includes(d.category as (typeof CATEGORIES)[number])
  );
  if (uncategorized.length > 0) grouped["Övrigt"] = [...(grouped["Övrigt"] ?? []), ...uncategorized];

  const usedCategories = CATEGORIES.filter((c) => docs.some((d) => d.category === c));

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-slate-400">Logga in för att se lagdokument.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">📂</span>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Dokument</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Lagets dokument, regler och viktiga länkar samlade på ett ställe.
          </p>
        </div>
        {isCoachOrAdmin && (
          <button
            onClick={() => { setShowForm((v) => !v); setFormError(""); }}
            className="shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {showForm ? "Avbryt" : "+ Lägg till"}
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && isCoachOrAdmin && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-slate-100 mb-4">Lägg till dokument / länk</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Titel *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="t.ex. Lagpolicy 2025"
                className="w-full bg-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 border border-slate-600 focus:outline-none focus:border-orange-500 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full bg-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 border border-slate-600 focus:outline-none focus:border-orange-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Länk (URL) *</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 border border-slate-600 focus:outline-none focus:border-orange-500 placeholder-slate-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Beskrivning (valfri)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Kort beskrivning av dokumentet..."
                className="w-full bg-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 border border-slate-600 focus:outline-none focus:border-orange-500 placeholder-slate-500"
              />
            </div>
          </div>
          {formError && <p className="text-red-400 text-sm mb-3">{formError}</p>}
          <button
            onClick={saveDoc}
            disabled={saving}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? "Sparar..." : "Spara"}
          </button>
        </div>
      )}

      {/* Category filter */}
      {usedCategories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {["Alla", ...usedCategories].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                filterCategory === cat
                  ? "bg-orange-500 text-white"
                  : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
              }`}
            >
              {cat !== "Alla" && CATEGORY_ICONS[cat] ? `${CATEGORY_ICONS[cat]} ` : ""}{cat}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center text-slate-500 py-16 text-sm">Laddar dokument...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-slate-400 text-sm">
            {isCoachOrAdmin
              ? "Inga dokument ännu. Klicka \"+ Lägg till\" för att lägga till ett."
              : "Inga dokument har lagts till ännu."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="font-bold text-slate-300 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>{CATEGORY_ICONS[category] ?? "📄"}</span>
                {category}
                <span className="text-slate-600 font-normal normal-case tracking-normal">
                  ({items.length})
                </span>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-2xl p-4 flex flex-col gap-2 group transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-slate-100 text-sm hover:text-orange-400 transition-colors leading-snug flex-1"
                      >
                        {doc.title}
                        <span className="ml-1 text-slate-500 text-xs">↗</span>
                      </a>
                      {isCoachOrAdmin && (
                        <button
                          onClick={() => deleteDoc(doc.id)}
                          disabled={deleteId === doc.id}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all text-xs shrink-0 mt-0.5"
                          title="Ta bort"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-slate-400 leading-relaxed">{doc.description}</p>
                    )}
                    <p className="text-xs text-slate-600 mt-auto">
                      Tillagd av {doc.createdByName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
