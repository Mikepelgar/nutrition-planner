import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, X } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { useProfileStore } from '../store/useProfileStore'
import { useNutrientTotals } from '../hooks/useNutrientTotals'
import { FoodSearch } from '../components/food/FoodSearch'
import { RecentFoods, type FoodHistoryMode } from '../components/food/RecentFoods'
import { PlanEntryRow } from '../components/plan/PlanEntry'
import { NutrientPanel } from '../components/nutrients/NutrientPanel'
import { Skeleton } from '../components/ui/Skeleton'
import { fmt, fmtDate, shiftDate, todayIso } from '../lib/formatters'

type FoodTab = 'search' | FoodHistoryMode

const FOOD_TABS: { id: FoodTab; label: string }[] = [
  { id: 'search',    label: 'Search'  },
  { id: 'history',   label: 'History' },
  { id: 'favorites', label: '★ Faves' },
]

export function DashboardPage() {
  const { date, entries, loading, loadDay, nutrientTotals, copyFrom } = usePlanStore()
  const { macroTargets } = useProfileStore()
  const nutrients = useNutrientTotals()
  const [foodTab, setFoodTab] = useState<FoodTab>('search')
  const [burned, setBurned] = useState(0)
  const [showCopy, setShowCopy] = useState(false)

  useEffect(() => { loadDay(date) }, [date])
  useEffect(() => { window.api.exerciseCaloriesForDate({ date }).then(r => setBurned(r.calories)) }, [date])

  const totalCal = nutrientTotals.find(n => n.nutrientId === 1008)?.intake ?? 0

  const isToday = date === todayIso()
  const dateInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex h-full gap-0">
      {/* Left panel: food log */}
      <div className="flex flex-col w-[420px] shrink-0 border-r border-gray-800">

        {/* Date navigator */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <button
            onClick={() => loadDay(shiftDate(date, -1))}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="text-center relative">
            <button
              onClick={() => dateInputRef.current?.showPicker()}
              className="text-sm font-semibold text-gray-200 hover:text-emerald-400 transition-colors"
              title="Click to pick a date"
            >
              {fmtDate(date)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={e => e.target.value && loadDay(e.target.value)}
              className="absolute inset-0 opacity-0 w-full pointer-events-none"
              tabIndex={-1}
            />
            {!isToday && (
              <button
                onClick={() => loadDay(todayIso())}
                className="block text-xs text-emerald-500 hover:text-emerald-400 mx-auto"
              >
                Back to today
              </button>
            )}
          </div>

          <button
            onClick={() => loadDay(shiftDate(date, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Copy a previous day's foods into this day — collapsed by default */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-800 text-xs">
          {!showCopy ? (
            <button
              onClick={() => setShowCopy(true)}
              className="flex items-center gap-1.5 text-gray-500 hover:text-emerald-400 transition-colors"
              aria-expanded={false}
            >
              <Copy size={12} /> Copy from another day…
            </button>
          ) : (
            <>
              <button
                onClick={() => copyFrom(shiftDate(date, -1))}
                className="flex items-center gap-1.5 text-gray-500 hover:text-emerald-400 transition-colors"
                title="Copy the previous day's foods into this day"
              >
                <Copy size={12} /> Copy previous day
              </button>
              <span className="text-gray-700">·</span>
              <label className="text-gray-500 flex items-center gap-1">
                from
                <input
                  type="date"
                  onChange={e => e.target.value && copyFrom(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-emerald-500"
                />
              </label>
              <button
                onClick={() => setShowCopy(false)}
                className="ml-auto text-gray-500 hover:text-gray-300"
                aria-label="Hide copy controls"
              >
                <X size={12} />
              </button>
            </>
          )}
        </div>

        {/* Calorie summary (target includes calories burned via exercise) */}
        {macroTargets && (() => {
          const budget = macroTargets.calories + burned
          return (
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gray-500">Calories{burned > 0 ? ' (incl. exercise)' : ''}</span>
                <span className="text-xs text-gray-400">
                  {fmt(totalCal, 0)} / {fmt(budget, 0)} kcal
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    totalCal > budget ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min((totalCal / budget) * 100, 100)}%` }}
                />
              </div>
            </div>
          )
        })()}

        {/* Food sub-tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800">
          {FOOD_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setFoodTab(t.id)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                foodTab === t.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search tab */}
        {foodTab === 'search' && (
          <div className="px-4 py-3 border-b border-gray-800 relative z-10">
            <FoodSearch />
          </div>
        )}

        {/* History / Faves tabs */}
        {(foodTab === 'history' || foodTab === 'favorites') && (
          <div className="border-b border-gray-800">
            <RecentFoods mode={foodTab} />
          </div>
        )}

        {/* Food list — logged entries for this day */}
        <div className="flex-1 overflow-y-auto">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800">
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-6" />
            </div>
          ))}
          {!loading && entries.length === 0 && (
            <p className="text-sm text-gray-500 px-4 py-6 text-center">
              No foods added yet.{' '}
              {foodTab === 'search' ? 'Search above to get started.' : 'Tap + on a food above.'}
            </p>
          )}
          {!loading && entries.length > 0 && (
            <div>
              <div className="flex justify-between items-center px-4 py-1.5 bg-gray-900/60 border-b border-gray-800/60">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Logged</span>
                <span className="text-xs text-gray-500">{fmt(totalCal, 0)} kcal</span>
              </div>
              {entries.map(entry => <PlanEntryRow key={entry.id} entry={entry} />)}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: nutrient bars */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        <h2 className="text-sm font-semibold text-gray-400 mb-3 px-1">Nutrient Targets</h2>
        {nutrients.length === 0 ? (
          <p className="text-sm text-gray-500 px-1 py-4 text-center">Add foods to see your nutrient progress.</p>
        ) : (
          <NutrientPanel nutrients={nutrients} />
        )}
      </div>
    </div>
  )
}
