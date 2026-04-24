"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";

type Priority = "high" | "medium" | "low";
type Status = "open" | "in_progress" | "done";

interface Item {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  createdAt: string;
}

const PRIORITY: Record<Priority, { label: string; color: string; order: number }> = {
  high:   { label: "Hög",    color: "text-red-400",   order: 0 },
  medium: { label: "Medium", color: "text-amber-400",  order: 1 },
  low:    { label: "Låg",    color: "text-green-400",  order: 2 },
};

const STATUS: Record<Status, { label: string; next: Status; color: string }> = {
  open:        { label: "Att göra",    next: "in_progress", color: "bg-slate-700 text-slate-300" },
  in_progress: { label: "Pågår",       next: "done",        color: "bg-blue-900/50 text-blue-300" },
  done:        { label: "Klar",        next: "open",        color: "bg-green-900/50 text-green-300" },
};

export default function DevPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const load = () =>
      supabase.from("dev_items").select("*").order("created_at", { ascending: false })
        .then(({ data }) => {
          if (!mounted) return;
          setItems((data ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            description: d.description ?? "",
            status: d.status as Status,
            priority: d.priority as Priority,
            createdAt: d.created_at,
          })));
          setLoading(false);
        });

    load();
    const ch = supabase.channel("dev-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "dev_items" }, load)
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user?.id]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;
    await supabase.from("dev_items").insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      status: "open",
      priority: newPriority,
      created_by: user.id,
    });
    setNewTitle("");
    setNewDesc("");
    setNewPriority("medium");
    inputRef.current?.focus();
  };

  const cycleStatus = async (item: Item) => {
    const next = STATUS[item.status].next;
    await supabase.from("dev_items").update({ status: next }).eq("id", item.id);
  };

  const cyclePriority = async (item: Item) => {
    const order: Priority[] = ["high", "medium", "low"];
    const next = order[(order.indexOf(item.priority) + 1) % order.length];
    await supabase.from("dev_items").update({ priority: next }).eq("id", item.id);
  };

  const deleteItem = async (id: string) => {
    await supabase.from("dev_items").delete().eq("id", id);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-400">Logga in för att se den här sidan.</p>
      </div>
    );
  }

  const filtered = items.filter((i) => filter === "all" || i.status === filter);
  const sorted = [...filtered].sort((a, b) =>
    PRIORITY[a.priority].order - PRIORITY[b.priority].order ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const counts: Record<Status | "all", number> = {
    all: items.length,
    open: items.filter(i => i.status === "open").length,
    in_progress: items.filter(i => i.status === "in_progress").length,
    done: items.filter(i => i.status === "done").length,
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">

      <div className="flex items-center gap-3">
        <span className="text-3xl">🛠</span>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Dev-lista</h1>
      </div>

      {/* Add form */}
      <form onSubmit={addItem} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ny idé eller uppgift…"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
            required
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Priority)}
            className="bg-slate-900 border border-slate-600 rounded-xl px-2 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            <option value="high">🔴 Hög</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Låg</option>
          </select>
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors shrink-0"
          >
            + Lägg till
          </button>
        </div>
        <input
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Beskrivning (valfritt)…"
          className="bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </form>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "open", "in_progress", "done"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${filter === s ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}>
            {s === "all" ? `Alla (${counts.all})` : `${STATUS[s].label} (${counts[s]})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="text-slate-400 text-sm text-center py-8">Laddar…</p>
        ) : sorted.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">Inga poster här.</p>
        ) : sorted.map((item) => (
          <div key={item.id} className={`bg-slate-800 border border-slate-700 rounded-xl p-3 flex flex-col gap-1 ${item.status === "done" ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <button onClick={() => cycleStatus(item)}
                className={`text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0 transition-colors ${STATUS[item.status].color}`}>
                {STATUS[item.status].label}
              </button>
              <span className={`text-sm font-medium flex-1 min-w-0 ${item.status === "done" ? "line-through text-slate-400" : "text-slate-100"}`}>
                {item.title}
              </span>
              <button onClick={() => cyclePriority(item)}
                className={`text-xs shrink-0 ${PRIORITY[item.priority].color}`}>
                {PRIORITY[item.priority].label}
              </button>
              {item.description && (
                <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="text-slate-500 hover:text-slate-300 text-xs shrink-0">
                  {expandedId === item.id ? "▲" : "▼"}
                </button>
              )}
              <button onClick={() => deleteItem(item.id)}
                className="text-slate-600 hover:text-red-400 transition-colors text-xs shrink-0">✕</button>
            </div>
            {expandedId === item.id && item.description && (
              <p className="text-xs text-slate-400 pl-1 pt-1">{item.description}</p>
            )}
            <p className="text-xs text-slate-600">{new Date(item.createdAt).toLocaleDateString("sv-SE")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
