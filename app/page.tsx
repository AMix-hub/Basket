import Link from "next/link";
import Image from "next/image";
import { SPORTS } from "../lib/sports";

const colorMap: Record<string, {
  border: string; tagBg: string; linkColor: string; iconBg: string;
  glowColor: string; accentText: string;
}> = {
  orange: {
    border: "border-orange-500/40 hover:border-orange-400/70",
    tagBg: "bg-orange-500/15 text-orange-300",
    linkColor: "text-orange-400 group-hover:text-orange-300",
    iconBg: "bg-orange-500/20",
    glowColor: "group-hover:shadow-[0_8px_30px_rgba(249,115,22,0.25)]",
    accentText: "text-orange-400",
  },
  green: {
    border: "border-emerald-500/40 hover:border-emerald-400/70",
    tagBg: "bg-emerald-500/15 text-emerald-300",
    linkColor: "text-emerald-400 group-hover:text-emerald-300",
    iconBg: "bg-emerald-500/20",
    glowColor: "group-hover:shadow-[0_8px_30px_rgba(34,197,94,0.25)]",
    accentText: "text-emerald-400",
  },
  blue: {
    border: "border-sky-500/40 hover:border-sky-400/70",
    tagBg: "bg-sky-500/15 text-sky-300",
    linkColor: "text-sky-400 group-hover:text-sky-300",
    iconBg: "bg-sky-500/20",
    glowColor: "group-hover:shadow-[0_8px_30px_rgba(14,165,233,0.25)]",
    accentText: "text-sky-400",
  },
  purple: {
    border: "border-violet-500/40 hover:border-violet-400/70",
    tagBg: "bg-violet-500/15 text-violet-300",
    linkColor: "text-violet-400 group-hover:text-violet-300",
    iconBg: "bg-violet-500/20",
    glowColor: "group-hover:shadow-[0_8px_30px_rgba(139,92,246,0.25)]",
    accentText: "text-violet-400",
  },
  yellow: {
    border: "border-amber-500/40 hover:border-amber-400/70",
    tagBg: "bg-amber-500/15 text-amber-300",
    linkColor: "text-amber-400 group-hover:text-amber-300",
    iconBg: "bg-amber-500/20",
    glowColor: "group-hover:shadow-[0_8px_30px_rgba(245,158,11,0.25)]",
    accentText: "text-amber-400",
  },
};

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: "Registrera föreningen",
    desc: "Registrera dig som föreningsadmin och välj din sport. Du får automatiskt tillgång till träningsplaner och verktyg.",
    accent: "text-cyan-400",
    glow: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "Bjud in coacher och spelare",
    desc: "Dela inbjudningskoder med coacher, assistenter, föräldrar och spelare för att bygga upp din förening.",
    accent: "text-violet-400",
    glow: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    title: "Planera och genomför",
    desc: "Använd färdiga träningsplaner, taktiktavlan, kalender och statistik för att leda ditt lag.",
    accent: "text-emerald-400",
    glow: "bg-emerald-500/10 border-emerald-500/20",
  },
];

export default function Home() {
  return (
    <div className="space-y-20">

      {/* ── Hero ── */}
      <div className="relative text-center py-20 px-4 -mx-4 -mt-10 overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-[#0f172a] to-[#0f172a]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-sky-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-violet-500/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-cyan-500/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
          {/* Brand */}
          <div className="flex justify-center items-center gap-3 mb-6">
            <Image
              src="/sportiq-logo.png"
              alt="SportIQ"
              width={72}
              height={72}
              className="rounded-2xl object-cover shadow-lg ring-2 ring-sky-500/30"
            />
            <span className="text-3xl font-extrabold text-white tracking-tight">SportIQ</span>
          </div>

          {/* Badge */}
          <span className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/25 text-sky-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-widest uppercase">
            🏆 Sportplanering för coacher
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-5 leading-tight">
            <span className="text-white">Träningsplanering för</span>
            <br />
            <span className="text-gradient-cyan">ungdomscoacher</span>
          </h1>

          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
            Färdiga säsongsplaner för de mest populära sporterna i Sverige.
            Välj din sport och kom igång direkt — allt du behöver för att leda
            ungdomsträning är samlat på ett ställe.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            <Link
              href="/registrera"
              className="px-7 py-3 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-sky-500/25 hover:shadow-sky-400/35 hover:-translate-y-0.5"
            >
              Kom igång gratis →
            </Link>
            <Link
              href="/login"
              className="px-7 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 font-semibold text-sm rounded-xl transition-all duration-200"
            >
              Logga in
            </Link>
          </div>

          {/* Sport pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {SPORTS.map((s) => (
              <Link
                key={s.id}
                href={`/${s.id}`}
                className="flex items-center gap-2 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 text-slate-300 hover:text-white rounded-full text-sm font-medium transition-all duration-150"
              >
                <span>{s.emoji}</span>
                <span>{s.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dashboard Preview ── */}
      <div className="relative">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-4 tracking-widest uppercase">
            ✦ Plattformsöversikt
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Allt du behöver på ett ställe
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            En komplett plattform för coacher — träningsplaner, taktiktavla, kalender,
            statistik och laghantering i ett och samma gränssnitt.
          </p>
        </div>

        {/* Mockup container */}
        <div className="relative mx-auto max-w-4xl">
          {/* Glow behind mockup */}
          <div className="absolute inset-x-10 top-10 bottom-0 bg-sky-500/5 blur-3xl rounded-full pointer-events-none" />

          {/* Browser chrome mockup */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 bg-[#111827]">
            {/* Browser top bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#1e293b] border-b border-white/8">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-[#0f172a] rounded-md px-3 py-1 text-xs text-slate-500 font-mono text-center max-w-xs mx-auto">
                  app.sportiq.se
                </div>
              </div>
            </div>

            {/* Dashboard content */}
            <div className="p-5 space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Träningspass", value: "36", accent: "text-sky-400", bg: "bg-sky-500/10", icon: "📋" },
                  { label: "Spelare", value: "14", accent: "text-violet-400", bg: "bg-violet-500/10", icon: "👥" },
                  { label: "Säsongen", value: "68%", accent: "text-emerald-400", bg: "bg-emerald-500/10", icon: "📈" },
                  { label: "Nästa match", value: "Lör", accent: "text-amber-400", bg: "bg-amber-500/10", icon: "🏆" },
                ].map((stat) => (
                  <div key={stat.label} className={`${stat.bg} border border-white/5 rounded-xl p-3`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">{stat.label}</span>
                      <span className="text-sm">{stat.icon}</span>
                    </div>
                    <div className={`text-xl font-bold ${stat.accent}`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Main content row */}
              <div className="grid sm:grid-cols-3 gap-3">
                {/* Training plan */}
                <div className="sm:col-span-2 bg-[#1e293b] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-slate-200">Träningsplan — Vecka 12</span>
                    <span className="text-xs bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full">Pass 22 / 36</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "Uppvärmning & rörlighet", time: "10 min", done: true },
                      { name: "Dribblingövning — slalom", time: "15 min", done: true },
                      { name: "2v2 passningsspel", time: "15 min", done: false },
                      { name: "Avslutning & skott", time: "20 min", done: false },
                    ].map((item) => (
                      <div key={item.name} className="flex items-center gap-3 text-xs">
                        <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                          item.done
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-600"
                        }`}>
                          {item.done && (
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={item.done ? "text-slate-500 line-through" : "text-slate-300"}>{item.name}</span>
                        <span className="ml-auto text-slate-600">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calendar mini */}
                <div className="bg-[#1e293b] border border-white/5 rounded-xl p-4">
                  <div className="text-sm font-semibold text-slate-200 mb-3">Kalender</div>
                  <div className="grid grid-cols-7 gap-0.5 text-center mb-2">
                    {["M","T","O","T","F","L","S"].map((d) => (
                      <div key={d} className="text-[10px] text-slate-600 font-medium py-0.5">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 text-center">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <div
                        key={d}
                        className={`text-[10px] py-1 rounded-md ${
                          d === 15
                            ? "bg-sky-500 text-white font-bold"
                            : d === 8 || d === 22
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom row */}
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { name: "Taktiktavla", icon: "♟", desc: "Rita upp spelsystem live", color: "text-violet-400" },
                  { name: "Statistik", icon: "📊", desc: "Följ spelarutveckling", color: "text-sky-400" },
                  { name: "Videor", icon: "🎬", desc: "Dela klipp med laget", color: "text-emerald-400" },
                ].map((tool) => (
                  <div key={tool.name} className="bg-[#1e293b] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xl">{tool.icon}</span>
                    <div>
                      <div className={`text-sm font-semibold ${tool.color}`}>{tool.name}</div>
                      <div className="text-xs text-slate-500">{tool.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sports grid ── */}
      <div>
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-4 tracking-widest uppercase">
            ✦ Tillgängliga sporter
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Välj din sport</h2>
          <p className="text-slate-400 text-sm">
            Varje sport har kompletta träningsplaner för tre åldersgrupper (upp till 9 år).
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SPORTS.map((sport) => {
            const c = colorMap[sport.color];
            return (
              <Link
                key={sport.id}
                href={`/${sport.id}`}
                className={`group block bg-[#111827] rounded-2xl border ${c.border} p-6 card-hover transition-all duration-200`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-2xl ${c.iconBg} flex items-center justify-center text-2xl`}>
                    {sport.emoji}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{sport.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.tagBg}`}>
                      3 årsplaner
                    </span>
                  </div>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed mb-5">
                  {sport.description}
                </p>

                <div className={`text-sm font-semibold flex items-center gap-1 ${c.linkColor} transition-colors`}>
                  Se träningsplaner
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── How it works ── */}
      <div>
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-4 tracking-widest uppercase">
            ✦ Kom igång
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Hur fungerar det?</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Plattformen är byggd för föreningar och coacher som vill ha strukturerade träningsplaner.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`relative bg-[#111827] border ${f.glow} rounded-2xl p-6 overflow-hidden`}
            >
              {/* Step number */}
              <div className="absolute top-4 right-4 text-4xl font-black text-white/3 select-none">
                {i + 1}
              </div>

              <div className={`w-11 h-11 rounded-xl ${f.glow} border flex items-center justify-center mb-4 ${f.accent}`}>
                {f.icon}
              </div>

              <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="relative rounded-2xl overflow-hidden p-10 text-center bg-[#111827] border border-white/8">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-sky-500/8 blur-3xl rounded-full pointer-events-none" />
        <div className="relative">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Kom igång idag
          </h2>
          <p className="text-slate-400 text-sm mb-8 max-w-sm mx-auto">
            Registrera din förening gratis och välj en sport att komma igång med.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/registrera"
              className="px-7 py-3 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-sky-500/30 hover:shadow-sky-400/40 hover:-translate-y-0.5"
            >
              Registrera förening →
            </Link>
            <Link
              href="/login"
              className="px-7 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 font-semibold text-sm rounded-xl transition-all duration-200"
            >
              Logga in
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
