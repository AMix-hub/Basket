"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

type DevItemCategory = "idea" | "change" | "todo";

interface DevItem {
  id: string;
  text: string;
  category: DevItemCategory;
  done: boolean;
  createdAt: string;
  doneAt?: string;
}

const categoryConfig: Record<DevItemCategory, { label: string; emoji: string; color: string }> = {
  idea:   { label: "Idé",      emoji: "💡", color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
  change: { label: "Ändring",  emoji: "🔧", color: "bg-blue-50 border-blue-200 text-blue-800" },
  todo:   { label: "Att göra", emoji: "📋", color: "bg-purple-50 border-purple-200 text-purple-800" },
};

export default function DevPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<DevItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState<DevItemCategory>("idea");
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<DevItemCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    if (!user?.roles.includes("admin")) return;

    const q = query(collection(db, "dev_items"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          text: d.data().text as string,
          category: d.data().category as DevItemCategory,
          done: d.data().done as boolean,
          createdAt: d.data().createdAt as string,
          doneAt: d.data().doneAt as string | undefined,
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setAdding(true);
    try {
      await addDoc(collection(db, "dev_items"), {
        text: newText.trim(),
        category: newCategory,
        done: false,
        createdAt: new Date().toISOString(),
      });
      setNewText("");
    } catch {
      alert("Det gick inte att lägga till. Försök igen.");
    } finally {
      setAdding(false);
    }
  };

  const toggleDone = async (item: DevItem) => {
    try {
      await updateDoc(doc(db, "dev_items", item.id), {
        done: !item.done,
        doneAt: !item.done ? new Date().toISOString() : null,
      });
    } catch {
      alert("Det gick inte att uppdatera. Försök igen.");
    }
  };

  const removeItem = async (item: DevItem) => {
    if (!confirm(`Ta bort "${item.text}"?`)) return;
    try {
      await deleteDoc(doc(db, "dev_items", item.id));
    } catch {
      alert("Det gick inte att ta bort. Försök igen.");
    }
  };

  const startEdit = (item: DevItem) => {
    if (item.done) return;
    setEditingId(item.id);
    setEditText(item.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (item: DevItem) => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === item.text.trim()) {
      cancelEdit();
      return;
    }
    try {
      await updateDoc(doc(db, "dev_items", item.id), { text: trimmed });
      cancelEdit();
    } catch {
      alert("Det gick inte att spara. Försök igen.");
    }
  };

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🛠</p>
          <p className="text-slate-600 mb-4">
            Du behöver logga in för att se den här sidan.
          </p>
          <Link
            href="/login"
            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600"
          >
            Logga in
          </Link>
        </div>
      </div>
    );
  }

  if (!user.roles.includes("admin")) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-slate-600">
            Den här sidan är bara tillgänglig för föreningsadmins.
          </p>
        </div>
      </div>
    );
  }

  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);
  const pending = filtered.filter((i) => !i.done);
  const done    = filtered.filter((i) => i.done);

  const noEditProps = {
    editing: false as const,
    editText: "",
    onEditStart: () => {},
    onEditChange: () => {},
    onEditSave: () => {},
    onEditCancel: () => {},
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🛠</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Utvecklingssida
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          En tillfällig sida för att samla idéer, ändringar och uppgifter under sidans utveckling.
        </p>
      </div>

      {/* Add new item */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="font-bold text-slate-900 mb-4">Lägg till</h2>
        <form onSubmit={addItem} className="flex flex-col sm:flex-row gap-3">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as DevItemCategory)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white hover:border-slate-400 transition-colors shrink-0"
          >
            {(Object.keys(categoryConfig) as DevItemCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {categoryConfig[cat].emoji} {categoryConfig[cat].label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Beskriv idén, ändringen eller uppgiften…"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
            required
          />
          <button
            type="submit"
            disabled={adding || !newText.trim()}
            className="px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 shrink-0"
          >
            {adding ? "Lägger till…" : "+ Lägg till"}
          </button>
        </form>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", ...Object.keys(categoryConfig)] as (DevItemCategory | "all")[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              filter === cat
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat === "all"
              ? `Alla (${items.length})`
              : `${categoryConfig[cat as DevItemCategory].emoji} ${categoryConfig[cat as DevItemCategory].label} (${items.filter((i) => i.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        {loading ? (
          <p className="text-slate-400 text-sm">Laddar…</p>
        ) : items.length === 0 ? (
          <p className="text-slate-400 text-sm">
            Inga poster ännu. Lägg till en idé eller uppgift ovan!
          </p>
        ) : (
          <div className="space-y-6">
            {/* Pending items */}
            {pending.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Att göra ({pending.length})
                </h3>
                <ul className="space-y-2">
                  {pending.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleDone(item)}
                      onDelete={() => removeItem(item)}
                      editing={editingId === item.id}
                      editText={editText}
                      onEditStart={() => startEdit(item)}
                      onEditChange={setEditText}
                      onEditSave={() => saveEdit(item)}
                      onEditCancel={cancelEdit}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* Done items */}
            {done.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Klart ({done.length})
                </h3>
                <ul className="space-y-2">
                  {done.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleDone(item)}
                      onDelete={() => removeItem(item)}
                      {...noEditProps}
                    />
                  ))}
                </ul>
              </div>
            )}

            {filtered.length === 0 && (
              <p className="text-slate-400 text-sm">Inga poster i den här kategorin.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
  editing,
  editText,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
}: {
  item: DevItem;
  onToggle: () => void;
  onDelete: () => void;
  editing: boolean;
  editText: string;
  onEditStart: () => void;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  const cat = categoryConfig[item.category];

  return (
    <li className="flex items-start gap-3">
      <button
        onClick={onToggle}
        aria-label={item.done ? "Markera som inte klart" : "Markera som klart"}
        className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
          item.done
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "border-slate-300 hover:border-emerald-400"
        }`}
      >
        {item.done && <span className="text-xs leading-none">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editText}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditSave();
                if (e.key === "Escape") onEditCancel();
              }}
              autoFocus
              className="flex-1 border border-orange-300 rounded-lg px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
            <button
              onClick={onEditSave}
              className="px-2 py-1 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Spara
            </button>
            <button
              onClick={onEditCancel}
              className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Avbryt
            </button>
          </div>
        ) : (
          <p className={`text-sm ${item.done ? "line-through text-slate-400" : "text-slate-800"}`}>
            {item.text}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cat.color}`}>
            {cat.emoji} {cat.label}
          </span>
          <span className="text-xs text-slate-400">
            {new Date(item.createdAt).toLocaleDateString("sv-SE")}
          </span>
          {item.done && item.doneAt && (
            <span className="text-xs text-emerald-600">
              ✓ Klar {new Date(item.doneAt).toLocaleDateString("sv-SE")}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {!item.done && !editing && (
          <button
            onClick={onEditStart}
            aria-label="Redigera"
            className="text-slate-300 hover:text-orange-500 transition-colors text-sm"
          >
            ✏️
          </button>
        )}
        <button
          onClick={onDelete}
          aria-label="Ta bort"
          className="text-slate-300 hover:text-red-500 transition-colors text-sm"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
