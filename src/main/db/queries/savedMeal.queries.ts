import type Database from 'better-sqlite3'
import type { MealType, ServingUnit } from '../../../renderer/src/lib/types'
import { addPlanEntry } from './plan.queries'

export interface SavedMealSummary {
  id: number
  name: string
  itemCount: number
  calories: number
}

interface SavedMealItemRow {
  fdcId: number
  foodDescription: string
  servingUnit: string
  servingAmount: number
  grams: number
}

// Per-100g calorie expression with Atwater fallback, keyed off an alias `x`.
const CAL_PER_100 = (alias: string): string => `
  COALESCE(
    (SELECT amount FROM food_nutrient WHERE fdc_id = ${alias}.fdc_id AND nutrient_id = 1008 LIMIT 1),
    COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = ${alias}.fdc_id AND nutrient_id = 1003 LIMIT 1), 0) * 4 +
    COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = ${alias}.fdc_id AND nutrient_id = 1005 LIMIT 1), 0) * 4 +
    COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = ${alias}.fdc_id AND nutrient_id = 1004 LIMIT 1), 0) * 9
  )`

export function listSavedMeals(db: Database.Database): SavedMealSummary[] {
  return db.prepare(`
    SELECT
      sm.id,
      sm.name,
      (SELECT COUNT(*) FROM saved_meal_item WHERE saved_meal_id = sm.id) AS itemCount,
      ROUND(COALESCE((
        SELECT SUM((smi.grams / 100.0) * ${CAL_PER_100('smi')})
        FROM saved_meal_item smi WHERE smi.saved_meal_id = sm.id
      ), 0)) AS calories
    FROM saved_meal sm
    ORDER BY sm.name COLLATE NOCASE
  `).all() as SavedMealSummary[]
}

function getItems(db: Database.Database, savedMealId: number): SavedMealItemRow[] {
  return db.prepare(`
    SELECT fdc_id AS fdcId, food_description AS foodDescription,
           serving_unit AS servingUnit, serving_amount AS servingAmount, grams
    FROM saved_meal_item WHERE saved_meal_id = ?
  `).all(savedMealId) as SavedMealItemRow[]
}

/** Snapshot a day's entries (optionally just one meal section) into a new saved meal. */
export function createSavedMealFromEntries(
  db: Database.Database,
  name: string,
  planId: number,
  meal?: MealType
): number {
  const where = meal ? 'WHERE plan_id = ? AND meal = ?' : 'WHERE plan_id = ?'
  const params = meal ? [planId, meal] : [planId]
  const entries = db.prepare(`
    SELECT fdc_id AS fdcId, food_description AS foodDescription,
           serving_unit AS servingUnit, serving_amount AS servingAmount, grams
    FROM plan_entry ${where}
  `).all(...params) as SavedMealItemRow[]

  const tx = db.transaction(() => {
    const { id } = db.prepare('INSERT INTO saved_meal (name) VALUES (?) RETURNING id').get(name.trim()) as { id: number }
    const ins = db.prepare(
      'INSERT INTO saved_meal_item (saved_meal_id, fdc_id, food_description, serving_unit, serving_amount, grams) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const e of entries) ins.run(id, e.fdcId, e.foodDescription, e.servingUnit, e.servingAmount, e.grams)
    return id
  })
  return tx()
}

/** Expand a saved meal into individual plan_entry rows under the given meal section. */
export function logSavedMeal(db: Database.Database, planId: number, savedMealId: number, meal: MealType): void {
  const items = getItems(db, savedMealId)
  const tx = db.transaction(() => {
    for (const it of items) {
      addPlanEntry(db, {
        planId,
        fdcId: it.fdcId,
        foodDescription: it.foodDescription,
        servingUnit: it.servingUnit as ServingUnit,
        servingAmount: it.servingAmount,
        grams: it.grams,
        meal
      })
    }
  })
  tx()
}

export function deleteSavedMeal(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM saved_meal WHERE id = ?').run(id)
}
