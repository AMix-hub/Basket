import type { SeasonPlan } from "../data/types";

interface Props {
  plan: SeasonPlan;
}

export default function SeasonPage({ plan }: Props) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-sm font-semibold px-3 py-1 rounded-full mb-3">
          🏀 År {plan.year}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Träningsplanering – {plan.ageGroup}
        </h1>
        <p className="text-gray-600 max-w-2xl">{plan.description}</p>
      </div>

      {/* Coach tips */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-8">
        <h2 className="text-lg font-bold text-orange-800 mb-3">
          💡 Tips till tränaren
        </h2>
        <ul className="space-y-2">
          {plan.coachTips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-orange-900 text-sm">
              <span className="text-orange-500 mt-0.5 shrink-0">→</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Sessions */}
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Träningspass ({plan.sessions.length} pass)
      </h2>
      <div className="space-y-4">
        {plan.sessions.map((session) => (
          <details
            key={session.number}
            className="border border-gray-200 rounded-xl overflow-hidden shadow-sm group"
          >
            <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer bg-white hover:bg-gray-50 list-none">
              <span className="bg-orange-600 text-white text-xs font-bold px-2 py-0.5 rounded shrink-0">
                Pass {session.number}
              </span>
              <span className="font-medium text-gray-800">{session.title}</span>
              <span className="ml-auto text-gray-400 text-sm shrink-0">
                {session.activities.length} övningar
              </span>
            </summary>

            <div className="divide-y divide-gray-100 bg-gray-50">
              {session.activities.map((activity, idx) => (
                <div key={idx} className="px-5 py-4">
                  <p className="font-semibold text-gray-800 mb-1">
                    {activity.name}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {activity.description}
                  </p>
                  {activity.tips && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
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
