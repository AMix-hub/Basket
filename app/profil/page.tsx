"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../../lib/roleLabels";
import { supabase } from "../../lib/supabase";
import { toast } from "../../lib/toast";

const DAY_NAMES = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
const MONTHS_SV = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS_SV[d.getMonth()]}`;
}

function formatDateFull(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" });
}

const BASKETBALL_POSITIONS = ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"];

interface UpcomingSession {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
}

interface AttendanceSummary {
  present: number;
  total: number;
}

/* ─── Glassmorphism card ─────────────────────────── */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 p-5 ${className}`}
      style={{
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Section heading ─────────────────────────────── */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">{children}</h2>
  );
}

/* ─── Info row (read-only) ─────────────────────────── */
function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-xs font-semibold text-slate-500 w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-200 flex-1 break-words">{value}</span>
    </div>
  );
}

/* ─── Copy button ─────────────────────────────────── */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg transition-colors ml-2"
    >
      {copied ? "✓" : "Kopiera"}
    </button>
  );
}

/* ═══════════════════════════════════════════════════ */
export default function ProfilPage() {
  const { user, loading, updateAvatar, updateProfile, changePassword, getMyTeams } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Personal info edit
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", bio: "", position: "", childName: "" });
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Upcoming sessions
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);

  // Attendance summary (for players/parents)
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);

  // Notifications
  const [notifMessage, setNotifMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const currentPermission: NotificationPermission | "unsupported" | null =
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : typeof window === "undefined" ? null : "unsupported";

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const teams = getMyTeams();
    const teamId = teams[0]?.id;
    if (!teamId) return;

    const today = new Date().toISOString().slice(0, 10);

    const [{ data: sessions }, { data: attRows }, { data: allSessions }] = await Promise.all([
      supabase.from("sessions")
        .select("id, title, date, time, type")
        .eq("team_id", teamId)
        .gte("date", today)
        .order("date").order("time")
        .limit(5),
      // For players: look up attendance by matching player name
      user.roles.includes("player") || user.roles.includes("parent")
        ? supabase.from("players").select("id").eq("team_id", teamId).eq("name", user.childName ?? user.name).limit(1)
        : Promise.resolve({ data: null }),
      supabase.from("sessions").select("id").eq("team_id", teamId),
    ]);

    setUpcomingSessions(
      (sessions ?? []).map((s) => ({ id: s.id, title: s.title, date: s.date, time: s.time ?? "", type: s.type }))
    );

    // If we found a player record, count their attendance
    if (attRows && attRows.length > 0) {
      const playerId = attRows[0].id;
      const sessionIds = (allSessions ?? []).map((s: { id: string }) => s.id);
      if (sessionIds.length > 0) {
        const { data: attData } = await supabase
          .from("attendance")
          .select("status")
          .eq("player_id", playerId)
          .in("session_id", sessionIds);
        const present = (attData ?? []).filter((a: { status: string }) => a.status === "present").length;
        const total   = (attData ?? []).length;
        setAttendance({ present, total });
      }
    }
  }, [user, getMyTeams]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <span className="text-slate-500">Laddar…</span>
      </div>
    );
  }

  const isAdmin   = user.roles.includes("admin") || user.roles.includes("co_admin");
  const isCoach   = user.roles.some((r) => ["coach", "assistant"].includes(r));
  const isPlayer  = user.roles.includes("player");
  const isParent  = user.roles.includes("parent");

  const openEdit = () => {
    setDraft({
      name: user.name,
      phone: user.phone ?? "",
      bio: user.bio ?? "",
      position: user.position ?? "",
      childName: user.childName ?? "",
    });
    setEditing(true);
  };

  const savePersonalInfo = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    const err = await updateProfile({
      name:      draft.name.trim(),
      phone:     draft.phone.trim(),
      bio:       draft.bio.trim(),
      position:  draft.position,
      childName: isParent || isPlayer ? draft.childName.trim() : undefined,
    });
    setSaving(false);
    if (err) { toast(err, "error"); return; }
    setEditing(false);
    toast("Profil sparad!", "success");
  };

  const savePassword = async () => {
    setPasswordError("");
    if (newPassword.length < 6) { setPasswordError("Lösenordet måste vara minst 6 tecken."); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Lösenorden matchar inte."); return; }
    setSavingPassword(true);
    const err = await changePassword(newPassword);
    setSavingPassword(false);
    if (err) { setPasswordError(err); return; }
    setNewPassword(""); setConfirmPassword(""); setShowPasswordForm(false);
    toast("Lösenord uppdaterat!", "success");
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const err = await updateAvatar(file);
    setAvatarUploading(false);
    if (err) toast(err, "error");
    e.target.value = "";
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) { setNotifMessage("Din webbläsare stöder inte push-notiser."); return; }
    if (Notification.permission === "denied") { setNotifMessage("Notiser är blockerade i webbläsarens inställningar."); return; }
    setRequesting(true);
    await Notification.requestPermission();
    setRequesting(false);
    setNotifMessage(Notification.permission === "granted" ? "Notiser aktiverade!" : "Du valde att inte tillåta notiser.");
  };

  const attendancePct = attendance && attendance.total > 0
    ? Math.round((attendance.present / attendance.total) * 100)
    : null;

  const teams = getMyTeams();

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-12 space-y-4">

      {/* ── Profile header ── */}
      <Card>
        <div className="flex items-center gap-4 mb-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="relative w-20 h-20 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-orange-400/60 group"
              style={{ boxShadow: "0 0 20px rgba(249,115,22,0.25), 0 0 40px rgba(249,115,22,0.1)" }}
            >
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt={user.name} width={80} height={80} className="w-full h-full object-cover" unoptimized />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-slate-400">
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={avatarUploading} tabIndex={-1}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 border-2 border-slate-900 flex items-center justify-center transition-colors">
              {avatarUploading
                ? <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
              }
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Name + email + since */}
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-extrabold text-white tracking-tight leading-tight">{user.name}</p>
            <p className="text-sm text-slate-400 truncate mt-0.5">{user.email}</p>
            <p className="text-xs text-slate-600 mt-1">Medlem sedan {formatDateFull(user.createdAt)}</p>
          </div>
        </div>

        {/* Role tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {user.roles.map((r) => (
            <span key={r} className="px-3 py-0.5 text-xs font-bold rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30"
              style={{ boxShadow: "0 0 8px rgba(249,115,22,0.4)" }}>
              {roleLabel[r]}
            </span>
          ))}
          {teams.length > 0 && (
            <span className="px-3 py-0.5 text-xs font-medium rounded-full bg-slate-700 text-slate-400">
              {teams.map((t) => t.name).join(", ")}
            </span>
          )}
        </div>

        {/* Bio (read view) */}
        {!editing && user.bio && (
          <p className="text-sm text-slate-300 italic border-t border-white/10 pt-3">&ldquo;{user.bio}&rdquo;</p>
        )}

        {/* Quick stats row */}
        {attendancePct !== null && (
          <div className="flex gap-4 border-t border-white/10 pt-3 mt-1">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-emerald-400">{attendancePct}%</p>
              <p className="text-xs text-slate-500">Närvaro</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-slate-200">{attendance?.present ?? 0}</p>
              <p className="text-xs text-slate-500">Pass</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold text-slate-400">{attendance?.total ?? 0}</p>
              <p className="text-xs text-slate-500">Totalt</p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Personal info (edit form) ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionHeading>Personuppgifter</SectionHeading>
          {!editing && (
            <button onClick={openEdit} className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-semibold transition-colors">
              ✏️ Redigera
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Namn <span className="text-red-400">*</span></label>
              <input autoFocus value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Telefon</label>
              <input type="tel" value={draft.phone} onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                placeholder="T.ex. 070-123 45 67"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            {(isPlayer || isCoach) && (
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Position</label>
                <select value={draft.position} onChange={(e) => setDraft((p) => ({ ...p, position: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-400">
                  <option value="">Välj position</option>
                  {BASKETBALL_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
            )}
            {isParent && (
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Barnets namn</label>
                <input value={draft.childName} onChange={(e) => setDraft((p) => ({ ...p, childName: e.target.value }))}
                  placeholder="T.ex. Erik Svensson"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                <p className="text-xs text-slate-500 mt-1">Måste matcha spelarnamnet som coachen lagt in.</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Bio / Om mig</label>
              <textarea value={draft.bio} onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
                rows={3} placeholder="Berätta lite om dig själv…"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={savePersonalInfo} disabled={saving || !draft.name.trim()}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {saving ? "Sparar…" : "Spara"}
              </button>
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <div>
            <InfoRow label="Namn" value={user.name} />
            <InfoRow label="E-post" value={user.email} />
            <InfoRow label="Telefon" value={user.phone} />
            {(isPlayer || isCoach) && <InfoRow label="Position" value={user.position} />}
            {isParent && <InfoRow label="Barnets namn" value={user.childName} />}
            <InfoRow label="Klubb" value={user.clubName} />
            {!user.phone && !user.bio && !user.position && (
              <p className="text-xs text-slate-500 italic mt-1">Klicka Redigera för att lägga till mer info.</p>
            )}
          </div>
        )}
      </Card>

      {/* ── Lösenord ── */}
      <Card>
        <SectionHeading>Konto & säkerhet</SectionHeading>
        {showPasswordForm ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Nytt lösenord</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minst 6 tecken"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Bekräfta lösenord</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Upprepa lösenordet"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-400"
                onKeyDown={(e) => e.key === "Enter" && savePassword()} />
            </div>
            {passwordError && <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{passwordError}</p>}
            <div className="flex gap-2">
              <button onClick={savePassword} disabled={savingPassword || !newPassword}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {savingPassword ? "Sparar…" : "Byt lösenord"}
              </button>
              <button onClick={() => { setShowPasswordForm(false); setNewPassword(""); setConfirmPassword(""); setPasswordError(""); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPasswordForm(true)}
            className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
            🔑 Byt lösenord
          </button>
        )}
      </Card>

      {/* ── Coach: invite codes ── */}
      {(isCoach || isAdmin) && teams.length > 0 && (
        <Card>
          <SectionHeading>Inbjudningskoder</SectionHeading>
          <div className="space-y-3">
            {teams.map((team) => (
              <div key={team.id} className="rounded-xl bg-slate-700/40 p-3">
                <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">{team.name}</p>
                <div className="space-y-1.5">
                  {[
                    { label: "Assisterande tränare", code: team.inviteCode },
                    { label: "Föräldrar", code: team.parentInviteCode },
                    { label: "Spelare", code: team.playerInviteCode },
                  ].map(({ label, code }) => code && (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{label}</span>
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg">{code}</code>
                        <CopyButton value={code} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Admin: club settings ── */}
      {isAdmin && (
        <Card>
          <SectionHeading>Föreningsinställningar</SectionHeading>
          <p className="text-xs text-slate-500 mb-3">Hantera logotyp, webbplats och lag i adminpanelen.</p>
          <Link href="/admin"
            className="block w-full py-2.5 text-center bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors">
            🏛 Öppna adminpanel
          </Link>
        </Card>
      )}

      {/* ── Upcoming sessions ── */}
      {upcomingSessions.length > 0 && (
        <Card>
          <SectionHeading>Kommande pass</SectionHeading>
          <div className="space-y-2">
            {upcomingSessions.map((s) => {
              const isMatch = s.type === "match";
              return (
                <Link key={s.id} href={`/session/${s.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/40 hover:bg-slate-700 transition-colors">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${isMatch ? "bg-red-900/50 text-red-300" : "bg-emerald-900/50 text-emerald-300"}`}>
                    {isMatch ? "🏀" : "🏋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{s.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(s.date)}{s.time ? ` · ${s.time}` : ""}</p>
                  </div>
                  <span className="text-slate-500 text-xs shrink-0">↗</span>
                </Link>
              );
            })}
          </div>
          <Link href="/kalender" className="block text-center text-xs text-orange-400 hover:text-orange-300 mt-3 font-semibold">
            Visa hela kalendern →
          </Link>
        </Card>
      )}

      {/* ── Push notifications ── */}
      <Card>
        <SectionHeading>Push-notiser</SectionHeading>
        <p className="text-sm text-slate-500 mb-4">Få direktnotis när träningar ställs in eller viktiga händelser inträffar.</p>

        {currentPermission === "granted" && !notifMessage && (
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300 bg-emerald-900/20 rounded-xl px-4 py-3 border border-emerald-700/40">
            <span>✅</span><span>Notiser är aktiverade</span>
          </div>
        )}
        {currentPermission === "denied" && (
          <div className="text-sm text-red-400 bg-red-900/20 rounded-xl px-4 py-3 border border-red-800/40">
            <p className="font-medium mb-1">Notiser är blockerade</p>
            <p className="text-xs">Gå till webbläsarens inställningar och tillåt notiser, ladda sedan om sidan.</p>
          </div>
        )}
        {(currentPermission === "default" || currentPermission === null) && (
          <button onClick={handleEnableNotifications} disabled={requesting}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
            {requesting ? "Aktiverar…" : "🔔 Aktivera notiser"}
          </button>
        )}
        {notifMessage && (
          <p className="text-sm text-slate-400 bg-slate-700/40 rounded-xl px-4 py-2.5 mt-2">{notifMessage}</p>
        )}
        <p className="text-xs text-slate-600 mt-3">
          iOS: installera appen på hemskärmen via Safari → Dela → Lägg till på hemskärmen.
        </p>
      </Card>
    </div>
  );
}
