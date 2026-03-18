"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { roleLabel, roleEmoji } from "../../lib/roleLabels";

export default function ProfilPage() {
  const { user, loading, requestPushPermission } = useAuth();
  const router = useRouter();

  const [requesting, setRequesting] = useState(false);
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  /* Redirect to login if not authenticated */
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  /* Derive the current Notification permission directly (client-only). */
  const currentPermission: NotificationPermission | "unsupported" | null =
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : typeof window === "undefined"
      ? null           // SSR: not yet known
      : "unsupported"; // browser without Notification API

  const handleEnableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifMessage("Din webbläsare stöder inte push-notiser.");
      return;
    }
    if (Notification.permission === "denied") {
      setNotifMessage(
        "Notiser är blockerade i webbläsaren. Gå till webbläsarens inställningar och tillåt notiser för den här sidan."
      );
      return;
    }

    setRequesting(true);
    setNotifMessage(null);

    try {
      await requestPushPermission();
      if (Notification.permission === "granted") {
        setNotifMessage("Notiser är nu aktiverade! 🎉");
      } else {
        setNotifMessage("Du valde att inte tillåta notiser.");
      }
    } catch {
      setNotifMessage("Något gick fel. Försök igen.");
    } finally {
      setRequesting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <span className="text-slate-500">Laddar…</span>
      </div>
    );
  }

  const emoji = roleEmoji(user.roles);

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Min profil</h1>

      {/* User info card */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{emoji}</span>
          <div>
            <p className="text-lg font-semibold text-slate-100">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {user.roles.map((r) => (
            <span
              key={r}
              className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-orange-500/20 text-orange-400"
            >
              {roleLabel[r]}
            </span>
          ))}
        </div>
        {user.childName && (
          <p className="text-sm text-slate-600">
            <span className="font-medium">Barn:</span> {user.childName}
          </p>
        )}
        {user.clubName && (
          <p className="text-sm text-slate-600">
            <span className="font-medium">Klubb:</span> {user.clubName}
          </p>
        )}
      </div>

      {/* Push notification section */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>🔔</span> Push-notiser
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Få direkt notis i din enhet när träningar ställs in eller andra
            viktiga händelser inträffar.
          </p>
        </div>

        {currentPermission === "unsupported" && (
          <p className="text-sm text-slate-500">
            Din webbläsare stöder inte push-notiser.
          </p>
        )}

        {currentPermission === "granted" && !notifMessage && (
          <div className="flex items-center gap-2 text-sm font-medium text-green-400 bg-green-900/30 rounded-lg px-4 py-2.5">
            <span>✅</span>
            <span>Notiser är aktiverade</span>
          </div>
        )}

        {currentPermission === "denied" && (
          <div className="text-sm text-red-400 bg-red-900/30 rounded-lg px-4 py-2.5 space-y-1">
            <p className="font-medium">Notiser är blockerade</p>
            <p className="text-xs">
              Gå till webbläsarens inställningar för den här sidan och tillåt
              notiser, ladda sedan om sidan.
            </p>
          </div>
        )}

        {(currentPermission === "default" || currentPermission === null) && (
          <button
            onClick={handleEnableNotifications}
            disabled={requesting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {requesting ? (
              <>
                <span className="animate-spin text-base">⏳</span>
                Aktiverar…
              </>
            ) : (
              <>
                <span>🔔</span>
                Aktivera notiser
              </>
            )}
          </button>
        )}

        {notifMessage && (
          <p
            className={`text-sm rounded-lg px-4 py-2.5 ${
              notifMessage.startsWith("Notiser är nu aktiverade")
                ? "bg-green-900/30 text-green-400"
                : "bg-amber-900/30 text-amber-300"
            }`}
          >
            {notifMessage}
          </p>
        )}

        <p className="text-xs text-slate-400">
          På iOS (Safari) krävs att appen är installerad på hemskärmen för att
          ta emot notiser: Safari → Dela → Lägg till på hemskärmen. Android och
          datorer stöder notiser direkt i webbläsaren.
        </p>
      </div>
    </div>
  );
}
