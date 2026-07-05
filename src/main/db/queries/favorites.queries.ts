import type Database from 'better-sqlite3'
import type { QuickAddItem } from './quickadd.queries'

export interface FavoriteItem extends QuickAddItem {
  favoritedAt: string
}

interface FavoriteRow {
  fdcId: number
  foodDescription: string
  servingUnit: string
  servingAmount: number
  grams: number
  caloriesPer100g: number | null
  favoritedAt: string
}

export function getFavorites(db: Database.Database): FavoriteItem[] {
  const rows = db.prepare(`
    SELECT
      f.fdc_id                AS fdcId,
      f.food_description      AS foodDescription,
      f.serving_unit          AS servingUnit,
      f.serving_amount        AS servingAmount,
      f.grams,
      f.created_at            AS favoritedAt,
      COALESCE(
        (SELECT amount FROM food_nutrient WHERE fdc_id = f.fdc_id AND nutrient_id = 1008 LIMIT 1),
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = f.fdc_id AND nutrient_id = 1003 LIMIT 1), 0) * 4 +
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = f.fdc_id AND nutrient_id = 1005 LIMIT 1), 0) * 4 +
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = f.fdc_id AND nutrient_id = 1004 LIMIT 1), 0) * 9
      )                       AS caloriesPer100g
    FROM favorite_food f
    ORDER BY f.created_at DESC
  `).all() as FavoriteRow[]

  return rows.map(r => ({
    fdcId: r.fdcId,
    foodDescription: r.foodDescription,
    servingUnit: r.servingUnit,
    servingAmount: r.servingAmount,
    grams: r.grams,
    caloriesPer100g: r.caloriesPer100g,
    useCount: 0,
    lastUsed: '',
    favoritedAt: r.favoritedAt
  }))
}

export function getFavoriteIds(db: Database.Database): number[] {
  const rows = db.prepare('SELECT fdc_id FROM favorite_food').all() as { fdc_id: number }[]
  return rows.map(r => r.fdc_id)
}

/** Toggles favorite state. Returns true if now favorited, false if removed. */
export function toggleFavorite(
  db: Database.Database,
  item: Pick<QuickAddItem, 'fdcId' | 'foodDescription' | 'servingUnit' | 'servingAmount' | 'grams'>
): boolean {
  const exists = db.prepare('SELECT 1 FROM favorite_food WHERE fdc_id = ?').get(item.fdcId)
  if (exists) {
    db.prepare('DELETE FROM favorite_food WHERE fdc_id = ?').run(item.fdcId)
    return false
  } else {
    db.prepare(`
      INSERT INTO favorite_food (fdc_id, food_description, serving_unit, serving_amount, grams)
      VALUES (?, ?, ?, ?, ?)
    `).run(item.fdcId, item.foodDescription, item.servingUnit, item.servingAmount, item.grams)
    return true
  }
}
