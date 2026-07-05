import type Database from 'better-sqlite3'

export interface QuickAddItem {
  fdcId: number
  foodDescription: string
  servingUnit: string
  servingAmount: number
  grams: number
  caloriesPer100g: number | null
  useCount: number
  lastUsed: string
}

export function getRecentFoods(
  db: Database.Database,
  options: { cutoffDate?: string; limit?: number } = {}
): QuickAddItem[] {
  const { cutoffDate, limit = 200 } = options
  const whereClause = cutoffDate ? 'WHERE p.date >= ?' : ''
  const params: unknown[] = cutoffDate ? [cutoffDate, limit] : [limit]

  return db.prepare(`
    SELECT
      pe.fdc_id                                                 AS fdcId,
      pe.food_description                                       AS foodDescription,
      pe.serving_unit                                           AS servingUnit,
      pe.serving_amount                                         AS servingAmount,
      pe.grams,
      COUNT(*)                                                  AS useCount,
      MAX(p.date)                                               AS lastUsed,
      COALESCE(
        (SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1008 LIMIT 1),
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1003 LIMIT 1), 0) * 4 +
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1005 LIMIT 1), 0) * 4 +
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1004 LIMIT 1), 0) * 9
      )                                                         AS caloriesPer100g
    FROM plan_entry pe
    JOIN plan p ON p.id = pe.plan_id
    ${whereClause}
    GROUP BY pe.fdc_id, pe.serving_unit, ROUND(pe.serving_amount, 1)
    ORDER BY useCount DESC, lastUsed DESC
    LIMIT ?
  `).all(...params) as QuickAddItem[]
}
