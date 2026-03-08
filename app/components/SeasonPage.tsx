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
          Säsongsplan – {plan.ageGroup}
        </h1>
        <p className="text-gray-600 max-w-2xl">{plan.description}</p>
      </div>

      {/* Goals */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mb-8">
        <h2 className="text-lg font-bold text-orange-800 mb-3">
          🎯 Säsongens mål
        </h2>
        <ul className="space-y-1">
          {plan.goals.map((goal, i) => (
            <li key={i} className="flex items-start gap-2 text-orange-900">
              <span className="text-orange-500 mt-0.5">✓</span>
              <span>{goal}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Monthly training plan */}
      <div className="space-y-8">
        {plan.months.map((month) => (
          <div key={month.month} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Month header */}
            <div className="bg-gray-800 text-white px-5 py-3">
              <h2 className="text-lg font-bold">{month.month}</h2>
              <p className="text-gray-300 text-sm">{month.focus}</p>
            </div>

            {/* Practices */}
            <div className="divide-y divide-gray-100">
              {month.practices.map((practice) => (
                <div key={practice.session} className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="bg-orange-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                      Pass {practice.session}
                    </span>
                    <h3 className="font-semibold text-gray-800">{practice.theme}</h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-green-700 mb-1">🟢 Uppvärmning</p>
                      <p className="text-gray-600">{practice.warmup}</p>
                    </div>

                    <div>
                      <p className="font-medium text-blue-700 mb-1">🔵 Övningar</p>
                      <ul className="text-gray-600 space-y-1 list-disc list-inside">
                        {practice.drills.map((drill, i) => (
                          <li key={i}>{drill}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-medium text-purple-700 mb-1">🟣 Spel</p>
                      <p className="text-gray-600">{practice.game}</p>
                    </div>

                    <div>
                      <p className="font-medium text-orange-700 mb-1">🟠 Nedvarvning</p>
                      <p className="text-gray-600">{practice.cooldown}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
