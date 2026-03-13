import Link from "next/link";

export interface SportSeasonCard {
  year: number;
  href: string;
  ageGroup: string;
  accentColor: string;
  tagBg: string;
  linkColor: string;
  icon: string;
  description: string;
  highlights: string[];
}

interface SportOverviewPageProps {
  sportEmoji: string;
  sportName: string;
  sportSlug: string;
  heroFrom: string;
  heroAccent: string;
  heroAccentBg: string;
  heroAccentText: string;
  tagline: string;
  description: string;
  stats: { value: string; label: string }[];
  seasons: SportSeasonCard[];
}

export default function SportOverviewPage({
  sportEmoji,
  sportName,
  sportSlug,
  heroAccent,
  heroAccentBg,
  heroAccentText,
  tagline,
  description,
  stats,
  seasons,
}: SportOverviewPageProps) {
  return (
    <div>
      {/* Hero */}
      <div className="relative text-center mb-14 py-14 px-4 rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,_var(--hero-color)_0%,_transparent_60%)]"
          style={{ "--hero-color": heroAccent } as React.CSSProperties}
        />
        <div className="relative">
          <span
            className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 tracking-wide uppercase ${heroAccentBg} ${heroAccentText}`}
          >
            {sportEmoji} {sportName} Träningsplanering
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            {tagline}
          </h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto leading-relaxed">
            {description}
          </p>
          <div className="flex justify-center gap-6 mt-8 text-slate-400 text-sm">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-6">
                {i > 0 && <div className="w-px h-8 bg-slate-700" />}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold text-white">{s.value}</span>
                  <span>{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Season cards */}
      <div className="grid sm:grid-cols-3 gap-6 mb-14">
        {seasons.map((s) => (
          <Link
            key={s.year}
            href={`/${sportSlug}/${s.href}`}
            className={`group block bg-white rounded-2xl border border-t-4 ${s.accentColor} border-slate-100 p-6 shadow-sm card-hover`}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{s.icon}</span>
              <div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${s.tagBg}`}>
                  År {s.year}
                </span>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                  {s.ageGroup}
                </p>
              </div>
            </div>

            <p className="text-slate-500 text-sm leading-relaxed mb-5">{s.description}</p>

            <ul className="space-y-1.5 mb-5">
              {s.highlights.map((h) => (
                <li key={h} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>

            <div className={`text-sm font-semibold flex items-center gap-1 ${s.linkColor} transition-colors`}>
              Visa säsongsplan
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Info section */}
      <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          Hur använder man den här sidan?
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 text-sm text-slate-600">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0">
              📅
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">Välj säsongsår</p>
              <p>Välj rätt år baserat på barnens åldersgrupp.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0">
              📝
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">Följ pass för pass</p>
              <p>
                Varje träningspass har tydliga övningar med instruktioner och
                tips.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0">
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
