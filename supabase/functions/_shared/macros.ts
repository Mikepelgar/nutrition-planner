// GENERATED — do not edit. Source of truth is src/shared/ (and lib/types.ts).
// Regenerate with: node scripts/sync-shared.mjs

/**
 * Single source of truth for BMR / TDEE / macro-target math.
 *
 * Pure (no Electron or DOM deps) so it can be imported by BOTH the main process
 * (`src/main/services/tdee.service.ts`, used to brief the AI) and the renderer
 * (`store/useProfileStore.ts`, used for the UI). Previously these diverged — the
 * main copy hardcoded ±300/500 kcal and ignored `goalKcal`, so the AI saw a
 * different calorie target than the UI. This module fixes that and adds
 * diet-aware macro splits.
 */
import type { UserProfile, MacroTargets, Goal, DietType } from './types.ts'

const ACTIVITY_MULTIPLIERS: Record<UserProfile['activityLevel'], number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9
}

export function calcBMR(profile: UserProfile): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age
  return profile.sex === 'male' ? base + 5 : base - 161
}

export function calcTDEE(profile: UserProfile): number {
  return Math.round(calcBMR(profile) * ACTIVITY_MULTIPLIERS[profile.activityLevel])
}

/** Calorie target for the goal, honoring the user's custom surplus/deficit. */
function goalCalories(profile: UserProfile, tdee: number): number {
  switch (profile.goal) {
    case 'bulk':
      return tdee + (profile.goalKcal ?? 300)
    case 'cut':
      return Math.max(tdee - (profile.goalKcal ?? 500), 1200)
    case 'recomp': // eat at maintenance; recomposition is driven by high protein + training
    case 'maintain':
    default:
      return tdee
  }
}

/** Baseline protein (g per kg bodyweight) for the goal. */
function goalProteinPerKg(goal: Goal): number {
  switch (goal) {
    case 'bulk':
      return 2.0
    case 'cut':
    case 'recomp':
      return 2.2
    case 'maintain':
    default:
      return 1.6
  }
}

/**
 * Per-diet macro-split rules. Resolution order in calcMacroTargets:
 *   carbCapG  → fix carbs low, fat fills the remainder (keto)
 *   carbPct   → carbs from % of kcal, fat fills the remainder (low-carb)
 *   fatPct    → fat from % of kcal, carbs fill the remainder (low-fat)
 *   (none)    → fat 25% of kcal, carbs fill the remainder (balanced)
 * proteinPerKg overrides the goal's baseline protein when present.
 */
interface DietRule {
  proteinPerKg?: number
  fatPct?: number
  carbPct?: number
  carbCapG?: number
}

export const DIET_RULES: Record<DietType, DietRule> = {
  balanced: {},
  keto: { carbCapG: 25 },
  low_carb: { carbPct: 0.2 },
  high_protein: { proteinPerKg: 2.4 },
  low_fat: { fatPct: 0.15 },
  paleo: {},
  mediterranean: {},
  vegetarian: {},
  vegan: {}
}

export function calcMacroTargets(profile: UserProfile): MacroTargets {
  // Manual override: when the user pins their own targets, use them verbatim
  // (the whole app — UI, dashboard, AI — reads this one function).
  if (
    profile.useCustomTargets &&
    profile.customCalories != null && profile.customProteinG != null &&
    profile.customCarbsG != null && profile.customFatG != null
  ) {
    return {
      calories: Math.round(profile.customCalories),
      proteinG: Math.round(profile.customProteinG),
      carbsG: Math.round(profile.customCarbsG),
      fatG: Math.round(profile.customFatG)
    }
  }

  const tdee = calcTDEE(profile)
  const calories = goalCalories(profile, tdee)
  const rule = DIET_RULES[profile.dietType ?? 'balanced'] ?? {}

  const proteinPerKg = rule.proteinPerKg ?? goalProteinPerKg(profile.goal)
  const proteinG = Math.round(profile.weightKg * proteinPerKg)
  const proteinCals = proteinG * 4

  let fatG: number
  let carbsG: number

  if (rule.carbCapG != null) {
    carbsG = rule.carbCapG
    fatG = Math.max(0, Math.round((calories - proteinCals - carbsG * 4) / 9))
  } else if (rule.carbPct != null) {
    carbsG = Math.max(0, Math.round((calories * rule.carbPct) / 4))
    fatG = Math.max(0, Math.round((calories - proteinCals - carbsG * 4) / 9))
  } else {
    const fatPct = rule.fatPct ?? 0.25
    fatG = Math.round((calories * fatPct) / 9)
    carbsG = Math.max(0, Math.round((calories - proteinCals - fatG * 9) / 4))
  }

  return { calories, proteinG, carbsG, fatG }
}

/** Short human-readable label for a diet type (UI + AI prompt). */
export const DIET_LABELS: Record<DietType, string> = {
  balanced: 'Balanced',
  keto: 'Keto (very low carb)',
  low_carb: 'Low carb',
  high_protein: 'High protein',
  low_fat: 'Low fat',
  paleo: 'Paleo',
  mediterranean: 'Mediterranean',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan'
}
