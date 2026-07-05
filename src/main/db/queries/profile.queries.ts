import type Database from 'better-sqlite3'
import type { UserProfile, Allergen, DietType, UnitSystem } from '../../../renderer/src/lib/types'

interface ProfileRow {
  age: number
  sex: string
  height_cm: number
  weight_kg: number
  activity_level: string
  goal: string
  goal_kcal: number | null
  diet_type: string | null
  allergens: string | null
  avoid_foods: string | null
  goal_weight_kg: number | null
  unit_system: string | null
  use_custom_targets: number | null
  custom_calories: number | null
  custom_protein_g: number | null
  custom_carbs_g: number | null
  custom_fat_g: number | null
}

/** Tolerant JSON-array parse — stored as TEXT, defaults to [] on null/garbage. */
function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

function rowToProfile(row: ProfileRow): UserProfile {
  return {
    age: row.age,
    sex: row.sex as UserProfile['sex'],
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level as UserProfile['activityLevel'],
    goal: row.goal as UserProfile['goal'],
    goalKcal: row.goal_kcal ?? undefined,
    dietType: (row.diet_type ?? 'balanced') as DietType,
    allergens: parseJsonArray<Allergen>(row.allergens),
    avoidFoods: parseJsonArray<string>(row.avoid_foods),
    goalWeightKg: row.goal_weight_kg ?? undefined,
    unitSystem: (row.unit_system ?? 'metric') as UnitSystem,
    useCustomTargets: !!row.use_custom_targets,
    customCalories: row.custom_calories ?? undefined,
    customProteinG: row.custom_protein_g ?? undefined,
    customCarbsG: row.custom_carbs_g ?? undefined,
    customFatG: row.custom_fat_g ?? undefined
  }
}

export function getProfile(db: Database.Database): UserProfile | null {
  const row = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as ProfileRow | undefined
  return row ? rowToProfile(row) : null
}

export function saveProfile(db: Database.Database, profile: UserProfile): UserProfile {
  db.prepare(`
    INSERT INTO user_profile
      (id, age, sex, height_cm, weight_kg, activity_level, goal, goal_kcal,
       diet_type, allergens, avoid_foods, goal_weight_kg, unit_system,
       use_custom_targets, custom_calories, custom_protein_g, custom_carbs_g, custom_fat_g, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      age = excluded.age,
      sex = excluded.sex,
      height_cm = excluded.height_cm,
      weight_kg = excluded.weight_kg,
      activity_level = excluded.activity_level,
      goal = excluded.goal,
      goal_kcal = excluded.goal_kcal,
      diet_type = excluded.diet_type,
      allergens = excluded.allergens,
      avoid_foods = excluded.avoid_foods,
      goal_weight_kg = excluded.goal_weight_kg,
      unit_system = excluded.unit_system,
      use_custom_targets = excluded.use_custom_targets,
      custom_calories = excluded.custom_calories,
      custom_protein_g = excluded.custom_protein_g,
      custom_carbs_g = excluded.custom_carbs_g,
      custom_fat_g = excluded.custom_fat_g,
      updated_at = datetime('now')
  `).run(
    profile.age, profile.sex, profile.heightCm, profile.weightKg,
    profile.activityLevel, profile.goal, profile.goalKcal ?? null,
    profile.dietType ?? 'balanced',
    JSON.stringify(profile.allergens ?? []),
    JSON.stringify(profile.avoidFoods ?? []),
    profile.goalWeightKg ?? null,
    profile.unitSystem ?? 'metric',
    profile.useCustomTargets ? 1 : 0,
    profile.customCalories ?? null,
    profile.customProteinG ?? null,
    profile.customCarbsG ?? null,
    profile.customFatG ?? null
  )
  return profile
}
