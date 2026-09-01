import { useEffect, useState } from 'react'
import { Flame, MessageSquare, Plus } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { useProfileStore } from '../store/useProfileStore'
import { useNutrientTotals } from '../hooks/useNutrientTotals'
import { fmt, todayIso } from '../lib/formatters'

interface Props {
  onNavigate?: (tab: string) => void
}

function CalorieRing({ intake, target }: { intake: number; target: number }) {
  const pct = target > 0 ? Math.min(intake / target, 1) : 0
  const r = 54
  const circ = 2 * Math.PI * r
  const over = intake > target
  const color = over ? '#f59e0b' : '#10b981'
  return (
    <div className="relative w-[140px] h-[140px]">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#1f2937" strokeWidth="11" />
        <circle
          cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-100">{fmt(intake, 0)}</span>
        <span className="text-xs text-gray-500">/ {fmt(target, 0)} kcal</span>
      </div>
    </div>
  )
}

function MacroBar({ label, intake, target, color }: { label: string; intake: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((intake / target) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500">{fmt(intake, 0)} / {fmt(target, 0)}g</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function DashboardPage({ onNavigate }: Props) {
  const { nutrientTotals, date, loadDay } = usePlanStore()
  const { macroTargets } = useProfileStore()
  const nutrients = useNutrientTotals()
  const [burned, setBurned] = useState(0)
  const today = todayIso()

  useEffect(() => {
    window.api.exerciseCaloriesForDate({ date: today }).then(r => setBurned(r.calories))
  }, [])

  // The dashboard is "today" focused — make sure today's plan is loaded.
  useEffect(() => {
    if (date !== todayIso()) loadDay(todayIso())
  }, [])

  const totalsMap = new Map(nutrientTotals.map(n => [n.nutrientId, n.intake]))
  const intakeCal = totalsMap.get(1008) ?? 0
  const proteinIn = totalsMap.get(1003) ?? 0
  const carbsIn = totalsMap.get(1005) ?? 0
  const fatIn = totalsMap.get(1004) ?? 0

  // Top nutrient gaps: lowest % of RDI, excluding the macros/calories shown above.
  const MACRO_IDS = new Set([1008, 1003, 1004, 1005])
  const topGaps = [...nutrients]
    .filter(n => !MACRO_IDS.has(n.nutrientId) && n.displayPercent < 100)
    .sort((a, b) => a.displayPercent - b.displayPercent)
    .slice(0, 4)

  const remaining = macroTargets ? macroTargets.calories + burned - intakeCal : 0

  return (
    <div className="h-full overflow-y-auto px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500">Today's overview</p>
      </div>

      {!macroTargets ? (
        <p className="text-sm text-gray-500">Set up your profile in Settings to see your targets.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Calories */}
          <div className="bg-gray-900 rounded-xl p-5 flex items-center gap-5">
            <CalorieRing intake={intakeCal} target={macroTargets.calories} />
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Remaining</div>
              <div className={`text-2xl font-bold ${remaining < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {fmt(Math.abs(remaining), 0)}
              </div>
              <div className="text-xs text-gray-500">{remaining < 0 ? 'over target' : 'kcal left'}</div>
              {burned > 0 && (
                <div className="text-xs text-orange-400/90 flex items-center gap-1">
                  <Flame size={11} /> +{fmt(burned, 0)} from exercise
                </div>
              )}
            </div>
          </div>

          {/* Macros */}
          <div className="bg-gray-900 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-medium text-gray-400">Macros</h2>
            <MacroBar label="Protein" intake={proteinIn} target={macroTargets.proteinG} color="#34d399" />
            <MacroBar label="Carbs" intake={carbsIn} target={macroTargets.carbsG} color="#60a5fa" />
            <MacroBar label="Fat" intake={fatIn} target={macroTargets.fatG} color="#fbbf24" />
          </div>

          {/* Top gaps */}
          <div className="bg-gray-900 rounded-xl p-5 space-y-3 md:col-span-2">
            <h2 className="text-sm font-medium text-gray-400">Biggest nutrient gaps today</h2>
            {topGaps.length === 0 ? (
              <p className="text-xs text-gray-500">Log some foods to see where you stand.</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {topGaps.map(n => (
                  <div key={n.nutrientId}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{n.name}</span>
                      <span className="text-gray-500">{fmt(n.displayPercent, 0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500/80 rounded-full" style={{ width: `${Math.min(n.displayPercent, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3 mt-5">
        <button
          onClick={() => onNavigate?.('add')}
          className="flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Log food
        </button>
        <button
          onClick={() => onNavigate?.('chat')}
          className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg transition-colors"
        >
          <MessageSquare size={15} /> Ask the AI coach
        </button>
      </div>
    </div>
  )
}
