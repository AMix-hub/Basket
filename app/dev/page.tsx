"use client";

import { useState, useEffect, useRef } from "react";
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
  const [showAddForm, setShowAddForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (showAddForm) {
      // Wait for modal to render before focusing the input
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showAddForm]);

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
      setShowAddForm(false);
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

  return (
    <div className="pb-24">
      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
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
      {loading ? (
        <p className="text-slate-400 text-sm">Laddar…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-400 text-sm">
          Inga poster ännu. Tryck på knappen nedan för att lägga till en idé eller uppgift!
        </p>
      ) : (
        <div className="space-y-6">
          {/* Pending items */}
          {pending.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-3">
                ATT GÖRA ({pending.length})
              </h3>
              <ul className="space-y-2">
                {pending.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleDone(item)}
                    onDelete={() => removeItem(item)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Done items */}
          {done.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-3">
                KLART ({done.length})
              </h3>
              <ul className="space-y-2">
                {done.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleDone(item)}
                    onDelete={() => removeItem(item)}
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

      {/* Add item modal overlay */}
      {showAddForm && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false); }}
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-slate-900 mb-4">Lägg till</h2>
            <form onSubmit={addItem} className="flex flex-col gap-3">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as DevItemCategory)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white hover:border-slate-400 transition-colors"
              >
                {(Object.keys(categoryConfig) as DevItemCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryConfig[cat].emoji} {categoryConfig[cat].label}
                  </option>
                ))}
              </select>
              <input
                ref={inputRef}
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Beskriv idén, ändringen eller uppgiften…"
                className="border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                required
              />
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={adding || !newText.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {adding ? "Lägger till…" : "Lägg till"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating action button */}
      <button
        onClick={() => setShowAddForm(true)}
        aria-label="Lägg till ny post"
        className="fixed bottom-6 right-6 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-colors z-30"
      >
        📋
      </button>
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: DevItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const cat = categoryConfig[item.category];

  return (
    <li className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
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
        <p className={`text-sm ${item.done ? "line-through text-slate-400" : "text-slate-800"}`}>
          {item.text}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
      <button
        onClick={onDelete}
        aria-label="Ta bort"
        className="text-slate-300 hover:text-red-500 transition-colors text-sm shrink-0 mt-0.5"
      >
        ✕
      </button>
    </li>
  );
}
