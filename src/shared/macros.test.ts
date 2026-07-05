import { describe, it, expect } from 'vitest'
import { calcBMR, calcTDEE, calcMacroTargets } from './macros'
import type { UserProfile } from '../renderer/src/lib/types'

// Base: 30yo male, 80kg, 180cm, moderately active. BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780.
const base: UserProfile = {
  age: 30,
  sex: 'male',
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'moderately_active',
  goal: 'maintain',
  dietType: 'balanced'
}
const p = (o: Partial<UserProfile>): UserProfile => ({ ...base, ...o })

describe('BMR / TDEE', () => {
  it('Mifflin-St Jeor for male', () => expect(calcBMR(base)).toBe(1780))
  it('female is 166 kcal lower than male', () =>
    expect(calcBMR(p({ sex: 'female' }))).toBe(1780 - 166))
  it('TDEE applies the activity multiplier (1.55)', () => expect(calcTDEE(base)).toBe(Math.round(1780 * 1.55)))
})

describe('goal calories', () => {
  const tdee = calcTDEE(base) // 2759
  it('maintain = TDEE', () => expect(calcMacroTargets(p({ goal: 'maintain' })).calories).toBe(tdee))
  it('recomp = TDEE', () => expect(calcMacroTargets(p({ goal: 'recomp' })).calories).toBe(tdee))
  it('cut uses default 500 deficit', () =>
    expect(calcMacroTargets(p({ goal: 'cut' })).calories).toBe(tdee - 500))
  it('cut honors a custom goalKcal (fixes the old bug)', () =>
    expect(calcMacroTargets(p({ goal: 'cut', goalKcal: 700 })).calories).toBe(tdee - 700))
  it('bulk uses default 300 surplus', () =>
    expect(calcMacroTargets(p({ goal: 'bulk' })).calories).toBe(tdee + 300))
  it('bulk honors a custom goalKcal', () =>
    expect(calcMacroTargets(p({ goal: 'bulk', goalKcal: 500 })).calories).toBe(tdee + 500))
})

describe('protein by goal', () => {
  it('maintain → 1.6 g/kg', () => expect(calcMacroTargets(p({ goal: 'maintain' })).proteinG).toBe(128))
  it('bulk → 2.0 g/kg', () => expect(calcMacroTargets(p({ goal: 'bulk' })).proteinG).toBe(160))
  it('cut → 2.2 g/kg', () => expect(calcMacroTargets(p({ goal: 'cut' })).proteinG).toBe(176))
})

describe('diet-aware macro splits', () => {
  it('keto caps carbs at ~25g', () =>
    expect(calcMacroTargets(p({ dietType: 'keto' })).carbsG).toBe(25))
  it('high-protein raises protein to 2.4 g/kg', () =>
    expect(calcMacroTargets(p({ dietType: 'high_protein' })).proteinG).toBe(Math.round(80 * 2.4)))
  it('low-fat lowers fat vs balanced', () => {
    const balanced = calcMacroTargets(p({ dietType: 'balanced' }))
    const lowFat = calcMacroTargets(p({ dietType: 'low_fat' }))
    expect(lowFat.fatG).toBeLessThan(balanced.fatG)
  })
  it('macros are non-negative for every diet', () => {
    for (const diet of ['balanced', 'keto', 'low_carb', 'high_protein', 'low_fat'] as const) {
      const m = calcMacroTargets(p({ dietType: diet }))
      expect(m.proteinG).toBeGreaterThanOrEqual(0)
      expect(m.carbsG).toBeGreaterThanOrEqual(0)
      expect(m.fatG).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('custom targets override', () => {
  it('returns manual values verbatim when fully set', () => {
    const m = calcMacroTargets(
      p({ useCustomTargets: true, customCalories: 2000, customProteinG: 180, customCarbsG: 150, customFatG: 60 })
    )
    expect(m).toEqual({ calories: 2000, proteinG: 180, carbsG: 150, fatG: 60 })
  })
  it('falls back to the formula when custom values are incomplete', () => {
    const m = calcMacroTargets(p({ useCustomTargets: true, customCalories: 2000 }))
    expect(m.calories).toBe(calcTDEE(base))
  })
})
