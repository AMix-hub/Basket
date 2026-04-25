"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

/* ─── Types ─────────────────────────────────────────────────── */
interface Player {
  id: string;
  name: string;
  number: number;
}

interface PaymentCategory {
  id: string;
  name: string;
  amount: number;
  season: string;
  note: string;
}

interface Payment {
  id: string;
  playerId: string;
  categoryId: string;
  paid: boolean;
  paidAt: string | null;
}

/* ═══════════════════════════════════════════════════════════════ */
export default function BetalningarPage() {
  const { user, getMyTeam } = useAuth();
  const team = getMyTeam();

  const canEdit = user?.roles.some((r) => ["coach", "admin", "assistant"].includes(r)) ?? false;

  const [players, setPlayers] = useState<Player[]>([]);
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Add category form
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [catName, setCatName] = useState("");
  const [catAmount, setCatAmount] = useState("");
  const [catSeason, setCatSeason] = useState(new Date().getFullYear().toString());
  const [catNote, setCatNote] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  // View: which category is active
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;

  /* ── Load all data ── */
  const loadData = useCallback(async () => {
    if (!team) { setLoading(false); return; }
    const [{ data: pl }, { data: cats }, { data: pays }] = await Promise.all([
      supabase.from("players").select("id, name, number").eq("team_id", team.id).order("number"),
      supabase.from("payment_categories").select("id, name, amount, season, note").eq("team_id", team.id).order("created_at", { ascending: false }),
      supabase.from("player_payments").select("id, player_id, category_id, paid, paid_at").eq("team_id", team.id),
    ]);
    setPlayers((pl ?? []).map((p) => ({ id: p.id, name: p.name, number: p.number ?? 0 })));
    const loadedCats = (cats ?? []).map((c) => ({
      id: c.id, name: c.name, amount: c.amount ?? 0, season: c.season ?? "", note: c.note ?? "",
    }));
    setCategories(loadedCats);
    setPayments((pays ?? []).map((p) => ({
      id: p.id, playerId: p.player_id, categoryId: p.category_id,
      paid: p.paid ?? false, paidAt: p.paid_at ?? null,
    })));
    // Auto-select first category
    setActiveCategoryId((prev) => prev ?? (loadedCats[0]?.id ?? null));
    setLoading(false);
  }, [team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Add category ── */
  const addCategory = async () => {
    if (!catName.trim() || !team) return;
    setAddingCat(true);
    const { error } = await supabase.from("payment_categories").insert({
      team_id: team.id, name: catName.trim(),
      amount: parseFloat(catAmount) || 0, season: catSeason, note: catNote.trim() || null,
    });
    setAddingCat(false);
    if (error) { toast("Kunde inte skapa avgift.", "error"); return; }
    setCatName(""); setCatAmount(""); setCatNote(""); setShowAddCategory(false);
    toast("Avgift skapad!", "success");
    loadData();
  };

  /* ── Delete category ── */
  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`Ta bort "${name}" och alla dess betalningar?`)) return;
    await supabase.from("player_payments").delete().eq("category_id", id);
    await supabase.from("payment_categories").delete().eq("id", id);
    if (activeCategoryId === id) setActiveCategoryId(categories.find((c) => c.id !== id)?.id ?? null);
    loadData();
    toast("Avgift borttagen.", "success");
  };

  /* ── Toggle payment ── */
  const togglePayment = async (playerId: string, categoryId: string) => {
    if (!team) return;
    const existing = payments.find((p) => p.playerId === playerId && p.categoryId === categoryId);
    if (existing) {
      const newPaid = !existing.paid;
      await supabase.from("player_payments").update({
        paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null,
      }).eq("id", existing.id);
      setPayments((prev) => prev.map((p) => p.id === existing.id
        ? { ...p, paid: newPaid, paidAt: newPaid ? new Date().toISOString() : null }
        : p));
    } else {
      const { data } = await supabase.from("player_payments").insert({
        team_id: team.id, player_id: playerId, category_id: categoryId,
        paid: true, paid_at: new Date().toISOString(),
      }).select("id").single();
      if (data) {
        setPayments((prev) => [...prev, {
          id: data.id, playerId, categoryId, paid: true, paidAt: new Date().toISOString(),
        }]);
      }
    }
  };

  /* ── Mark all paid ── */
  const markAllPaid = async () => {
    if (!activeCategory || !team) return;
    for (const player of players) {
      const existing = payments.find((p) => p.playerId === player.id && p.categoryId === activeCategory.id);
      if (!existing || !existing.paid) await togglePayment(player.id, activeCategory.id);
    }
    toast("Alla markerade som betalda!", "success");
  };

  /* ── Computed stats for active category ── */
  const paidCount = activeCategory
    ? players.filter((p) => payments.find((pay) => pay.playerId === p.id && pay.categoryId === activeCategory.id && pay.paid)).length
    : 0;
  const totalAmount = activeCategory ? paidCount * activeCategory.amount : 0;
  const expectedAmount = activeCategory ? players.length * activeCategory.amount : 0;

  if (loading) return <div className="text-center py-16 text-slate-500">Laddar betalningar…</div>;

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">💰</span>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Betalningar</h1>
          </div>
          <p className="text-slate-500 text-sm">Spåra avgifter och betalningsstatus per spelare.</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowAddCategory((v) => !v)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            {showAddCategory ? "Avbryt" : "+ Ny avgift"}
          </button>
        )}
      </div>

      {/* ── Add category form ── */}
      {showAddCategory && canEdit && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-5">
          <h2 className="font-bold text-slate-100 mb-3">Lägg till avgiftstyp</h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Namn <span className="text-red-400">*</span></label>
              <input autoFocus value={catName} onChange={(e) => setCatName(e.target.value)}
                placeholder="T.ex. Träningsavgift 2025"
                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Belopp (kr)</label>
              <input type="number" value={catAmount} onChange={(e) => setCatAmount(e.target.value)}
                placeholder="T.ex. 1500" min="0"
                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Säsong</label>
              <input value={catSeason} onChange={(e) => setCatSeason(e.target.value)}
                placeholder="2025"
                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Info (valfri)</label>
              <input value={catNote} onChange={(e) => setCatNote(e.target.value)}
                placeholder="T.ex. Betalas senast 1 feb"
                className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addCategory} disabled={addingCat || !catName.trim()}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {addingCat ? "Skapar…" : "Skapa avgift"}
            </button>
            <button onClick={() => setShowAddCategory(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-slate-500 text-sm">
            {canEdit ? "Inga avgifter skapade ännu. Klicka \"+ Ny avgift\" för att börja." : "Inga avgifter registrerade."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">

          {/* ── Category sidebar ── */}
          <div className="lg:w-56 shrink-0 space-y-1.5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Avgiftstyper</p>
            {categories.map((cat) => {
              const paid = players.filter((p) => payments.find((pay) => pay.playerId === p.id && pay.categoryId === cat.id && pay.paid)).length;
              return (
                <button key={cat.id} onClick={() => setActiveCategoryId(cat.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                    activeCategoryId === cat.id
                      ? "bg-orange-500/20 border border-orange-500/40 text-orange-300"
                      : "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}>
                  <p className="text-sm font-semibold truncate">{cat.name}</p>
                  <p className="text-xs opacity-70 mt-0.5">{cat.season} · {paid}/{players.length} betalda</p>
                  {cat.amount > 0 && (
                    <p className="text-xs mt-0.5 opacity-60">{cat.amount.toLocaleString("sv-SE")} kr/st</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Payment table ── */}
          {activeCategory && (
            <div className="flex-1 min-w-0">
              {/* Category header */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="font-bold text-slate-100 text-lg">{activeCategory.name}</h2>
                    {activeCategory.note && <p className="text-xs text-slate-400 mt-0.5">{activeCategory.note}</p>}
                  </div>
                  {canEdit && (
                    <button onClick={() => deleteCategory(activeCategory.id, activeCategory.name)}
                      className="text-xs px-3 py-1 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-lg transition-colors">
                      Ta bort
                    </button>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>{paidCount} av {players.length} betalda</span>
                    {activeCategory.amount > 0 && (
                      <span className="text-emerald-400 font-semibold">
                        {totalAmount.toLocaleString("sv-SE")} / {expectedAmount.toLocaleString("sv-SE")} kr
                      </span>
                    )}
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: players.length > 0 ? `${(paidCount / players.length) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
                {canEdit && players.length > 0 && paidCount < players.length && (
                  <button onClick={markAllPaid}
                    className="mt-3 text-xs px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-400 rounded-lg font-semibold transition-colors">
                    ✓ Markera alla som betalda
                  </button>
                )}
              </div>

              {/* Player list */}
              {players.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Inga spelare i truppen.</p>
              ) : (
                <div className="space-y-1.5">
                  {players.map((player) => {
                    const payment = payments.find((p) => p.playerId === player.id && p.categoryId === activeCategory.id);
                    const isPaid = payment?.paid ?? false;
                    return (
                      <div key={player.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                          isPaid ? "bg-emerald-900/20 border-emerald-700/30" : "bg-slate-800 border-slate-700"
                        }`}>
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-slate-400">#{player.number}</span>
                        </div>
                        <span className={`flex-1 text-sm font-medium ${isPaid ? "text-slate-200" : "text-slate-300"}`}>
                          {player.name}
                        </span>
                        {isPaid && payment?.paidAt && (
                          <span className="text-xs text-slate-500">
                            {new Date(payment.paidAt).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        {canEdit ? (
                          <button
                            onClick={() => togglePayment(player.id, activeCategory.id)}
                            className={`shrink-0 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                              isPaid
                                ? "bg-emerald-900/50 text-emerald-400 hover:bg-red-900/40 hover:text-red-400"
                                : "bg-slate-700 text-slate-400 hover:bg-emerald-900/40 hover:text-emerald-400"
                            }`}
                          >
                            {isPaid ? "✓ Betald" : "Ej betald"}
                          </button>
                        ) : (
                          <span className={`shrink-0 px-3 py-1 text-xs font-bold rounded-lg ${
                            isPaid ? "bg-emerald-900/40 text-emerald-400" : "bg-slate-700 text-slate-500"
                          }`}>
                            {isPaid ? "✓ Betald" : "Ej betald"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
