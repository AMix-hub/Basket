"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SeasonPlan } from "../data/types";
import { useAuth } from "../context/AuthContext";
import type { Team } from "../context/AuthContext";
import {
  collection,
  query,
  where,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../lib/firebaseClient";

interface Props {
  plan: SeasonPlan;
}

interface SubActivity {
  id: string;
  name: string;
  description: string;
}

interface SessionNote {
  subActivities: SubActivity[];
  comment: string;
}

interface TrainingFreePeriod {
  startDate: string;
  endDate: string;
  adminId: string;
}

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function generateSeasonDates(
  startDate: string,
  weekday: number,
  count: number,
  freePeriods: TrainingFreePeriod[]
): string[] {
  const dates: string[] = [];
  const cur = new Date(startDate + "T12:00:00");
  while (cur.getDay() !== weekday) {
    cur.setDate(cur.getDate() + 1);
  }
  const limit = new Date(startDate + "T12:00:00");
  limit.setFullYear(limit.getFullYear() + 3);
  while (dates.length < count && cur <= limit) {
    const ymd = toYMD(cur);
    const inFree = freePeriods.some((p) => ymd >= p.startDate && ymd <= p.endDate);
    if (!inFree) {
      dates.push(ymd);
    }
    cur.setDate(cur.getDate() + 7);
  }
  return dates;
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Måndag" },
  { value: 2, label: "Tisdag" },
  { value: 3, label: "Onsdag" },
  { value: 4, label: "Torsdag" },
  { value: 5, label: "Fredag" },
  { value: 6, label: "Lördag" },
  { value: 0, label: "Söndag" },
];

export default function SeasonPage({ plan }: Props) {
  const { user, getMyTeam } = useAuth();
  const defaultTeam = getMyTeam();
  const team = defaultTeam;

  const canEdit =
    user?.roles.some((r) => r === "coach" || r === "admin" || r === "assistant") ?? false;

  const [notes, setNotes] = useState<Record<number, SessionNote>>({});
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState<Record<number, string>>({});
  const [savingComment, setSavingComment] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState<Record<number, string>>({});
  const [newSubDesc, setNewSubDesc] = useState<Record<number, string>>({});
  const [savingSubActivity, setSavingSubActivity] = useState<number | null>(null);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedTeam, setSchedTeam] = useState<string>("");
  const [schedStartDate, setSchedStartDate] = useState(toYMD(new Date()));
  const [schedWeekday, setSchedWeekday] = useState(1);
  const [schedTime, setSchedTime] = useState("17:00");
  const [schedEndTime, setSchedEndTime] = useState("18:30");
  const [schedBusy, setSchedBusy] = useState(false);
  const [schedDone, setSchedDone] = useState(false);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [freePeriods, setFreePeriods] = useState<TrainingFreePeriod[]>([]);

  useEffect(() => {
    if (!team) return;
    const q = query(
      collection(db, "session_notes"),
      where("teamId", "==", team.id),
      where("planYear", "==", plan.year)
    );
    const unsub = onSnapshot(q, (snap) => {
      const loaded: Record<number, SessionNote> = {};
      snap.docs.forEach((d) => {
        const num = d.data().sessionNumber as number;
        loaded[num] = {
          subActivities: (d.data().subActivities as SubActivity[]) ?? [],
          comment: (d.data().comment as string) ?? "",
        };
      });
      setNotes(loaded);
    });
    return () => unsub();
  }, [team, plan.year]);

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.roles.includes("admin");
    if (isAdmin) {
      // Query admin's teams directly using already-imported Firestore functions
      getDocs(query(collection(db, "teams"), where("adminId", "==", user.id))).then((snap) => {
        const adminTeams = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name as string,
          ageGroup: d.data().ageGroup as string,
          coachId: (d.data().coachId as string) ?? "",
          adminId: d.data().adminId as string,
          clubName: (d.data().clubName as string) ?? "",
          memberIds: (d.data().memberIds as string[]) ?? [],
          inviteCode: (d.data().inviteCode as string) ?? "",
          parentInviteCode: (d.data().parentInviteCode as string) ?? "",
          playerInviteCode: (d.data().playerInviteCode as string) ?? "",
        }));
        setAllTeams(adminTeams);
        if (adminTeams.length > 0) setSchedTeam((prev) => prev || adminTeams[0].id);
      });
    } else if (team) {
      setAllTeams([team]);
      setSchedTeam((prev) => prev || team.id);
    }
  }, [user?.id, user?.roles, team?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const adminId = user.roles.includes("admin") ? user.id : team?.adminId;
    if (!adminId) return;
    const q = query(collection(db, "training_free_periods"), where("adminId", "==", adminId));
    const unsub = onSnapshot(q, (snap) => {
      setFreePeriods(
        snap.docs.map((d) => ({
          startDate: d.data().startDate as string,
          endDate: d.data().endDate as string,
          adminId: d.data().adminId as string,
        }))
      );
    });
    return () => unsub();
  }, [user?.id, user?.roles, team?.adminId]);

  const getNoteDocId = (sessionNumber: number) =>
    `${team?.id}_${plan.year}_${sessionNumber}`;

  const saveComment = async (sessionNumber: number) => {
    if (!team || !user) return;
    setSavingComment(sessionNumber);
    try {
      const docId = getNoteDocId(sessionNumber);
      const existing = notes[sessionNumber] ?? { subActivities: [], comment: "" };
      await setDoc(doc(db, "session_notes", docId), {
        teamId: team.id,
        planYear: plan.year,
        sessionNumber,
        subActivities: existing.subActivities,
        comment: editingComment[sessionNumber] ?? "",
        updatedAt: new Date().toISOString(),
      });
      setExpandedSession(null);
    } finally {
      setSavingComment(null);
    }
  };

  const addSubActivity = async (sessionNumber: number) => {
    if (!team || !user) return;
    const name = (newSubName[sessionNumber] ?? "").trim();
    const description = (newSubDesc[sessionNumber] ?? "").trim();
    if (!name) return;
    setSavingSubActivity(sessionNumber);
    try {
      const docId = getNoteDocId(sessionNumber);
      const existing = notes[sessionNumber] ?? { subActivities: [], comment: "" };
      const newSub: SubActivity = { id: crypto.randomUUID(), name, description };
      await setDoc(doc(db, "session_notes", docId), {
        teamId: team.id,
        planYear: plan.year,
        sessionNumber,
        subActivities: [...existing.subActivities, newSub],
        comment: existing.comment,
        updatedAt: new Date().toISOString(),
      });
      setNewSubName((prev) => ({ ...prev, [sessionNumber]: "" }));
      setNewSubDesc((prev) => ({ ...prev, [sessionNumber]: "" }));
    } finally {
      setSavingSubActivity(null);
    }
  };

  const deleteSubActivity = async (sessionNumber: number, subId: string) => {
    if (!team || !user) return;
    const existing = notes[sessionNumber];
    if (!existing) return;
    const docId = getNoteDocId(sessionNumber);
    await setDoc(doc(db, "session_notes", docId), {
      teamId: team.id,
      planYear: plan.year,
      sessionNumber,
      subActivities: existing.subActivities.filter((s) => s.id !== subId),
      comment: existing.comment,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleGenerateSeason = async () => {
    const targetTeamId = schedTeam || team?.id;
    if (!targetTeamId || !user) return;
    setSchedBusy(true);
    try {
      const dates = generateSeasonDates(schedStartDate, schedWeekday, plan.sessions.length, freePeriods);
      const BATCH_SIZE = 500;
      const batchPromises: Promise<void>[] = [];
      const groupId = crypto.randomUUID();
      for (let i = 0; i < dates.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        dates.slice(i, i + BATCH_SIZE).forEach((date, idx) => {
          const session = plan.sessions[i + idx];
          if (!session) return;
          batch.set(doc(collection(db, "sessions")), {
            teamId: targetTeamId,
            date,
            title: session.title,
            type: "träning",
            time: schedTime,
            endTime: schedEndTime || null,
            createdBy: user.id,
            planYear: plan.year,
            planSessionNumber: session.number,
            recurringGroupId: groupId,
          });
        });
        batchPromises.push(batch.commit());
      }
      await Promise.all(batchPromises);
      setSchedDone(true);
    } catch (err) {
      console.error("Failed to generate season schedule:", err);
      alert("Kunde inte skapa säsongsschemat. Försök igen.");
    } finally {
      setSchedBusy(false);
    }
  };

  const previewDates =
    schedStartDate && plan.sessions.length > 0
      ? generateSeasonDates(schedStartDate, schedWeekday, Math.min(plan.sessions.length, 5), freePeriods)
      : [];
  const totalDates = schedStartDate
    ? generateSeasonDates(schedStartDate, schedWeekday, plan.sessions.length, freePeriods)
    : [];

  return (
    <div>
      {/* Season Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {schedDone ? (
              <div className="text-center py-4">
                <p className="text-4xl mb-3">✅</p>
                <h3 className="font-bold text-slate-900 mb-2">Schema skapat!</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {plan.sessions.length} träningar har lagts in i kalendern.
                </p>
                <button
                  onClick={() => { setShowScheduleModal(false); setSchedDone(false); }}
                  className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600"
                >
                  Stäng
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-bold text-slate-900 mb-1">
                  Schemalägg säsong – År {plan.year}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Välj startdatum och träningstider. {plan.sessions.length} träningar skapas
                  automatiskt, en per vecka, med träningsfria perioder överhoppade.
                </p>
                <div className="space-y-3">
                  {allTeams.length > 1 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Lag</label>
                      <select
                        value={schedTeam}
                        onChange={(e) => setSchedTeam(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                      >
                        {allTeams.map((t) => (
                          <option key={t.id} value={t.id}>{t.name} ({t.ageGroup})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Startdatum</label>
                    <input
                      type="date"
                      value={schedStartDate}
                      onChange={(e) => setSchedStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Träningsdag</label>
                    <select
                      value={schedWeekday}
                      onChange={(e) => setSchedWeekday(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    >
                      {WEEKDAY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Starttid</label>
                      <input
                        type="time"
                        value={schedTime}
                        onChange={(e) => setSchedTime(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Sluttid</label>
                      <input
                        type="time"
                        value={schedEndTime}
                        onChange={(e) => setSchedEndTime(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>
                  {previewDates.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">
                        Förhandsvisning ({totalDates.length} av {plan.sessions.length} datum):
                      </p>
                      <ul className="text-xs text-blue-600 space-y-0.5">
                        {previewDates.map((d, i) => (
                          <li key={d}>
                            Pass {plan.sessions[i]?.number}:{" "}
                            {new Date(d + "T12:00:00").toLocaleDateString("sv-SE", {
                              weekday: "long", day: "numeric", month: "long",
                            })}
                          </li>
                        ))}
                        {plan.sessions.length > 5 && (
                          <li className="text-blue-400">…och {plan.sessions.length - 5} till</li>
                        )}
                      </ul>
                      {freePeriods.length > 0 && (
                        <p className="text-xs text-purple-600 mt-1">
                          🚫 Träningsfria perioder hoppas över automatiskt
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={handleGenerateSeason}
                    disabled={schedBusy || !schedStartDate || totalDates.length === 0}
                    className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40"
                  >
                    {schedBusy ? "Skapar…" : `📅 Skapa ${totalDates.length} träningar`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span>←</span> Alla säsonger
        </Link>
      </div>

      {/* Header */}
      <div className="mb-10">
        <span className="inline-flex items-center gap-2 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide">
          🏀 År {plan.year}
        </span>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
              Träningsplanering – {plan.ageGroup}
            </h1>
            <p className="text-slate-500 max-w-2xl leading-relaxed">{plan.description}</p>
          </div>
          {canEdit && (schedTeam || team) && (
            <button
              onClick={() => { setSchedDone(false); setShowScheduleModal(true); }}
              className="shrink-0 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
            >
              📅 Schemalägg säsong
            </button>
          )}
        </div>
      </div>

      {/* Coach tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-10">
        <h2 className="text-base font-bold text-amber-900 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center text-sm">
            💡
          </span>
          Tips till tränaren
        </h2>
        <ul className="space-y-3">
          {plan.coachTips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3 text-amber-900 text-sm leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Sessions header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-slate-800">Träningspass</h2>
        <span className="text-sm font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
          {plan.sessions.length} pass
        </span>
      </div>

      {/* Sessions */}
      <div className="space-y-3">
        {plan.sessions.map((session) => {
          const sessionNote = notes[session.number];
          const isExpanded = expandedSession === session.number;
          return (
            <details
              key={session.number}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
            >
              <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 list-none transition-colors">
                <span className="bg-orange-500 text-white text-xs font-bold w-14 text-center py-0.5 rounded-full shrink-0">
                  Pass {session.number}
                </span>
                <span className="font-semibold text-slate-800 flex-1 min-w-0 truncate">
                  {session.title}
                </span>
                <span className="text-slate-400 text-xs shrink-0 mr-2">
                  {session.activities.length + (sessionNote?.subActivities.length ?? 0)} övningar
                </span>
                {sessionNote?.comment && (
                  <span className="text-xs text-blue-500 shrink-0 mr-1" title="Har kommentar">💬</span>
                )}
                <svg
                  className="chevron w-4 h-4 text-slate-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>

              <div className="divide-y divide-slate-100 bg-slate-50/50">
                {/* Plan activities */}
                {session.activities.map((activity, idx) => (
                  <div key={idx} className="px-5 py-4">
                    <p className="font-semibold text-slate-800 mb-1 text-sm">{activity.name}</p>
                    <p className="text-sm text-slate-500 leading-relaxed">{activity.description}</p>
                    {activity.tips && (
                      <p className="mt-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                        💡 {activity.tips}
                      </p>
                    )}
                  </div>
                ))}

                {/* Coach-added sub-activities */}
                {sessionNote?.subActivities.map((sub) => (
                  <div key={sub.id} className="px-5 py-4 bg-blue-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            Tillagd övning
                          </span>
                          <p className="font-semibold text-slate-800 text-sm">{sub.name}</p>
                        </div>
                        {sub.description && (
                          <p className="text-sm text-slate-500 leading-relaxed">{sub.description}</p>
                        )}
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => deleteSubActivity(session.number, sub.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors text-sm shrink-0"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Comment / edit panel */}
                <div className="px-5 py-4">
                  {!isExpanded ? (
                    <div>
                      {sessionNote?.comment && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-blue-600 mb-1">💬 Tränarkommentar</p>
                          <p className="text-sm text-slate-600 leading-relaxed">{sessionNote.comment}</p>
                        </div>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => {
                            setExpandedSession(session.number);
                            setEditingComment((prev) => ({
                              ...prev,
                              [session.number]: sessionNote?.comment ?? "",
                            }));
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                        >
                          {sessionNote?.comment ? "✏️ Redigera kommentar / delövning" : "+ Lägg till kommentar / delövning"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-1">💬 Tränarkommentar</p>
                        <textarea
                          value={editingComment[session.number] ?? sessionNote?.comment ?? ""}
                          onChange={(e) =>
                            setEditingComment((prev) => ({ ...prev, [session.number]: e.target.value }))
                          }
                          placeholder="Skriv en kommentar eller anteckning för detta pass..."
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                        />
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => setExpandedSession(null)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            Avbryt
                          </button>
                          <button
                            disabled={savingComment === session.number}
                            onClick={() => saveComment(session.number)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                          >
                            {savingComment === session.number ? "Sparar…" : "Spara kommentar"}
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-xs font-semibold text-slate-600 mb-2">➕ Lägg till delövning</p>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newSubName[session.number] ?? ""}
                            onChange={(e) =>
                              setNewSubName((prev) => ({ ...prev, [session.number]: e.target.value }))
                            }
                            placeholder="Övningens namn..."
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <textarea
                            value={newSubDesc[session.number] ?? ""}
                            onChange={(e) =>
                              setNewSubDesc((prev) => ({ ...prev, [session.number]: e.target.value }))
                            }
                            placeholder="Beskrivning (valfritt)..."
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                          />
                          <button
                            disabled={
                              savingSubActivity === session.number ||
                              !(newSubName[session.number] ?? "").trim()
                            }
                            onClick={() => addSubActivity(session.number)}
                            className="w-full py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-40"
                          >
                            {savingSubActivity === session.number ? "Lägger till…" : "+ Lägg till delövning"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
