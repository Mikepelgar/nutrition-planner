import { describe, it, expect } from 'vitest'
import { computeStreak, projectTimeToGoal, computeAchievements } from './progress'
import type { WeightEntry } from '../renderer/src/lib/types'

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    const set = new Set(['2026-06-10', '2026-06-09', '2026-06-08'])
    expect(computeStreak(set, '2026-06-10')).toBe(3)
  })
  it('holds if today not logged but yesterday is', () => {
    const set = new Set(['2026-06-09', '2026-06-08'])
    expect(computeStreak(set, '2026-06-10')).toBe(2)
  })
  it('breaks on a gap', () => {
    const set = new Set(['2026-06-10', '2026-06-08'])
    expect(computeStreak(set, '2026-06-10')).toBe(1)
  })
  it('zero when nothing logged', () => {
    expect(computeStreak(new Set(), '2026-06-10')).toBe(0)
  })
})

describe('projectTimeToGoal', () => {
  const w = (date: string, weightKg: number): WeightEntry => ({ date, weightKg })
  it('returns null without a goal or enough data', () => {
    expect(projectTimeToGoal([w('2026-06-01', 80)], 75)).toBeNull()
    expect(projectTimeToGoal([w('2026-06-01', 80), w('2026-06-08', 79)], undefined)).toBeNull()
  })
  it('projects ETA when trending toward the goal', () => {
    // Latest weight 79, goal 78, losing 1kg/week ⇒ ~7 days from the latest weigh-in.
    const p = projectTimeToGoal([w('2026-06-01', 80), w('2026-06-08', 79)], 78)!
    expect(p.ratePerWeek).toBeCloseTo(-1, 1)
    expect(p.etaDays).toBeGreaterThan(4)
    expect(p.etaDays).toBeLessThan(11)
  })
  it('no ETA when trending away from the goal', () => {
    // gaining, but goal is below ⇒ never reaches
    const p = projectTimeToGoal([w('2026-06-01', 80), w('2026-06-08', 81)], 75)!
    expect(p.etaDays).toBeNull()
  })
})

describe('computeAchievements', () => {
  it('earns based on thresholds', () => {
    const a = computeAchievements({ foodsLogged: 100, weighIns: 3, streak: 8, daysOnTarget: 1 })
    const earned = new Set(a.filter((x) => x.earned).map((x) => x.id))
    expect(earned.has('first_food')).toBe(true)
    expect(earned.has('foods_100')).toBe(true)
    expect(earned.has('streak_7')).toBe(true)
    expect(earned.has('streak_30')).toBe(false)
    expect(earned.has('weighins_10')).toBe(false)
  })
})
