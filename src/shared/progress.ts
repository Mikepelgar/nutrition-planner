import type { WeightEntry } from '../renderer/src/lib/types'

export interface GoalProjection {
  ratePerWeek: number // kg/week (negative = losing)
  etaDays: number | null // days to reach goal, only if trending toward it
  reached: boolean
}

/** Linear-regression projection of when the goal weight will be reached. */
export function projectTimeToGoal(weights: WeightEntry[], goalWeightKg: number | undefined): GoalProjection | null {
  if (goalWeightKg == null || weights.length < 2) return null
  const pts = weights.map((w) => ({ t: Date.parse(w.date + 'T00:00:00') / 86_400_000, y: w.weightKg }))
  const n = pts.length
  const meanT = pts.reduce((s, p) => s + p.t, 0) / n
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of pts) {
    num += (p.t - meanT) * (p.y - meanY)
    den += (p.t - meanT) ** 2
  }
  const slopePerDay = den === 0 ? 0 : num / den
  const current = pts[n - 1].y
  const reached = Math.abs(current - goalWeightKg) < 0.1
  let etaDays: number | null = null
  if (!reached && slopePerDay !== 0) {
    const days = (goalWeightKg - current) / slopePerDay
    // Only meaningful when the trend actually moves toward the goal.
    etaDays = days > 0 && days < 3650 ? Math.round(days) : null
  }
  return { ratePerWeek: slopePerDay * 7, etaDays, reached }
}

export interface Achievement {
  id: string
  label: string
  earned: boolean
}

export function computeAchievements(stats: {
  foodsLogged: number
  weighIns: number
  daysOnTarget: number
}): Achievement[] {
  return [
    { id: 'first_food', label: 'Logged your first food', earned: stats.foodsLogged >= 1 },
    { id: 'foods_100', label: 'Logged 100 foods', earned: stats.foodsLogged >= 100 },
    { id: 'weighins_10', label: '10 weigh-ins recorded', earned: stats.weighIns >= 10 },
    { id: 'ontarget_5', label: '5 days within calorie target', earned: stats.daysOnTarget >= 5 }
  ]
}
