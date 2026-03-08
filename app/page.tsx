import Link from "next/link";

const seasons = [
  {
    year: 1,
    href: "/ar1",
    ageGroup: "Upp till 7 år",
    color: "bg-green-50 border-green-300 hover:border-green-500",
    badge: "bg-green-100 text-green-700",
    icon: "🌱",
    description:
      "Glädje, lek och grundläggande motorik. Lär barnen att älska basket utan krav på teknisk perfektion.",
    highlights: ["Studsteknik", "Kasta mot korg", "Passningar", "Lagkänsla"],
  },
  {
    year: 2,
    href: "/ar2",
    ageGroup: "8 år",
    color: "bg-blue-50 border-blue-300 hover:border-blue-500",
    badge: "bg-blue-100 text-blue-700",
    icon: "⚡",
    description:
      "Bygg vidare på grunderna. Introducera specifika basket-tekniker och enkel speltaktik.",
    highlights: ["Läggningar", "Försvarsgrunder", "Triple threat", "Minibasket"],
  },
  {
    year: 3,
    href: "/ar3",
    ageGroup: "9 år",
    color: "bg-orange-50 border-orange-300 hover:border-orange-500",
    badge: "bg-orange-100 text-orange-700",
    icon: "🔥",
    description:
      "Teknisk finslipning och taktiskt spelande. Offensiva och defensiva system, matchspel med fulla regler.",
    highlights: ["Pick and roll", "Zonförsvar", "Motion offense", "Situationsspel"],
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          🏀 Träningsplanering för coacher
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Färdig säsongsplanering för basket med barn i åldrarna upp till 9 år.
          Välj ett år nedan för att se hela säsongens träningspass med
          uppvärmning, övningar, spel och nedvarvning.
        </p>
      </div>

      {/* Season cards */}
      <div className="grid sm:grid-cols-3 gap-6 mb-12">
        {seasons.map((s) => (
          <Link
            key={s.year}
            href={s.href}
            className={`block border-2 rounded-2xl p-6 transition-all hover:shadow-lg ${s.color}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{s.icon}</span>
              <div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>
                  År {s.year}
                </span>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">
                  {s.ageGroup}
                </p>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-4">{s.description}</p>

            <ul className="space-y-1">
              {s.highlights.map((h) => (
                <li key={h} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-gray-400">•</span>
                  {h}
                </li>
              ))}
            </ul>

            <div className="mt-4 text-sm font-medium text-gray-800 flex items-center gap-1">
              Visa säsongsplan <span>→</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Info section */}
      <div className="bg-gray-100 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Hur använder man den här sidan?
        </h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-gray-700">
          <div className="flex gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="font-semibold mb-1">Välj säsongsår</p>
              <p>Välj rätt år baserat på barnens åldersgrupp.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <p className="font-semibold mb-1">Följ månad för månad</p>
              <p>
                Varje månad har tydliga träningspass med tema, övningar och
                spel.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="font-semibold mb-1">Anpassa fritt</p>
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
