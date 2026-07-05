import { useEffect, useState } from 'react'
import { Flame, MessageSquare, Plus, Droplet } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { useProfileStore } from '../store/useProfileStore'
import { useNutrientTotals } from '../hooks/useNutrientTotals'
import { fmt, todayIso } from '../lib/formatters'
import type { WeightEntry } from '../lib/types'
import { kgToDisplay, displayToKg, weightUnitLabel, mlToDisplay, volumeUnitLabel, round } from '../lib/units'

const WATER_GOAL_ML = 2500

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

export function HomePage({ onNavigate }: Props) {
  const { entries, nutrientTotals, foodCache, date, loadDay } = usePlanStore()
  const { macroTargets, profile } = useProfileStore()
  const nutrients = useNutrientTotals()
  const [streak, setStreak] = useState(0)
  const [waterMl, setWaterMl] = useState(0)
  const [weight, setWeight] = useState<WeightEntry | null>(null)
  const [weightInput, setWeightInput] = useState('')
  const [burned, setBurned] = useState(0)
  const today = todayIso()
  const unit = profile?.unitSystem ?? 'metric'

  // Load today's water, latest weight, and calories burned on mount.
  useEffect(() => {
    window.api.waterGet({ date: today }).then(r => setWaterMl(r.ml))
    window.api.weightLatest().then(setWeight)
    window.api.exerciseCaloriesForDate({ date: today }).then(r => setBurned(r.calories))
  }, [])

  function changeWater(delta: number) {
    window.api.waterAdd({ date: today, deltaMl: delta }).then(r => setWaterMl(r.ml))
  }

  function logWeight() {
    const w = parseFloat(weightInput)
    if (!w) return
    const kg = displayToKg(w, unit)
    window.api.weightSet({ date: today, weightKg: kg }).then(() => {
      setWeight({ date: today, weightKg: kg })
      setWeightInput('')
    })
  }

  // The dashboard is "today" focused — make sure today's plan is loaded.
  useEffect(() => {
    if (date !== todayIso()) loadDay(todayIso())
  }, [])

  // Logging streak: consecutive days (ending today) that have at least one entry.
  useEffect(() => {
    const end = todayIso()
    const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    window.api.logGetDailyLogs({ startDate: start, endDate: end }).then(logs => {
      const logged = new Set(logs.filter(l => l.entryCount > 0).map(l => l.date))
      let count = 0
      const d = new Date()
      // Allow the streak to "hold" if today isn't logged yet but yesterday was.
      if (!logged.has(end)) d.setDate(d.getDate() - 1)
      for (;;) {
        const iso = d.toISOString().slice(0, 10)
        if (!logged.has(iso)) break
        count++
        d.setDate(d.getDate() - 1)
      }
      setStreak(count)
    })
  }, [entries.length])

  const totalsMap = new Map(nutrientTotals.map(n => [n.nutrientId, n.intake]))
  const intakeCal = entries.reduce((sum, e) => {
    const cal = foodCache.get(e.fdcId)?.nutrients.find(n => n.nutrientId === 1008)?.amount ?? 0
    return sum + (e.grams / 100) * cal
  }, 0)
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500">Today's overview</p>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400 bg-amber-950/40 px-3 py-1.5 rounded-full">
          <Flame size={15} />
          <span className="text-sm font-semibold">{streak}</span>
          <span className="text-xs text-amber-500/80">day{streak === 1 ? '' : 's'}</span>
        </div>
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

          {/* Water */}
          <div className="bg-gray-900 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                <Droplet size={14} className="text-sky-400" /> Water
              </h2>
              <span className="text-xs text-gray-500">
                {unit === 'imperial' ? round(mlToDisplay(waterMl, unit)) : waterMl} / {unit === 'imperial' ? round(mlToDisplay(WATER_GOAL_ML, unit)) : WATER_GOAL_ML} {volumeUnitLabel(unit)}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((waterMl / WATER_GOAL_ML) * 100, 100)}%` }} />
            </div>
            <div className="flex gap-2">
              {unit === 'imperial' ? (
                <>
                  <button onClick={() => changeWater(237)} className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-2.5 py-1 rounded-md transition-colors">+8 oz</button>
                  <button onClick={() => changeWater(473)} className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-2.5 py-1 rounded-md transition-colors">+16 oz</button>
                  <button onClick={() => changeWater(-237)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded-md transition-colors ml-auto">−8 oz</button>
                </>
              ) : (
                <>
                  <button onClick={() => changeWater(250)} className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-2.5 py-1 rounded-md transition-colors">+250 ml</button>
                  <button onClick={() => changeWater(500)} className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-2.5 py-1 rounded-md transition-colors">+500 ml</button>
                  <button onClick={() => changeWater(-250)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded-md transition-colors ml-auto">−250</button>
                </>
              )}
            </div>
          </div>

          {/* Weight */}
          <div className="bg-gray-900 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-400">Weight</h2>
              {weight && <span className="text-xs text-gray-500">latest {fmt(kgToDisplay(weight.weightKg, unit), 1)} {weightUnitLabel(unit)}</span>}
            </div>
            {profile?.goalWeightKg != null && weight && (
              <p className="text-xs text-gray-500">
                Goal {fmt(kgToDisplay(profile.goalWeightKg, unit), 1)} {weightUnitLabel(unit)} · {fmt(kgToDisplay(Math.abs(weight.weightKg - profile.goalWeightKg), unit), 1)} {weightUnitLabel(unit)} to go
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="number" step="0.1" placeholder={`Log today's weight (${weightUnitLabel(unit)})`}
                value={weightInput} onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') logWeight() }}
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
              />
              <button onClick={logWeight} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 rounded-lg transition-colors">Log</button>
            </div>
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
