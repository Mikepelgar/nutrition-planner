import type Database from 'better-sqlite3'
import type { MealType } from '../../../renderer/src/lib/types'

export interface EntryMacros {
  name: string
  meal: MealType
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

/**
 * Per-entry calories + macros for a plan, with the same energy fallback the
 * History page uses (1008, else protein*4 + carbs*4 + fat*9). Per-entry (not
 * grouped by fdc_id) so duplicate foods each count their own grams.
 */
export function getEntryMacros(db: Database.Database, planId: number): EntryMacros[] {
  const rows = db.prepare(`
    SELECT
      pe.food_description AS name,
      pe.meal             AS meal,
      COALESCE(
        (SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1008 LIMIT 1),
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1003 LIMIT 1), 0) * 4 +
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1005 LIMIT 1), 0) * 4 +
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1004 LIMIT 1), 0) * 9
      ) * (pe.grams / 100.0) AS kcal,
      COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1003 LIMIT 1), 0) * (pe.grams / 100.0) AS proteinG,
      COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1005 LIMIT 1), 0) * (pe.grams / 100.0) AS carbsG,
      COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1004 LIMIT 1), 0) * (pe.grams / 100.0) AS fatG
    FROM plan_entry pe
    WHERE pe.plan_id = ?
    ORDER BY pe.position
  `).all(planId) as EntryMacros[]
  return rows
}

export function getFoodNutrientTotals(
  db: Database.Database,
  items: Array<{ fdcId: number; grams: number }>
): Map<number, number> {
  const totals = new Map<number, number>()
  if (items.length === 0) return totals

  // Sum grams per fdc_id: the same food can be logged multiple times in a day
  // (e.g. eggs at breakfast and dinner), and each entry must count.
  const gramsById = new Map<number, number>()
  for (const item of items) {
    gramsById.set(item.fdcId, (gramsById.get(item.fdcId) ?? 0) + item.grams)
  }
  const fdcIds = [...gramsById.keys()]
  const placeholders = fdcIds.map(() => '?').join(',')

  const rows = db.prepare(`
    SELECT fdc_id, nutrient_id, amount
    FROM food_nutrient
    WHERE fdc_id IN (${placeholders})
  `).all(...fdcIds) as Array<{ fdc_id: number; nutrient_id: number; amount: number }>

  for (const row of rows) {
    const grams = gramsById.get(row.fdc_id) ?? 0
    const intake = (grams / 100) * row.amount
    totals.set(row.nutrient_id, (totals.get(row.nutrient_id) ?? 0) + intake)
  }

  return totals
}
