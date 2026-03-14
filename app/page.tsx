import Link from "next/link";
import { SPORTS } from "../lib/sports";

const colorMap: Record<string, {
  border: string; tagBg: string; linkColor: string; iconBg: string; btnBg: string; btnHover: string;
}> = {
  orange: {
    border: "border-t-orange-500",
    tagBg: "bg-orange-100 text-orange-700",
    linkColor: "text-orange-700 group-hover:text-orange-800",
    iconBg: "bg-orange-500",
    btnBg: "bg-orange-500",
    btnHover: "hover:bg-orange-600",
  },
  green: {
    border: "border-t-green-500",
    tagBg: "bg-green-100 text-green-700",
    linkColor: "text-green-700 group-hover:text-green-800",
    iconBg: "bg-green-600",
    btnBg: "bg-green-600",
    btnHover: "hover:bg-green-700",
  },
  blue: {
    border: "border-t-blue-500",
    tagBg: "bg-blue-100 text-blue-700",
    linkColor: "text-blue-700 group-hover:text-blue-800",
    iconBg: "bg-blue-600",
    btnBg: "bg-blue-600",
    btnHover: "hover:bg-blue-700",
  },
  purple: {
    border: "border-t-purple-500",
    tagBg: "bg-purple-100 text-purple-700",
    linkColor: "text-purple-700 group-hover:text-purple-800",
    iconBg: "bg-purple-600",
    btnBg: "bg-purple-600",
    btnHover: "hover:bg-purple-700",
  },
  yellow: {
    border: "border-t-yellow-400",
    tagBg: "bg-yellow-100 text-yellow-700",
    linkColor: "text-yellow-700 group-hover:text-yellow-800",
    iconBg: "bg-yellow-500",
    btnBg: "bg-yellow-500",
    btnHover: "hover:bg-yellow-600",
  },
};

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <div className="relative text-center mb-14 py-16 px-4 rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_50%,_#f97316_0%,_transparent_60%)]" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 tracking-wide uppercase">
            🏆 Sportplanering för coacher
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Träningsplanering för<br className="hidden sm:block" /> ungdomscoacher
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto leading-relaxed">
            Färdiga säsongsplaner för de mest populära sporterna i Sverige.
            Välj din sport och kom igång direkt — allt du behöver för att leda
            ungdomsträning är samlat på ett ställe.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {SPORTS.map((s) => (
              <Link
                key={s.id}
                href={`/${s.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium transition-colors"
              >
                <span>{s.emoji}</span>
                <span>{s.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Sports grid */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Välj din sport</h2>
        <p className="text-slate-500 text-sm">
          Varje sport har kompletta träningsplaner för tre åldersgrupper (upp till 9 år).
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
        {SPORTS.map((sport) => {
          const c = colorMap[sport.color];
          return (
            <Link
              key={sport.id}
              href={`/${sport.id}`}
              className={`group block bg-white rounded-2xl border border-t-4 ${c.border} border-slate-100 p-6 shadow-sm card-hover`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-2xl ${c.iconBg} flex items-center justify-center text-2xl shadow-sm`}>
                  {sport.emoji}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{sport.name}</h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.tagBg}`}>
                    3 årsplaner
                  </span>
                </div>
              </div>

              <p className="text-slate-500 text-sm leading-relaxed mb-5">
                {sport.description}
              </p>

              <div className={`text-sm font-semibold flex items-center gap-1 ${c.linkColor} transition-colors`}>
                Se träningsplaner
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* How it works */}
      <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-sm mb-10">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Hur fungerar det?</h2>
        <p className="text-slate-500 text-sm mb-6">
          Plattformen är byggd för föreningar och coacher som vill ha strukturerade träningsplaner.
        </p>
        <div className="grid sm:grid-cols-3 gap-6 text-sm text-slate-600">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
              🏛
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">Registrera föreningen</p>
              <p>
                Registrera dig som föreningsadmin och välj din sport. Du får automatiskt tillgång
                till träningsplaner och verktyg.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
              👥
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">Bjud in coacher och spelare</p>
              <p>
                Dela inbjudningskoder med coacher, assistenter, föräldrar och spelare
                för att bygga upp din förening.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
              📋
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">Planera och genomför träningar</p>
              <p>
                Använd färdiga träningsplaner, taktiktavlan, kalender och statistik för
                att leda ditt lag.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Kom igång idag</h2>
        <p className="text-slate-400 text-sm mb-6">
          Registrera din förening gratis och välj en sport att komma igång med.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/registrera"
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl transition-colors"
          >
            Registrera förening →
          </Link>
          <Link
            href="/login"
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl transition-colors"
          >
            Logga in
          </Link>
        </div>
      </div>
    </div>
  );
}
