"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

export default function CoachClipboard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<"stopwatch" | "notes">("stopwatch");

  // Stopwatch state
  const [running, setRunning]               = useState(false);
  const [displayElapsed, setDisplayElapsed] = useState(0);
  const startRef        = useRef(0);
  const baseElapsedRef  = useRef(0);
  const rafRef          = useRef<number>(0);

  // Notes state – initialised from localStorage so no synchronous setState in effect
  const [notes, setNotes] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("coach_clipboard_notes") ?? "";
  });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Override with Firestore data once the user is known */
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "coach_notes", user.id)).then((snap) => {
      if (snap.exists()) {
        const content = snap.data().content as string | undefined;
        if (content !== undefined) setNotes(content);
      }
    });
  }, [user]);

  /* Debounced save */
  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (user) {
        await setDoc(
          doc(db, "coach_notes", user.id),
          { content: value, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } else {
        localStorage.setItem("coach_clipboard_notes", value);
      }
    }, 800);
  };

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      const tick = () => {
        setDisplayElapsed(baseElapsedRef.current + (Date.now() - startRef.current));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }
  }, [running]);

  const formatTime = (ms: number) => {
    const m  = Math.floor(ms / 60000);
    const s  = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  const playWhistle = () => {
    try {
      const ctx  = new AudioContext();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(2800, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(3200, ctx.currentTime + 0.05);
      osc.frequency.setValueAtTime(3000, ctx.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(3400, ctx.currentTime + 0.15);
      osc.frequency.linearRampToValueAtTime(2800, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // AudioContext not available
    }
  };

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 w-72 overflow-hidden">
          {/* Tabs */}
          <div className="flex">
            <button
              onClick={() => setTab("stopwatch")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === "stopwatch"
                  ? "bg-orange-500 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-200"
              }`}
            >
              ⏱ Stoppur
            </button>
            <button
              onClick={() => setTab("notes")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === "notes"
                  ? "bg-orange-500 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-200"
              }`}
            >
              📝 Anteckningar
            </button>
          </div>

          {tab === "stopwatch" ? (
            <div className="p-5">
              <div className="text-4xl font-mono font-bold text-center text-slate-100 mb-5 tabular-nums tracking-tight">
                {formatTime(displayElapsed)}
              </div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    if (running) {
                      baseElapsedRef.current += Date.now() - startRef.current;
                    }
                    setRunning((r) => !r);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-colors ${
                    running
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-emerald-500 hover:bg-emerald-600"
                  }`}
                >
                  {running ? "⏸ Pausa" : "▶ Starta"}
                </button>
                <button
                  onClick={() => {
                    setRunning(false);
                    baseElapsedRef.current = 0;
                    setDisplayElapsed(0);
                  }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-slate-200 text-slate-300 hover:bg-slate-300 transition-colors"
                >
                  ↺ Nollställ
                </button>
              </div>
              <button
                onClick={playWhistle}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-base transition-colors"
              >
                📣 Visselpipa!
              </button>
            </div>
          ) : (
            <div className="p-5">
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Snabbanteckningar… (sparas automatiskt)"
                className="w-full h-44 p-3 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-right">
                Sparas automatiskt
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Stäng coachverktygen" : "Öppna coachverktygen"}
        className="w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-xl flex items-center justify-center text-2xl transition-all hover:scale-105 active:scale-95 select-none"
      >
        {open ? "✕" : "📋"}
      </button>
    </div>
  );
}

