"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { getSport } from "../../lib/sports";

const yearPlans = [
  {
    year: 1,
    ageGroup: "Upp till 7 år",
    accentColor: "border-t-emerald-500",
    badgeBg: "bg-emerald-500",
    tagBg: "bg-emerald-50 text-emerald-700",
    linkColor: "text-emerald-700 group-hover:text-emerald-800",
    icon: "🌱",
    description:
      "Glädje, lek och grundläggande motorik. 36 träningspass med fokus på att introducera grunderna och ha riktigt kul.",
    highlights: ["Bollbekantskap", "Dribbling", "Skott mot mål", "Roliga lekar"],
  },
  {
    year: 2,
    ageGroup: "8 år",
    accentColor: "border-t-blue-500",
    badgeBg: "bg-blue-500",
    tagBg: "bg-blue-50 text-blue-700",
    linkColor: "text-blue-700 group-hover:text-blue-800",
    icon: "⚡",
    description:
      "Repetera grunderna och introducera matchspelet. 36 träningspass med progression mot mer sportspecifika färdigheter.",
    highlights: ["Passningar", "Rörelse", "Matchspel", "Lagövningar"],
  },
  {
    year: 3,
    ageGroup: "9 år",
    accentColor: "border-t-orange-500",
    badgeBg: "bg-orange-500",
    tagBg: "bg-orange-50 text-orange-700",
    linkColor: "text-orange-700 group-hover:text-orange-800",
    icon: "🔥",
    description:
      "Teknisk finslipning och taktisk förståelse. 36 träningspass indelade i två cykler med helt nya moment.",
    highlights: ["Teknik", "Taktik", "Spelövningar", "Matchspel"],
  },
];

export default function TraningsdatabasPage() {
  const { user } = useAuth();
  const sportId = user?.sport ?? "basket";
  const sport = getSport(sportId);

  function yearHref(year: number) {
    if (sportId === "basket") return `/ar${year}`;
    return `/${sportId}/ar${year}`;
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative text-center mb-14 py-14 px-4 rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,_#f97316_0%,_transparent_60%)]" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 tracking-wide uppercase">
            {sport.emoji} Träningsdatabas
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Träningsdatabas<br className="hidden sm:block" /> – {sport.name}
          </h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto leading-relaxed">
            Välj säsongsår för att bläddra i träningspassen och schemalägga din
            säsong direkt från planen.
          </p>
          <div className="flex justify-center gap-6 mt-8 text-slate-400 text-sm">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-white">3</span>
              <span>årsplaner</span>
            </div>
            <div className="w-px bg-slate-700" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-white">36</span>
              <span>pass / år</span>
            </div>
            <div className="w-px bg-slate-700" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-white">60</span>
              <span>min / pass</span>
            </div>
          </div>
        </div>
      </div>

      {/* Year plan cards */}
      <div className="grid sm:grid-cols-3 gap-6 mb-14">
        {yearPlans.map((s) => (
          <Link
            key={s.year}
            href={yearHref(s.year)}
            className={`group block bg-white rounded-2xl border border-t-4 ${s.accentColor} border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{s.icon}</span>
              <div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${s.tagBg}`}
                >
                  År {s.year}
                </span>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                  {s.ageGroup}
                </p>
              </div>
            </div>

            <p className="text-slate-500 text-sm leading-relaxed mb-5">
              {s.description}
            </p>

            <ul className="space-y-1.5 mb-5">
              {s.highlights.map((h) => (
                <li
                  key={h}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>

            <div
              className={`text-sm font-semibold flex items-center gap-1 ${s.linkColor} transition-colors`}
            >
              Visa träningsplan
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Info section */}
      <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          Schemalägg träningar direkt från planen
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 text-sm text-slate-600">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl shrink-0">
              📚
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">Välj årsplan</p>
              <p>Välj rätt år baserat på spelarnas åldersgrupp.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl shrink-0">
              📅
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">
                Schemalägg säsongen
              </p>
              <p>
                Använd knappen &quot;Schemalägg säsong&quot; i årsplanen för att
                automatiskt lägga in alla pass i kalendern.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-xl shrink-0">
              🎯
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">Anpassa fritt</p>
              <p>
                Passen är förslag – anpassa gärna efter din grupps behov och
                nivå.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
