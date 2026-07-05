import { useEffect, useState } from 'react'
import { Sparkles, CalendarRange, ChevronRight } from 'lucide-react'
import { useProfileStore } from '../store/useProfileStore'
import { usePlanStore } from '../store/usePlanStore'
import { useAiStream } from '../hooks/useAiStream'
import { Button } from '../components/ui/Button'
import { fmt, todayIso, shiftDate } from '../lib/formatters'

interface Props {
  onNavigate?: (tab: string) => void
}

const weekday = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })
const dayNum = (iso: string): string => String(new Date(iso + 'T00:00:00').getDate())

export function PlannerPage({ onNavigate }: Props) {
  const { macroTargets } = useProfileStore()
  const { loadDay } = usePlanStore()
  const plan = useAiStream()
  const [byDate, setByDate] = useState<Record<string, { calories: number; entryCount: number }>>({})

  const days = Array.from({ length: 7 }, (_, i) => shiftDate(todayIso(), i))

  useEffect(() => {
    window.api.logGetDailyLogs({ startDate: days[0], endDate: days[6] }).then((logs) => {
      const map: Record<string, { calories: number; entryCount: number }> = {}
      for (const l of logs) map[l.date] = { calories: l.calories, entryCount: l.entryCount }
      setByDate(map)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openDay(date: string) {
    loadDay(date)
    onNavigate?.('add')
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-100 flex items-center gap-2"><CalendarRange size={18} /> Meal Planner</h1>
        <p className="text-sm text-gray-500 mt-0.5">Plan the week ahead and get an AI day-plan tailored to your targets.</p>
      </div>

      {/* Week strip */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const info = byDate[d]
          const target = macroTargets?.calories ?? 0
          const pct = target > 0 && info ? Math.min((info.calories / target) * 100, 100) : 0
          const isToday = d === todayIso()
          return (
            <button
              key={d}
              onClick={() => openDay(d)}
              className={`rounded-xl p-2.5 text-center transition-colors border ${
                isToday ? 'border-emerald-700 bg-emerald-950/30' : 'border-gray-800 bg-gray-900 hover:bg-gray-800'
              }`}
            >
              <div className="text-[10px] uppercase text-gray-500">{weekday(d)}</div>
              <div className="text-sm font-semibold text-gray-200">{dayNum(d)}</div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden my-1.5">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[10px] text-gray-500">{info ? `${fmt(info.calories, 0)}` : '—'}</div>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 flex items-center gap-1">
        Tap a day to log food for it <ChevronRight size={12} />
      </p>

      {/* AI day plan */}
      <div className="bg-gray-900 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-400" /> Plan my day with AI
          </h2>
          <Button size="sm" disabled={plan.streaming} onClick={() => plan.run((id) => window.api.aiPlanDay({ messageId: id, date: todayIso() }))}>
            {plan.streaming ? 'Planning…' : 'Generate a day'}
          </Button>
        </div>
        {plan.text ? (
          <>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{plan.text}</p>
            <p className="text-xs text-gray-500 pt-1 border-t border-gray-800">
              These are suggestions — search for each item on the Add tab to log it (auto-logging isn't supported yet).
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-500">Generates a full day of meals that hits your calorie & macro targets and respects your diet and allergens.</p>
        )}
      </div>
    </div>
  )
}
