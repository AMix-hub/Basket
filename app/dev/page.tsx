"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface Comment {
  id: string;
  itemId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

const PRIORITY: Record<Priority, { label: string; color: string; order: number }> = {
  high:   { label: "Hög",    color: "text-red-400",   order: 0 },
  medium: { label: "Medium", color: "text-amber-400",  order: 1 },
  low:    { label: "Låg",    color: "text-green-400",  order: 2 },
};

const STATUS: Record<Status, { label: string; color: string; dot: string }> = {
  open:        { label: "Att göra", color: "bg-slate-700 text-slate-300",      dot: "bg-slate-400" },
  in_progress: { label: "Pågår",    color: "bg-blue-900/50 text-blue-300",     dot: "bg-blue-400" },
  done:        { label: "Klar",     color: "bg-green-900/50 text-green-300",   dot: "bg-green-400" },
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

  // Comments state
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("dev_items").select("*").order("created_at", { ascending: false });
    setItems((data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description ?? "",
      status: d.status as Status,
      priority: d.priority as Priority,
      createdAt: d.created_at,
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel("dev-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "dev_items" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, load]);

  const loadComments = useCallback(async (itemId: string) => {
    const { data } = await supabase
      .from("dev_comments")
      .select("*")
      .eq("item_id", itemId)
      .order("created_at", { ascending: true });
    setComments((prev) => ({
      ...prev,
      [itemId]: (data ?? []).map((d) => ({
        id: d.id, itemId: d.item_id, authorName: d.author_name ?? "Okänd",
        text: d.text, createdAt: d.created_at,
      })),
    }));
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setNewComment("");
    } else {
      setExpandedId(id);
      setNewComment("");
      loadComments(id);
    }
  };

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
    load();
  };

  const setStatus = async (item: Item, status: Status) => {
    await supabase.from("dev_items").update({ status }).eq("id", item.id);
    load();
  };

  const cyclePriority = async (item: Item) => {
    const order: Priority[] = ["high", "medium", "low"];
    const next = order[(order.indexOf(item.priority) + 1) % order.length];
    await supabase.from("dev_items").update({ priority: next }).eq("id", item.id);
    load();
  };

  const deleteItem = async (id: string) => {
    await supabase.from("dev_items").delete().eq("id", id);
    if (expandedId === id) setExpandedId(null);
    load();
  };

  const addComment = async (itemId: string) => {
    if (!newComment.trim() || !user || savingComment) return;
    setSavingComment(true);
    try {
      await supabase.from("dev_comments").insert({
        item_id: itemId,
        author_id: user.id,
        author_name: user.name,
        text: newComment.trim(),
      });
      setNewComment("");
      loadComments(itemId);
    } finally {
      setSavingComment(false);
    }
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
        ) : sorted.map((item) => {
          const isExpanded = expandedId === item.id;
          const itemComments = comments[item.id] ?? [];
          return (
            <div key={item.id} className={`bg-slate-800 border border-slate-700 rounded-xl overflow-hidden ${item.status === "done" ? "opacity-60" : ""}`}>
              {/* Header row */}
              <div className="flex items-center gap-2 px-3 py-3">
                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS[item.status].dot}`} />

                {/* Title */}
                <span className={`text-sm font-medium flex-1 min-w-0 truncate ${item.status === "done" ? "line-through text-slate-400" : "text-slate-100"}`}>
                  {item.title}
                </span>

                {/* Priority */}
                <button onClick={() => cyclePriority(item)}
                  className={`text-xs shrink-0 font-medium ${PRIORITY[item.priority].color}`}
                  title="Klicka för att ändra prioritet">
                  {PRIORITY[item.priority].label}
                </button>

                {/* Comment count */}
                {(comments[item.id]?.length ?? 0) > 0 && (
                  <span className="text-xs text-slate-500 shrink-0">
                    💬 {comments[item.id].length}
                  </span>
                )}

                {/* Expand */}
                <button onClick={() => toggleExpand(item.id)}
                  className="text-slate-500 hover:text-slate-300 text-xs shrink-0 px-1">
                  {isExpanded ? "▲" : "▼"}
                </button>

                {/* Delete */}
                <button onClick={() => deleteItem(item.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors text-xs shrink-0">✕</button>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="border-t border-slate-700 px-3 py-3 flex flex-col gap-3">

                  {/* Description */}
                  {item.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                  )}

                  {/* Status actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 font-medium">Status:</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${STATUS[item.status].color}`}>
                      {STATUS[item.status].label}
                    </span>
                    {item.status === "open" && (
                      <button
                        onClick={() => setStatus(item, "in_progress")}
                        className="text-xs px-3 py-1 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 rounded-lg font-semibold transition-colors"
                      >
                        → Starta
                      </button>
                    )}
                    {item.status === "in_progress" && (
                      <>
                        <button
                          onClick={() => setStatus(item, "done")}
                          className="text-xs px-3 py-1 bg-green-900/40 hover:bg-green-800/60 text-green-300 rounded-lg font-semibold transition-colors"
                        >
                          ✓ Markera klar
                        </button>
                        <button
                          onClick={() => setStatus(item, "open")}
                          className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg font-semibold transition-colors"
                        >
                          ← Återöppna
                        </button>
                      </>
                    )}
                    {item.status === "done" && (
                      <button
                        onClick={() => setStatus(item, "open")}
                        className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg font-semibold transition-colors"
                      >
                        ↩ Återöppna
                      </button>
                    )}
                  </div>

                  {/* Comments */}
                  <div className="flex flex-col gap-2">
                    {itemComments.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {itemComments.map((c) => (
                          <div key={c.id} className="bg-slate-900/60 rounded-lg px-3 py-2">
                            <p className="text-xs text-slate-200 leading-relaxed">{c.text}</p>
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs text-slate-500">{c.authorName}</span>
                              <span className="text-xs text-slate-600">
                                {new Date(c.createdAt).toLocaleDateString("sv-SE")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add comment */}
                    <div className="flex gap-2">
                      <input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(item.id); } }}
                        placeholder="Skriv en kommentar…"
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                      <button
                        onClick={() => addComment(item.id)}
                        disabled={!newComment.trim() || savingComment}
                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
                      >
                        Skicka
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600">{new Date(item.createdAt).toLocaleDateString("sv-SE")}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
