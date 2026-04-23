"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Supabase puts the recovery token in the URL hash, which Next.js
  // exposes as a query param after the redirect from the email link.
  const oobCode = searchParams.get("oobCode") ?? searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 6 && passwordsMatch && !!oobCode;

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
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setError("Något gick fel. Försök igen eller kontakta administratören.");
    } finally {
      setBusy(false);
    }
  };

  if (!oobCode) {
    return (
      <div className="text-center">
        <p className="text-4xl mb-3">🔗</p>
        <p className="text-slate-600 mb-4">
          Ogiltig länk. Öppna länken från välkomstmailet.
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
          Du skickas vidare till inloggningssidan om ett ögonblick…
        </p>
        <Link
          href="/login"
          className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600"
        >
          Logga in nu
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">
          Nytt lösenord
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minst 6 tecken"
          required
          minLength={6}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">
          Bekräfta lösenord
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Skriv lösenordet igen"
          required
          className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
            passwordsMatch
              ? "border-emerald-400 focus:ring-emerald-300"
              : passwordsMismatch
              ? "border-red-400 focus:ring-red-300"
              : "border-slate-200 focus:ring-orange-300 focus:border-orange-400"
          }`}
        />
        {/* Real-time match indicator */}
        {confirm.length > 0 && (
          <p
            className={`mt-1 text-xs font-semibold ${
              passwordsMatch ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {passwordsMatch ? "✓ Matchar" : "✗ Matchar inte"}
          </p>
        )}
      </div>

      {password.length > 0 && password.length < 6 && (
        <p className="text-xs text-amber-600">
          Lösenordet måste vara minst 6 tecken.
        </p>
      )}

      {error && (
        <p className="text-red-600 text-sm bg-red-900/30 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="w-full px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors"
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
