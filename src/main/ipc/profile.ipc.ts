import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getProfile, saveProfile } from '../db/queries/profile.queries'
import type { UserProfile } from '../../renderer/src/lib/types'
import { asEnum, asInt, asNumber, asString } from './validate'

// Runtime mirrors of the renderer's union types (types are erased at the boundary).
const SEXES = ['male', 'female'] as const
const ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'] as const
const GOALS = ['maintain', 'bulk', 'cut', 'recomp'] as const
const DIET_TYPES = ['balanced', 'keto', 'low_carb', 'high_protein', 'low_fat', 'paleo', 'mediterranean', 'vegetarian', 'vegan'] as const
const UNIT_SYSTEMS = ['metric', 'imperial'] as const

/**
 * Shape-validate the profile before it reaches SQL. The profile feeds BMR/TDEE
 * math everywhere, so a NaN weight or garbage enum here would poison every
 * target in the app.
 */
function sanitizeProfile(p: UserProfile): UserProfile {
  const optNumber = (v: unknown, field: string, opts: { min: number; max: number }): number | undefined =>
    v == null ? undefined : asNumber(v, field, opts)
  const optStrings = (v: unknown, field: string, maxItems: number, maxLen: number): string[] =>
    v == null
      ? []
      : (Array.isArray(v) ? v : []).slice(0, maxItems).map(s => asString(s, field, maxLen))

  return {
    age: asInt(p?.age, 'age', { min: 5, max: 130 }),
    sex: asEnum(p?.sex, 'sex', SEXES),
    heightCm: asNumber(p?.heightCm, 'heightCm', { min: 30, max: 300 }),
    weightKg: asNumber(p?.weightKg, 'weightKg', { min: 10, max: 700 }),
    activityLevel: asEnum(p?.activityLevel, 'activityLevel', ACTIVITY_LEVELS),
    goal: asEnum(p?.goal, 'goal', GOALS),
    goalKcal: optNumber(p?.goalKcal, 'goalKcal', { min: 0, max: 10000 }),
    dietType: p?.dietType != null ? asEnum(p.dietType, 'dietType', DIET_TYPES) : undefined,
    allergens: optStrings(p?.allergens, 'allergens', 20, 40) as UserProfile['allergens'],
    avoidFoods: optStrings(p?.avoidFoods, 'avoidFoods', 50, 80),
    goalWeightKg: optNumber(p?.goalWeightKg, 'goalWeightKg', { min: 10, max: 700 }),
    unitSystem: p?.unitSystem != null ? asEnum(p.unitSystem, 'unitSystem', UNIT_SYSTEMS) : undefined,
    useCustomTargets: p?.useCustomTargets === true,
    customCalories: optNumber(p?.customCalories, 'customCalories', { min: 0, max: 20000 }),
    customProteinG: optNumber(p?.customProteinG, 'customProteinG', { min: 0, max: 2000 }),
    customCarbsG: optNumber(p?.customCarbsG, 'customCarbsG', { min: 0, max: 5000 }),
    customFatG: optNumber(p?.customFatG, 'customFatG', { min: 0, max: 2000 })
  }
}

export function registerProfileIPC(): void {
  ipcMain.handle('profile:get', () => {
    return getProfile(getDb())
  })

  ipcMain.handle('profile:save', (_event, profile: UserProfile) => {
    return saveProfile(getDb(), sanitizeProfile(profile))
  })
}
