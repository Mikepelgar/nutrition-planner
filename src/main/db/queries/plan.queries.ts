import type Database from 'better-sqlite3'
import type { Plan, PlanEntry, ServingUnit, MealType } from '../../../renderer/src/lib/types'

export function getOrCreatePlan(db: Database.Database, date: string): Plan {
  const existing = db.prepare('SELECT id, date FROM plan WHERE date = ?').get(date) as Plan | undefined
  if (existing) return existing
  const result = db.prepare('INSERT INTO plan (date) VALUES (?) RETURNING id, date').get(date) as Plan
  return result
}

export function getPlanEntries(db: Database.Database, planId: number): PlanEntry[] {
  return db.prepare(`
    SELECT
      id, plan_id AS planId, fdc_id AS fdcId,
      food_description AS foodDescription,
      serving_unit AS servingUnit,
      serving_amount AS servingAmount,
      grams, position, meal
    FROM plan_entry
    WHERE plan_id = ?
    ORDER BY position ASC, created_at ASC
  `).all(planId) as PlanEntry[]
}

export function addPlanEntry(
  db: Database.Database,
  payload: { planId: number; fdcId: number; foodDescription: string; servingUnit: ServingUnit; servingAmount: number; grams: number; meal: MealType }
): PlanEntry {
  const maxPos = (db.prepare('SELECT COALESCE(MAX(position),0) AS m FROM plan_entry WHERE plan_id = ?').get(payload.planId) as { m: number }).m
  return db.prepare(`
    INSERT INTO plan_entry (plan_id, fdc_id, food_description, serving_unit, serving_amount, grams, position, meal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id, plan_id AS planId, fdc_id AS fdcId, food_description AS foodDescription,
              serving_unit AS servingUnit, serving_amount AS servingAmount, grams, position, meal
  `).get(payload.planId, payload.fdcId, payload.foodDescription, payload.servingUnit, payload.servingAmount, payload.grams, maxPos + 1, payload.meal) as PlanEntry
}

export function updatePlanEntry(
  db: Database.Database,
  payload: { entryId: number; servingUnit: ServingUnit; servingAmount: number; grams: number; meal?: MealType }
): PlanEntry {
  return db.prepare(`
    UPDATE plan_entry SET serving_unit = ?, serving_amount = ?, grams = ?, meal = COALESCE(?, meal)
    WHERE id = ?
    RETURNING id, plan_id AS planId, fdc_id AS fdcId, food_description AS foodDescription,
              serving_unit AS servingUnit, serving_amount AS servingAmount, grams, position, meal
  `).get(payload.servingUnit, payload.servingAmount, payload.grams, payload.meal ?? null, payload.entryId) as PlanEntry
}

export function deletePlanEntry(db: Database.Database, entryId: number): void {
  db.prepare('DELETE FROM plan_entry WHERE id = ?').run(entryId)
}

/** Copy all entries from one plan into another (append). */
export function copyEntries(db: Database.Database, sourcePlanId: number, targetPlanId: number): void {
  const offset = (db.prepare('SELECT COALESCE(MAX(position),0) AS m FROM plan_entry WHERE plan_id = ?')
    .get(targetPlanId) as { m: number }).m
  db.prepare(`
    INSERT INTO plan_entry (plan_id, fdc_id, food_description, serving_unit, serving_amount, grams, position, meal)
    SELECT ?, fdc_id, food_description, serving_unit, serving_amount, grams, position + ?, meal
    FROM plan_entry WHERE plan_id = ?
  `).run(targetPlanId, offset, sourcePlanId)
}
