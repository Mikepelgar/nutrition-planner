import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useProfileStore } from '../store/useProfileStore'
import { NutrientPanel } from '../components/nutrients/NutrientPanel'
import { Skeleton } from '../components/ui/Skeleton'
import { buildNutrientProgress } from '../lib/nutrientProgress'
import type { NutrientProgressData } from '../lib/types'
import { fmt, localIso, shiftDate, todayIso } from '../lib/formatters'

// ─── types ───────────────────────────────────────────────────────────────────

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface DailyEntry {
  date: string
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  entryCount: number
}

interface NutrientBreak {
  nutrientId: number
  name: string
  unit: string
  dailyAvg: number
}

interface LogItem {
  key: string
  label: string
  startDate: string
  endDate: string
  calories: number      // avg daily
  proteinG: number
  fatG: number
  carbsG: number
  daysLogged: number
  totalDays: number
  entryCount?: number   // daily only
  subItems: SubItem[]
}

interface SubItem {
  key: string
  label: string
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
}

// ─── date helpers ─────────────────────────────────────────────────────────────

function weekMonday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  return localIso(date)
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function fmtShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function avg(vals: number[]) {
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}

// ─── aggregation ──────────────────────────────────────────────────────────────

function buildDailyItems(entries: DailyEntry[]): LogItem[] {
  return entries.map(e => ({
    key: e.date,
    label: fmtDay(e.date),
    startDate: e.date,
    endDate: e.date,
    calories: e.calories,
    proteinG: e.proteinG,
    fatG: e.fatG,
    carbsG: e.carbsG,
    daysLogged: 1,
    totalDays: 1,
    entryCount: e.entryCount,
    subItems: []
  }))
}

function buildWeeklyItems(entries: DailyEntry[]): LogItem[] {
  const weeks = new Map<string, DailyEntry[]>()
  for (const e of entries) {
    const k = weekMonday(e.date)
    if (!weeks.has(k)) weeks.set(k, [])
    weeks.get(k)!.push(e)
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monday, days]) => {
      const sunday = shiftDate(monday, 6)
      days.sort((a, b) => a.date.localeCompare(b.date))
      return {
        key: monday,
        label: `${fmtShort(monday)} – ${fmtShort(sunday)}`,
        startDate: monday,
        endDate: sunday,
        calories: Math.round(avg(days.map(d => d.calories))),
        proteinG: Math.round(avg(days.map(d => d.proteinG)) * 10) / 10,
        fatG: Math.round(avg(days.map(d => d.fatG)) * 10) / 10,
        carbsG: Math.round(avg(days.map(d => d.carbsG)) * 10) / 10,
        daysLogged: days.length,
        totalDays: 7,
        subItems: days.map(d => ({
          key: d.date,
          label: fmtDay(d.date),
          calories: d.calories,
          proteinG: d.proteinG,
          fatG: d.fatG,
          carbsG: d.carbsG
        }))
      }
    })
}

function buildMonthlyItems(entries: DailyEntry[]): LogItem[] {
  const months = new Map<string, DailyEntry[]>()
  for (const e of entries) {
    const k = e.date.slice(0, 7)
    if (!months.has(k)) months.set(k, [])
    months.get(k)!.push(e)
  }
  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, days]) => {
      const [y, m] = key.split('-').map(Number)
      const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const startDate = `${key}-01`
      const endDate = `${key}-${String(daysInMonth(y, m)).padStart(2, '0')}`

      // group days → sub-weeks
      const weeks = new Map<string, DailyEntry[]>()
      for (const d of days) {
        const wk = weekMonday(d.date)
        if (!weeks.has(wk)) weeks.set(wk, [])
        weeks.get(wk)!.push(d)
      }
      const subItems = [...weeks.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monday, wdays]) => ({
          key: monday,
          label: `${fmtShort(monday)} – ${fmtShort(shiftDate(monday, 6))}`,
          calories: Math.round(avg(wdays.map(d => d.calories))),
          proteinG: Math.round(avg(wdays.map(d => d.proteinG)) * 10) / 10,
          fatG: Math.round(avg(wdays.map(d => d.fatG)) * 10) / 10,
          carbsG: Math.round(avg(wdays.map(d => d.carbsG)) * 10) / 10
        }))

      return {
        key,
        label,
        startDate,
        endDate,
        calories: Math.round(avg(days.map(d => d.calories))),
        proteinG: Math.round(avg(days.map(d => d.proteinG)) * 10) / 10,
        fatG: Math.round(avg(days.map(d => d.fatG)) * 10) / 10,
        carbsG: Math.round(avg(days.map(d => d.carbsG)) * 10) / 10,
        daysLogged: days.length,
        totalDays: daysInMonth(y, m),
        subItems
      }
    })
}

function buildYearlyItems(entries: DailyEntry[]): LogItem[] {
  const years = new Map<string, DailyEntry[]>()
  for (const e of entries) {
    const k = e.date.slice(0, 4)
    if (!years.has(k)) years.set(k, [])
    years.get(k)!.push(e)
  }
  return [...years.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, days]) => {
      const isLeap = (Number(year) % 4 === 0 && Number(year) % 100 !== 0) || Number(year) % 400 === 0
      // group by month
      const months = new Map<string, DailyEntry[]>()
      for (const d of days) {
        const mk = d.date.slice(0, 7)
        if (!months.has(mk)) months.set(mk, [])
        months.get(mk)!.push(d)
      }
      const subItems = [...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mk, mdays]) => {
          const [y, m] = mk.split('-').map(Number)
          return {
            key: mk,
            label: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' }),
            calories: Math.round(avg(mdays.map(d => d.calories))),
            proteinG: Math.round(avg(mdays.map(d => d.proteinG)) * 10) / 10,
            fatG: Math.round(avg(mdays.map(d => d.fatG)) * 10) / 10,
            carbsG: Math.round(avg(mdays.map(d => d.carbsG)) * 10) / 10
          }
        })

      return {
        key: year,
        label: year,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        calories: Math.round(avg(days.map(d => d.calories))),
        proteinG: Math.round(avg(days.map(d => d.proteinG)) * 10) / 10,
        fatG: Math.round(avg(days.map(d => d.fatG)) * 10) / 10,
        carbsG: Math.round(avg(days.map(d => d.carbsG)) * 10) / 10,
        daysLogged: days.length,
        totalDays: isLeap ? 366 : 365,
        subItems
      }
    })
}

// ─── sub-item row ─────────────────────────────────────────────────────────────

function SubRow({ item, calTarget }: { item: SubItem; calTarget: number }) {
  const ratio = calTarget > 0 ? item.calories / calTarget : 0
  const pct = Math.min(ratio * 100, 100)
  const color = ratio > 1.1 ? 'bg-amber-500' : ratio >= 0.85 ? 'bg-emerald-500' : 'bg-emerald-700'
  return (
    <div className="flex items-center gap-3 py-2 border-t border-gray-800/60">
      <span className="text-xs text-gray-400 w-36 shrink-0">{item.label}</span>
      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-300 w-20 text-right shrink-0">
        {fmt(item.calories, 0)} kcal
      </span>
      <span className="text-xs text-gray-600 hidden sm:block w-32 shrink-0">
        P:{fmt(item.proteinG, 0)} C:{fmt(item.carbsG, 0)} F:{fmt(item.fatG, 0)}
      </span>
    </div>
  )
}

// ─── main log item card ───────────────────────────────────────────────────────

interface LogItemCardProps {
  item: LogItem
  calTarget: number
  expanded: boolean
  onToggle: () => void
  nutrientData: NutrientProgressData[] | null
  loadingNutrients: boolean
  period: Period
}

function LogItemCard({ item, calTarget, expanded, onToggle, nutrientData, loadingNutrients, period }: LogItemCardProps) {
  const ratio = calTarget > 0 ? item.calories / calTarget : 0
  const pct = Math.min(ratio * 100, 100)
  const color = ratio > 1.1 ? 'bg-amber-500' : ratio >= 0.85 ? 'bg-emerald-500' : 'bg-emerald-700'
  const isMultiDay = period !== 'daily'

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
              : <ChevronRight size={14} className="text-gray-500 shrink-0" />
            }
            <span className="text-sm font-medium text-gray-200">{item.label}</span>
            {isMultiDay && (
              <span className="text-xs text-gray-600">{item.daysLogged}/{item.totalDays} days</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-gray-200">{fmt(item.calories, 0)} kcal</span>
            {isMultiDay && <span className="text-xs text-gray-500 ml-1">avg/day</span>}
          </div>
        </div>

        {/* Calorie bar */}
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
        </div>

        {/* Macro chips */}
        <div className="flex gap-3 text-xs text-gray-500">
          <span>P <span className="text-gray-300">{fmt(item.proteinG, 0)}g</span></span>
          <span>C <span className="text-gray-300">{fmt(item.carbsG, 0)}g</span></span>
          <span>F <span className="text-gray-300">{fmt(item.fatG, 0)}g</span></span>
          {!isMultiDay && item.entryCount != null && (
            <span className="ml-auto text-gray-500">{item.entryCount} {item.entryCount === 1 ? 'item' : 'items'}</span>
          )}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4">

          {/* Sub-items */}
          {item.subItems.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 pt-1">
                {period === 'weekly' ? 'Days' : period === 'monthly' ? 'Weeks' : 'Months'}
              </p>
              {item.subItems.map(sub => (
                <SubRow key={sub.key} item={sub} calTarget={calTarget} />
              ))}
            </div>
          )}

          {/* Nutrient breakdown */}
          <div className="border-t border-gray-800 pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              {isMultiDay ? 'Avg daily nutrients' : 'Nutrients'}
            </p>
            {loadingNutrients ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : nutrientData && nutrientData.length > 0 ? (
              <NutrientPanel nutrients={nutrientData} />
            ) : (
              <p className="text-xs text-gray-500">No nutrient data available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

const PERIODS: { id: Period; label: string }[] = [
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly',  label: 'Yearly' },
]

export function LogPage() {
  const { macroTargets, profile } = useProfileStore()
  const [period, setPeriod] = useState<Period>('daily')
  const [logs, setLogs] = useState<DailyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [nutrientCache, setNutrientCache] = useState<Map<string, NutrientProgressData[]>>(new Map())
  // Key currently being fetched — per-item so rapidly expanding two rows can't
  // show the wrong row as loading.
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const calTarget = macroTargets?.calories ?? 2000

  // Load daily log data whenever period changes
  useEffect(() => {
    setLoading(true)
    setExpandedKey(null)
    const today = todayIso()
    const startDate =
      period === 'daily'   ? shiftDate(today, -89)  :
      period === 'weekly'  ? shiftDate(today, -363) :
      period === 'monthly' ? shiftDate(today, -729) :
      '2000-01-01'

    window.api.logGetDailyLogs({ startDate, endDate: today })
      .then(data => setLogs(data as DailyEntry[]))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [period])

  // Build period items from daily data
  const items = useMemo<LogItem[]>(() => {
    if (period === 'daily')   return buildDailyItems(logs)
    if (period === 'weekly')  return buildWeeklyItems(logs)
    if (period === 'monthly') return buildMonthlyItems(logs)
    return buildYearlyItems(logs)
  }, [logs, period])

  // Lazy-load nutrient breakdown when a row is expanded
  const handleToggle = useCallback((item: LogItem) => {
    if (expandedKey === item.key) {
      setExpandedKey(null)
      return
    }
    setExpandedKey(item.key)

    if (nutrientCache.has(item.key) || !profile || !macroTargets) return
    setLoadingKey(item.key)

    window.api.logGetNutrientBreakdown({ startDate: item.startDate, endDate: item.endDate })
      .then(breakdown => {
        const intakes = new Map((breakdown as NutrientBreak[]).map(b => [b.nutrientId, b.dailyAvg]))
        const progressData = buildNutrientProgress(intakes, profile, macroTargets)
        setNutrientCache(prev => new Map(prev).set(item.key, progressData))
      })
      .catch(() => { /* row falls back to the "No nutrient data" message */ })
      .finally(() => setLoadingKey(prev => (prev === item.key ? null : prev)))
  }, [expandedKey, nutrientCache, profile, macroTargets])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-4">

        {/* Header + toggler */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-100">History</h1>
          <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  period === p.id ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {macroTargets && (
          <p className="text-xs text-gray-500 mb-3">
            Target: {fmt(calTarget, 0)} kcal/day
            {period !== 'daily' && ' · calories shown as daily average'}
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-xl px-4 py-3 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500">No entries logged yet.</p>
            <p className="text-xs text-gray-500 mt-1">Go to the Add tab to start tracking your food.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <LogItemCard
                key={item.key}
                item={item}
                calTarget={calTarget}
                expanded={expandedKey === item.key}
                onToggle={() => handleToggle(item)}
                nutrientData={nutrientCache.get(item.key) ?? null}
                loadingNutrients={loadingKey === item.key}
                period={period}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
