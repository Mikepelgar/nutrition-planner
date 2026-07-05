import type Database from 'better-sqlite3'

/**
 * Custom (user-created) foods are stored as ordinary rows in the `food` /
 * `food_nutrient` tables with `data_type='custom_food'` and a NEGATIVE fdc_id
 * (USDA ids are all positive, so negatives never collide and still satisfy the
 * plan_entry FK). The `food_fts_insert` AFTER-INSERT trigger auto-indexes them,
 * so they show up in normal search with no query changes.
 */

const NUTRIENT_META: Record<number, { name: string; unit: string }> = {
  1008: { name: 'Energy', unit: 'kcal' },
  1003: { name: 'Protein', unit: 'g' },
  1005: { name: 'Carbohydrate, by difference', unit: 'g' },
  1004: { name: 'Total lipid (fat)', unit: 'g' },
  1079: { name: 'Fiber, total dietary', unit: 'g' },
  1093: { name: 'Sodium, Na', unit: 'mg' },
  2000: { name: 'Sugars, total', unit: 'g' }
}

export interface CustomFoodInput {
  name: string
  servingG: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG?: number
  sodiumMg?: number
  sugarG?: number
}

export interface CustomFoodSummary {
  fdcId: number
  description: string
  servingG: number
  caloriesPerServing: number
}

function nextCustomId(db: Database.Database): number {
  const row = db.prepare('SELECT MIN(fdc_id) AS m FROM food').get() as { m: number | null }
  return row.m != null && row.m < 0 ? row.m - 1 : -1
}

export function createCustomFood(db: Database.Database, input: CustomFoodInput): number {
  const id = nextCustomId(db)
  const sg = input.servingG > 0 ? input.servingG : 100
  const per100 = (v: number) => Math.round((v / sg) * 100 * 100) / 100

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO food
        (fdc_id, data_type, description, brand_owner, brand_name,
         serving_size, serving_size_unit, household_serving, popularity_score)
      VALUES (?, 'custom_food', ?, NULL, NULL, ?, 'g', '1 serving', 1000)
    `).run(id, input.name.trim(), sg)

    const ins = db.prepare(
      'INSERT INTO food_nutrient (fdc_id, nutrient_id, nutrient_name, unit_name, amount) VALUES (?, ?, ?, ?, ?)'
    )
    const add = (nid: number, value: number | undefined): void => {
      if (value == null || Number.isNaN(value)) return
      const meta = NUTRIENT_META[nid]
      ins.run(id, nid, meta.name, meta.unit, per100(value))
    }
    add(1008, input.calories)
    add(1003, input.proteinG)
    add(1005, input.carbsG)
    add(1004, input.fatG)
    add(1079, input.fiberG)
    add(1093, input.sodiumMg)
    add(2000, input.sugarG)
  })
  tx()
  return id
}

export function listCustomFoods(db: Database.Database): CustomFoodSummary[] {
  return db.prepare(`
    SELECT
      f.fdc_id AS fdcId,
      f.description,
      COALESCE(f.serving_size, 100) AS servingG,
      ROUND(
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = f.fdc_id AND nutrient_id = 1008 LIMIT 1), 0)
        * COALESCE(f.serving_size, 100) / 100
      ) AS caloriesPerServing
    FROM food f
    WHERE f.data_type = 'custom_food'
    ORDER BY f.description COLLATE NOCASE
  `).all() as CustomFoodSummary[]
}

export function deleteCustomFood(
  db: Database.Database,
  fdcId: number
): { success: boolean; reason?: 'in_use' | 'not_found' } {
  const used = (db.prepare('SELECT COUNT(*) AS c FROM plan_entry WHERE fdc_id = ?').get(fdcId) as { c: number }).c
  if (used > 0) return { success: false, reason: 'in_use' }

  const row = db.prepare(
    "SELECT description, brand_owner FROM food WHERE fdc_id = ? AND data_type = 'custom_food'"
  ).get(fdcId) as { description: string; brand_owner: string | null } | undefined
  if (!row) return { success: false, reason: 'not_found' }

  const tx = db.transaction(() => {
    // External-content FTS5 requires an explicit 'delete' command to de-index.
    db.prepare("INSERT INTO food_fts(food_fts, rowid, description, brand_owner) VALUES('delete', ?, ?, ?)")
      .run(fdcId, row.description, row.brand_owner ?? '')
    db.prepare('DELETE FROM food_nutrient WHERE fdc_id = ?').run(fdcId)
    db.prepare('DELETE FROM favorite_food WHERE fdc_id = ?').run(fdcId)
    db.prepare('DELETE FROM food WHERE fdc_id = ?').run(fdcId)
  })
  tx()
  return { success: true }
}
