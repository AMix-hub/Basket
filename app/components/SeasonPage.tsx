import Link from "next/link";
import type { SeasonPlan } from "../data/types";

interface Props {
  plan: SeasonPlan;
}

export default function SeasonPage({ plan }: Props) {
  return (
    <div>
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
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
          Träningsplanering – {plan.ageGroup}
        </h1>
        <p className="text-slate-500 max-w-2xl leading-relaxed">{plan.description}</p>
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
        {plan.sessions.map((session) => (
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
                {session.activities.length} övningar
              </span>
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
              {session.activities.map((activity, idx) => (
                <div key={idx} className="px-5 py-4">
                  <p className="font-semibold text-slate-800 mb-1 text-sm">
                    {activity.name}
                  </p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {activity.description}
                  </p>
                  {activity.tips && (
                    <p className="mt-2.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                      💡 {activity.tips}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
