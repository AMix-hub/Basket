"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";

type DevItemCategory = "idea" | "change" | "todo";
type DevItemPriority = "high" | "medium" | "low";

interface DevItem {
  id: string;
  text: string;
  category: DevItemCategory;
  priority: DevItemPriority;
  done: boolean;
  createdAt: string;
  doneAt?: string;
}

interface DevComment {
  id: string;
  itemId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

const categoryConfig: Record<DevItemCategory, { label: string; emoji: string; color: string }> = {
  idea:   { label: "Idé",      emoji: "💡", color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
  change: { label: "Ändring",  emoji: "🔧", color: "bg-blue-900/30 border-blue-700/50 text-blue-300" },
  todo:   { label: "Att göra", emoji: "📋", color: "bg-purple-50 border-purple-200 text-purple-800" },
};

const priorityConfig: Record<DevItemPriority, { label: string; emoji: string; color: string; order: number }> = {
  high:   { label: "Hög",    emoji: "🔴", color: "bg-red-900/30 border-red-700/50 text-red-400",       order: 0 },
  medium: { label: "Medium", emoji: "🟡", color: "bg-amber-900/30 border-amber-700/50 text-amber-400", order: 1 },
  low:    { label: "Låg",    emoji: "🟢", color: "bg-green-900/30 border-green-700/50 text-green-400", order: 2 },
};

export default function DevPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<DevItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState<DevItemCategory>("idea");
  const [newPriority, setNewPriority] = useState<DevItemPriority>("medium");
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<DevItemCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState<DevItemCategory>("idea");
  const [editPriority, setEditPriority] = useState<DevItemPriority>("medium");

  // Comments
  const [comments, setComments] = useState<DevComment[]>([]);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [addingComment, setAddingComment] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.roles.some((r) => ["admin","co_admin"].includes(r))) return;
    let mounted = true;

    const loadItems = () =>
      supabase.from("dev_items").select("*").order("created_at", { ascending: false })
        .then(({ data }) => {
          if (!mounted) return;
          setItems((data ?? []).map((d) => ({
            id: d.id, text: d.title ?? d.description ?? "",
            category: (d.status as unknown as DevItemCategory) ?? "idea",
            priority: (d.priority as DevItemPriority) ?? "medium",
            done: d.status === "done",
            createdAt: d.created_at,
          })));
          setLoading(false);
        });

    loadItems();
    const ch = supabase.channel("dev-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "dev_items" }, loadItems)
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.roles.some((r) => ["admin","co_admin"].includes(r))) return;
    let mounted = true;

    const loadComments = () =>
      supabase.from("dev_item_comments").select("*").order("created_at", { ascending: true })
        .then(({ data }) => {
          if (!mounted) return;
          setComments((data ?? []).map((d) => ({
            id: d.id, itemId: d.item_id, text: d.content,
            authorId: d.author_id, authorName: "",
            createdAt: d.created_at,
          })));
        });

    loadComments();
    const ch = supabase.channel("dev-comments")
      .on("postgres_changes", { event: "*", schema: "public", table: "dev_item_comments" }, loadComments)
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user?.id]);

  const addComment = async (itemId: string) => {
    const text = (newCommentText[itemId] ?? "").trim();
    if (!text || !user) return;
    setAddingComment(itemId);
    try {
      await supabase.from("dev_item_comments").insert({
        item_id: itemId, content: text, author_id: user.id,
      });
      setNewCommentText((prev) => ({ ...prev, [itemId]: "" }));
    } catch {
      alert("Det gick inte att lägga till kommentaren. Försök igen.");
    } finally {
      setAddingComment(null);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await supabase.from("dev_item_comments").delete().eq("id", commentId);
    } catch {
      alert("Det gick inte att ta bort kommentaren. Försök igen.");
    }
  };

  const toggleComments = (itemId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setAdding(true);
    try {
      await supabase.from("dev_items").insert({
        title: newText.trim(), description: "", status: "open", priority: newPriority,
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
      await supabase.from("dev_items").update({ status: item.done ? "open" : "done" }).eq("id", item.id);
    } catch {
      alert("Det gick inte att uppdatera. Försök igen.");
    }
  };

  const removeItem = async (item: DevItem) => {
    if (!confirm(`Ta bort "${item.text}"?`)) return;
    try {
      await supabase.from("dev_items").delete().eq("id", item.id);
    } catch {
      alert("Det gick inte att ta bort. Försök igen.");
    }
  };

  const startEdit = (item: DevItem) => {
    if (item.done) return;
    setEditingId(item.id);
    setEditText(item.text);
    setEditCategory(item.category);
    setEditPriority(item.priority);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditCategory("idea");
    setEditPriority("medium");
  };

  const saveEdit = async (item: DevItem) => {
    const trimmed = editText.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    const textChanged = trimmed !== item.text.trim();
    const categoryChanged = editCategory !== item.category;
    const priorityChanged = editPriority !== item.priority;
    if (!textChanged && !categoryChanged && !priorityChanged) {
      cancelEdit();
      return;
    }
    try {
      await supabase.from("dev_items").update({ title: trimmed, priority: editPriority }).eq("id", item.id);
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
  const pending = filtered
    .filter((i) => !i.done)
    .sort((a, b) => priorityConfig[a.priority].order - priorityConfig[b.priority].order);
  const done    = filtered.filter((i) => i.done);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🛠</span>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Utvecklingssida
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          En tillfällig sida för att samla idéer, ändringar och uppgifter under sidans utveckling.
        </p>
      </div>

      {/* Add new item */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-slate-100 mb-4">Lägg till</h2>
        <form onSubmit={addItem} className="flex flex-col sm:flex-row gap-3">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as DevItemCategory)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-300 bg-white hover:border-slate-400 transition-colors shrink-0"
          >
            {(Object.keys(categoryConfig) as DevItemCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {categoryConfig[cat].emoji} {categoryConfig[cat].label}
              </option>
            ))}
          </select>
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as DevItemPriority)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-300 bg-white hover:border-slate-400 transition-colors shrink-0"
          >
            {(Object.keys(priorityConfig) as DevItemPriority[]).map((p) => (
              <option key={p} value={p}>
                {priorityConfig[p].emoji} {priorityConfig[p].label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Beskriv idén, ändringen eller uppgiften…"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
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
                : "bg-slate-700 text-slate-300 hover:bg-slate-200"
            }`}
          >
            {cat === "all"
              ? `Alla (${items.length})`
              : `${categoryConfig[cat as DevItemCategory].emoji} ${categoryConfig[cat as DevItemCategory].label} (${items.filter((i) => i.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
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
                  {pending.map((item) => {
                    const itemComments = comments.filter((c) => c.itemId === item.id);
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={() => toggleDone(item)}
                        onDelete={() => removeItem(item)}
                        editing={editingId === item.id}
                        editText={editText}
                        editCategory={editCategory}
                        editPriority={editPriority}
                        onEditStart={() => startEdit(item)}
                        onEditChange={setEditText}
                        onEditCategoryChange={setEditCategory}
                        onEditPriorityChange={setEditPriority}
                        onEditSave={() => saveEdit(item)}
                        onEditCancel={cancelEdit}
                        comments={itemComments}
                        commentsExpanded={expandedComments.has(item.id)}
                        onToggleComments={() => toggleComments(item.id)}
                        newCommentText={newCommentText[item.id] ?? ""}
                        onNewCommentChange={(v) =>
                          setNewCommentText((prev) => ({ ...prev, [item.id]: v }))
                        }
                        onAddComment={() => addComment(item.id)}
                        addingComment={addingComment === item.id}
                        onDeleteComment={deleteComment}
                        currentUserId={user.id}
                      />
                    );
                  })}
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
                  {done.map((item) => {
                    const itemComments = comments.filter((c) => c.itemId === item.id);
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={() => toggleDone(item)}
                        onDelete={() => removeItem(item)}
                        editing={false}
                        editText=""
                        editCategory="idea"
                        editPriority="medium"
                        onEditStart={() => {}}
                        onEditChange={() => {}}
                        onEditCategoryChange={() => {}}
                        onEditPriorityChange={() => {}}
                        onEditSave={() => {}}
                        onEditCancel={() => {}}
                        comments={itemComments}
                        commentsExpanded={expandedComments.has(item.id)}
                        onToggleComments={() => toggleComments(item.id)}
                        newCommentText={newCommentText[item.id] ?? ""}
                        onNewCommentChange={(v) =>
                          setNewCommentText((prev) => ({ ...prev, [item.id]: v }))
                        }
                        onAddComment={() => addComment(item.id)}
                        addingComment={addingComment === item.id}
                        onDeleteComment={deleteComment}
                        currentUserId={user.id}
                      />
                    );
                  })}
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
  editCategory,
  editPriority,
  onEditStart,
  onEditChange,
  onEditCategoryChange,
  onEditPriorityChange,
  onEditSave,
  onEditCancel,
  comments,
  commentsExpanded,
  onToggleComments,
  newCommentText,
  onNewCommentChange,
  onAddComment,
  addingComment,
  onDeleteComment,
  currentUserId,
}: {
  item: DevItem;
  onToggle: () => void;
  onDelete: () => void;
  editing: boolean;
  editText: string;
  editCategory: DevItemCategory;
  editPriority: DevItemPriority;
  onEditStart: () => void;
  onEditChange: (val: string) => void;
  onEditCategoryChange: (val: DevItemCategory) => void;
  onEditPriorityChange: (val: DevItemPriority) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  comments: DevComment[];
  commentsExpanded: boolean;
  onToggleComments: () => void;
  newCommentText: string;
  onNewCommentChange: (val: string) => void;
  onAddComment: () => void;
  addingComment: boolean;
  onDeleteComment: (id: string) => void;
  currentUserId: string;
}) {
  const cat = categoryConfig[item.category];
  const prio = priorityConfig[item.priority];

  return (
    <li className="border border-slate-100 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-3">
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <select
                value={editCategory}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "idea" || val === "change" || val === "todo") {
                    onEditCategoryChange(val);
                  }
                }}
                className="border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-300 bg-white hover:border-slate-400 transition-colors shrink-0"
              >
                {(Object.keys(categoryConfig) as DevItemCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryConfig[cat].emoji} {categoryConfig[cat].label}
                  </option>
                ))}
              </select>
              <select
                value={editPriority}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "high" || val === "medium" || val === "low") {
                    onEditPriorityChange(val);
                  }
                }}
                className="border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-300 bg-white hover:border-slate-400 transition-colors shrink-0"
              >
                {(Object.keys(priorityConfig) as DevItemPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {priorityConfig[p].emoji} {priorityConfig[p].label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={editText}
                onChange={(e) => onEditChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onEditSave();
                  if (e.key === "Escape") onEditCancel();
                }}
                autoFocus
                className="flex-1 border border-orange-300 rounded-lg px-2 py-1 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={onEditSave}
                  className="px-2 py-1 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Spara
                </button>
                <button
                  onClick={onEditCancel}
                  className="px-2 py-1 text-xs font-semibold bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <p className={`text-sm ${item.done ? "line-through text-slate-400" : "text-slate-200"}`}>
              {item.text}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cat.color}`}>
              {cat.emoji} {cat.label}
            </span>
            {!item.done && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${prio.color}`}>
                {prio.emoji} {prio.label}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {new Date(item.createdAt).toLocaleDateString("sv-SE")}
            </span>
            {item.done && item.doneAt && (
              <span className="text-xs text-emerald-600">
                ✓ Klar {new Date(item.doneAt).toLocaleDateString("sv-SE")}
              </span>
            )}
            <button
              onClick={onToggleComments}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
            >
              💬 {comments.length > 0 ? comments.length : ""} Kommentarer
              <span>{commentsExpanded ? "▲" : "▼"}</span>
            </button>
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
      </div>

      {/* Comments section */}
      {commentsExpanded && (
        <div className="border-t border-slate-700 bg-slate-900/30 px-3 py-3">
          {comments.length > 0 ? (
            <ul className="space-y-2 mb-3">
              {comments.map((comment) => (
                <li key={comment.id} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-slate-300">
                        {comment.authorName}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(comment.createdAt).toLocaleDateString("sv-SE")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{comment.text}</p>
                  </div>
                  {comment.authorId === currentUserId && (
                    <button
                      onClick={() => onDeleteComment(comment.id)}
                      aria-label="Ta bort kommentar"
                      className="text-slate-300 hover:text-red-400 transition-colors text-xs mt-0.5 shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 mb-3">Inga kommentarer ännu.</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => onNewCommentChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onAddComment()}
              placeholder="Skriv en kommentar…"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
            />
            <button
              onClick={onAddComment}
              disabled={addingComment || !newCommentText.trim()}
              className="px-3 py-1.5 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 shrink-0"
            >
              {addingComment ? "…" : "Kommentera"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
