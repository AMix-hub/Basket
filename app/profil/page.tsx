"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../../lib/roleLabels";
import Image from "next/image";

export default function ProfilPage() {
  const { user, loading, requestPushPermission, updateAvatar } = useAuth();
  const router = useRouter();

  const [requesting, setRequesting] = useState(false);
  const [notifMessage, setNotifMessage] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    const err = await updateAvatar(file);
    if (err) setAvatarError(err);
    setAvatarUploading(false);
    /* Reset input so the same file can be re-selected */
    e.target.value = "";
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <span className="text-slate-500">Laddar…</span>
      </div>
    );
  }

  const isAdmin = user.roles.includes("admin");

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8 space-y-4">
      <h1 className="text-xl font-bold text-slate-300 mb-2">Min profil</h1>

      {/* ── User info card ─── */}
      <div
        className="rounded-2xl border border-white/10 p-6 space-y-4"
        style={{
          background: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Avatar + name row */}
        <div className="flex items-center gap-4">
          {/* Avatar / icon with upload */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label="Ladda upp profilbild"
              className="relative w-20 h-20 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-green-400/60 group"
              style={{
                boxShadow: "0 0 20px rgba(34,197,94,0.35), 0 0 40px rgba(34,197,94,0.15)",
              }}
            >
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.name}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                /* Modern icon instead of old 🏛 emoji */
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.9) 100%)",
                  }}
                >
                  {isAdmin ? (
                    /* Admin: modern shield/badge SVG */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-10 h-10 text-green-400"
                    >
                      <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  ) : (
                    /* Generic user icon */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-10 h-10 text-slate-300"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                  )}
                </div>
              )}
              {/* Hover overlay with camera icon (desktop) */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-7 h-7"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </button>
            {/* Always-visible camera badge – makes upload discoverable on touch devices */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              aria-hidden="true"
              tabIndex={-1}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 border-2 border-slate-900 flex items-center justify-center transition-colors"
            >
              {avatarUploading ? (
                <svg
                  aria-label="Laddar upp…"
                  className="animate-spin w-3.5 h-3.5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Name and email */}
          <div className="min-w-0">
            <p className="text-4xl font-extrabold text-white tracking-tight leading-none">
              {user.name}
            </p>
            <p className="text-sm text-slate-400 mt-1 truncate">{user.email}</p>
          </div>
        </div>

        {avatarError && (
          <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{avatarError}</p>
        )}

        {/* Role tags */}
        <div className="flex flex-wrap gap-2">
          {user.roles.map((r) => (
            <span
              key={r}
              className="px-3 py-0.5 text-xs font-bold rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30"
              style={{
                boxShadow: "0 0 8px rgba(249,115,22,0.5), 0 0 20px rgba(249,115,22,0.2)",
              }}
            >
              {roleLabel[r]}
            </span>
          ))}
        </div>

        {user.childName && (
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-400">Barn:</span> {user.childName}
          </p>
        )}
        {user.clubName && (
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-400">Klubb:</span> {user.clubName}
          </p>
        )}
      </div>

      {/* ── Push notification section ── */}
      <div
        className="rounded-2xl border border-white/10 p-6 space-y-4"
        style={{
          background: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span
              style={{
                filter: "drop-shadow(0 0 6px rgba(234,179,8,0.8)) drop-shadow(0 0 12px rgba(234,179,8,0.4))",
              }}
            >
              🔔
            </span>
            Push-notiser
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
          <div
            className="flex items-center gap-3 text-sm font-semibold text-green-300 rounded-xl px-4 py-3 border border-green-500/30"
            style={{
              background: "rgba(22,163,74,0.15)",
              boxShadow: "0 0 12px rgba(34,197,94,0.3), 0 0 30px rgba(34,197,94,0.1), inset 0 1px 0 rgba(74,222,128,0.15)",
            }}
          >
            <span className="text-base">✅</span>
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
                <svg
                  aria-label="Aktiverar…"
                  className="animate-spin w-4 h-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
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
