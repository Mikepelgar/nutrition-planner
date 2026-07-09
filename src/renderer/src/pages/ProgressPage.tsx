import { useMemo, useState } from 'react'
import { Sparkles, Trophy, Target, Medal, Lock } from 'lucide-react'
import { useProfileStore } from '../store/useProfileStore'
import { useRangeData } from '../hooks/useRangeData'
import { useAiStream } from '../hooks/useAiStream'
import { LineChart } from '../components/charts/LineChart'
import { BarChart } from '../components/charts/BarChart'
import { projectTimeToGoal, computeAchievements } from '../../../shared/progress'
import { kgToDisplay, weightUnitLabel, WATER_GOAL_ML } from '../lib/units'
import { fmt, todayIso } from '../lib/formatters'
import { Button } from '../components/ui/Button'
import { Pill } from '../components/ui/Pill'

const mmdd = (iso: string): string => iso.slice(5).replace('-', '/')
const RANGES = [
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '1y' }
]

export function ProgressPage() {
  const { profile, macroTargets } = useProfileStore()
  const [days, setDays] = useState(90)
  const { logs, weights, waters } = useRangeData(days)
  const unit = profile?.unitSystem ?? 'metric'
  const review = useAiStream()

  const asc = useMemo(() => [...logs].sort((a, b) => a.date.localeCompare(b.date)), [logs])

  const weightLine = weights.map((w) => ({ label: mmdd(w.date), value: kgToDisplay(w.weightKg, unit) }))
  const calorieBars = asc.map((l) => ({
    label: mmdd(l.date),
    value: l.calories,
    color: macroTargets && l.calories > macroTargets.calories ? '#f59e0b' : '#34d399'
  }))
  const proteinLine = asc.map((l) => ({ label: mmdd(l.date), value: l.proteinG }))
  const waterBars = waters.map((w) => ({ label: mmdd(w.date), value: w.ml }))

  // Goals
  const latest = weights.at(-1)
  const projection = projectTimeToGoal(weights, profile?.goalWeightKg)

  // Achievements (computed over the loaded window)
  const foodsLogged = logs.reduce((s, l) => s + l.entryCount, 0)
  const daysOnTarget = macroTargets
    ? logs.filter((l) => Math.abs(l.calories - macroTargets.calories) <= macroTargets.calories * 0.1).length
    : 0
  const achievements = computeAchievements({ foodsLogged, weighIns: weights.length, daysOnTarget })

  return (
    <div className="h-full overflow-y-auto px-6 py-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-100">Progress</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Pill key={r.days} active={days === r.days} onClick={() => setDays(r.days)}>
              {r.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-400 mb-2">Weight ({weightUnitLabel(unit)})</h2>
          <LineChart data={weightLine} color="#a78bfa" unit={` ${weightUnitLabel(unit)}`} />
        </div>
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-400 mb-2">Calories vs target</h2>
          <BarChart data={calorieBars} target={macroTargets?.calories} />
        </div>
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-400 mb-2">Protein (g)</h2>
          <LineChart data={proteinLine} color="#34d399" target={macroTargets?.proteinG} unit="g" zeroBased />
        </div>
        <div className="bg-gray-900 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-400 mb-2">Water (ml)</h2>
          <BarChart data={waterBars} color="#38bdf8" target={WATER_GOAL_ML} />
        </div>
      </div>

      {/* Goals */}
      <div className="bg-gray-900 rounded-xl p-5 space-y-2">
        <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5"><Target size={14} /> Goal</h2>
        {profile?.goalWeightKg == null ? (
          <p className="text-xs text-gray-500">Set a goal weight in Settings to track progress toward it.</p>
        ) : !latest ? (
          <p className="text-xs text-gray-500">Log your weight to see goal progress.</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">{fmt(kgToDisplay(latest.weightKg, unit), 1)} {weightUnitLabel(unit)}</span>
              <span className="text-gray-500">goal {fmt(kgToDisplay(profile.goalWeightKg, unit), 1)} {weightUnitLabel(unit)}</span>
            </div>
            {projection && (
              <p className="text-xs text-gray-500">
                Trend: {projection.ratePerWeek >= 0 ? '+' : ''}{fmt(kgToDisplay(projection.ratePerWeek, unit), 2)} {weightUnitLabel(unit)}/week ·{' '}
                {projection.reached
                  ? '🎯 goal reached!'
                  : projection.etaDays != null
                    ? `~${projection.etaDays} days to goal at this rate`
                    : 'not trending toward goal yet'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Achievements */}
      <div className="bg-gray-900 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
          <Trophy size={14} /> Achievements
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {achievements.map((a) => (
            <div key={a.id} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs border ${a.earned ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300' : 'bg-gray-800/50 border-gray-800 text-gray-500'}`}>
              {a.earned ? <Medal size={12} className="shrink-0" /> : <Lock size={12} className="shrink-0" />}
              {a.label}
            </div>
          ))}
        </div>
      </div>

      {/* Weekly AI review */}
      <div className="bg-gray-900 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5"><Sparkles size={14} className="text-indigo-400" /> Weekly AI review</h2>
          <Button size="sm" variant="ghost" disabled={review.streaming} onClick={() => review.run((id) => window.api.aiWeeklyReview({ messageId: id, date: todayIso() }))}>
            {review.streaming ? 'Reviewing…' : 'Generate review'}
          </Button>
        </div>
        {review.text
          ? <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{review.text}</p>
          : <p className="text-xs text-gray-500">Get an AI summary of your last 7 days with concrete next steps.</p>}
      </div>
    </div>
  )
}
