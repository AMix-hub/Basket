"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Status = "loading" | "ready" | "invalid";

function SetPasswordForm() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase automatically processes the #access_token hash on page load
    // and fires onAuthStateChange with event PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
      }
    });

    // Also handle the case where the session was already set (e.g. page refresh).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("ready");
      } else {
        // Give the hash a moment to be processed before declaring invalid.
        const timer = setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) setStatus("invalid");
          });
        }, 2500);
        return () => clearTimeout(timer);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 6 && passwordsMatch && status === "ready";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.message.toLowerCase().includes("weak")) {
          setError("Lösenordet är för svagt. Använd minst 6 tecken.");
        } else if (error.message.toLowerCase().includes("expired") || error.message.toLowerCase().includes("invalid")) {
          setError("Länken har gått ut. Be administratören skicka en ny inbjudan.");
        } else {
          setError("Något gick fel. Försök igen eller kontakta administratören.");
        }
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/"), 2500);
      }
    } catch {
      setError("Något gick fel. Försök igen eller kontakta administratören.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="text-center py-4">
        <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-400 text-sm">Verifierar länk…</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="text-center">
        <p className="text-4xl mb-3">🔗</p>
        <p className="text-slate-300 font-semibold mb-1">Ogiltig eller utgången länk</p>
        <p className="text-slate-500 text-sm mb-4">
          Öppna länken direkt från välkomstmailet. Be administratören skicka en ny inbjudan om länken har gått ut.
        </p>
        <Link
          href="/login"
          className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600"
        >
          Gå till inloggning
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <p className="text-4xl mb-3">✅</p>
        <p className="text-slate-200 font-semibold mb-1">Lösenordet är satt!</p>
        <p className="text-slate-500 text-sm mb-4">
          Du skickas vidare om ett ögonblick…
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600"
        >
          Gå till appen
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-400 block mb-1">
          Nytt lösenord
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minst 6 tecken"
          required
          minLength={6}
          className="w-full px-3 py-2 text-sm bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
        />
        {password.length > 0 && password.length < 6 && (
          <p className="mt-1 text-xs text-amber-400">Minst 6 tecken krävs.</p>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-400 block mb-1">
          Bekräfta lösenord
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Skriv lösenordet igen"
          required
          className={`w-full px-3 py-2 text-sm bg-slate-700 border text-slate-100 placeholder-slate-500 rounded-xl focus:outline-none focus:ring-2 transition-colors ${
            passwordsMatch
              ? "border-emerald-500 focus:ring-emerald-400"
              : passwordsMismatch
              ? "border-red-500 focus:ring-red-400"
              : "border-slate-600 focus:ring-orange-400"
          }`}
        />
        {confirm.length > 0 && (
          <p className={`mt-1 text-xs font-semibold ${passwordsMatch ? "text-emerald-400" : "text-red-400"}`}>
            {passwordsMatch ? "✓ Matchar" : "✗ Matchar inte"}
          </p>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-900/30 border border-red-700/40 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="w-full px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors"
      >
        {busy ? "Sparar…" : "Sätt lösenord"}
      </button>
    </form>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-3xl mb-2">🔐</p>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight">
            Sätt ditt lösenord
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Välj ett lösenord för ditt nya konto.
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <Suspense fallback={<p className="text-slate-400 text-sm text-center">Laddar…</p>}>
            <SetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
