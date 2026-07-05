import type Database from 'better-sqlite3'
import type { FoodSearchResult, FoodDetail, FoodNutrient, FoodPortion } from '../../../renderer/src/lib/types'

const USDA_LIMIT = 8

const CAL_SUBQUERY = `
  COALESCE(
    (SELECT amount FROM food_nutrient WHERE fdc_id = f.fdc_id AND nutrient_id = 1008 LIMIT 1),
    ROUND(
      COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = f.fdc_id AND nutrient_id = 1003 LIMIT 1), 0) * 4 +
      COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = f.fdc_id AND nutrient_id = 1005 LIMIT 1), 0) * 4 +
      COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = f.fdc_id AND nutrient_id = 1004 LIMIT 1), 0) * 9
    )
  )`

export function searchFoods(
  db: Database.Database,
  query: string,
  limit = 25
): FoodSearchResult[] {
  if (query.trim().length < 2) return []

  const rawWords = query.trim().split(/\s+/)
  const words = rawWords.map(w => `"${w.replace(/"/g, '')}"*`)
  const andQuery = words.join(' ')
  const orQuery = words.length > 1 ? words.join(' OR ') : null
  // Pattern for "starts with first query word" — promotes "Chicken, breast" over "Fat, chicken"
  const startsWithPattern = `${rawWords[0].toLowerCase()}%`

  function ftsSearch(ftsQuery: string): FoodSearchResult[] | null {
    try {
      const usda = db.prepare(`
        SELECT
          f.fdc_id          AS fdcId,
          f.description,
          f.data_type       AS dataType,
          f.brand_owner     AS brandOwner,
          ${CAL_SUBQUERY}   AS caloriesPer100g
        FROM food_fts
        JOIN food f ON food_fts.rowid = f.fdc_id
        WHERE food_fts MATCH ?
          AND f.data_type IN ('sr_legacy_food', 'foundation_food', 'custom_food')
        ORDER BY
          CASE WHEN lower(f.description) LIKE ? THEN 0 ELSE 1 END,
          popularity_score DESC,
          rank
        LIMIT ?
      `).all(ftsQuery, startsWithPattern, USDA_LIMIT) as FoodSearchResult[]

      const branded = db.prepare(`
        SELECT
          f.fdc_id          AS fdcId,
          f.description,
          f.data_type       AS dataType,
          f.brand_owner     AS brandOwner,
          ${CAL_SUBQUERY}   AS caloriesPer100g
        FROM food_fts
        JOIN food f ON food_fts.rowid = f.fdc_id
        WHERE food_fts MATCH ?
          AND f.data_type = 'branded_food'
        ORDER BY
          CASE WHEN f.popularity_score > 0 THEN 0 ELSE 1 END,
          f.popularity_score DESC,
          rank
        LIMIT ?
      `).all(ftsQuery, Math.max(0, limit - USDA_LIMIT)) as FoodSearchResult[]

      const combined = [...usda, ...branded]
      return combined.length > 0 ? combined : null
    } catch {
      return null
    }
  }

  // 1. Try strict AND prefix match
  const andResults = ftsSearch(andQuery)
  if (andResults) return andResults

  // 2. Try OR (catches multi-word queries where one word doesn't match)
  if (orQuery) {
    const orResults = ftsSearch(orQuery)
    if (orResults) return orResults
  }

  // 3. LIKE fallback — only practical for the small USDA set (~8K rows)
  const likePattern = `%${query.trim().replace(/[%_\\]/g, '\\$&')}%`
  try {
    const usda = db.prepare(`
      SELECT
        fdc_id        AS fdcId,
        description,
        data_type     AS dataType,
        brand_owner   AS brandOwner,
        (SELECT amount FROM food_nutrient WHERE fdc_id = food.fdc_id AND nutrient_id = 1008 LIMIT 1) AS caloriesPer100g
      FROM food
      WHERE description LIKE ? ESCAPE '\\'
        AND data_type IN ('sr_legacy_food', 'foundation_food', 'custom_food')
      ORDER BY
        CASE WHEN lower(description) LIKE ? THEN 0 ELSE 1 END,
        length(description)
      LIMIT ?
    `).all(likePattern, startsWithPattern, USDA_LIMIT) as FoodSearchResult[]

    return usda
  } catch {
    return []
  }
}

export function findFoodByBarcode(db: Database.Database, upc: string): FoodDetail | null {
  const code = upc.trim()
  if (!code) return null
  const row = db.prepare('SELECT fdc_id AS fdcId FROM food WHERE gtin_upc = ? LIMIT 1').get(code) as
    | { fdcId: number }
    | undefined
  return row ? getFoodDetail(db, row.fdcId) : null
}

export function getFoodDetail(db: Database.Database, fdcId: number): FoodDetail | null {
  const food = db.prepare(`
    SELECT
      fdc_id AS fdcId,
      description,
      data_type AS dataType,
      brand_owner AS brandOwner,
      brand_name AS brandName,
      serving_size AS servingSize,
      serving_size_unit AS servingSizeUnit,
      household_serving AS householdServing
    FROM food WHERE fdc_id = ?
  `).get(fdcId) as (Omit<FoodDetail, 'nutrients' | 'portions' | 'caloriesPer100g'>) | undefined

  if (!food) return null

  const nutrients = db.prepare(`
    SELECT nutrient_id AS nutrientId, nutrient_name AS name, unit_name AS unit, amount
    FROM food_nutrient WHERE fdc_id = ?
  `).all(fdcId) as FoodNutrient[]

  const portions = db.prepare(`
    SELECT id, amount, measure_unit AS measureUnit, portion_description AS portionDescription, gram_weight AS gramWeight
    FROM food_portion WHERE fdc_id = ?
  `).all(fdcId) as FoodPortion[]

  let calRow = nutrients.find(n => n.nutrientId === 1008)
  if (!calRow) {
    const protein = nutrients.find(n => n.nutrientId === 1003)?.amount ?? 0
    const fat = nutrients.find(n => n.nutrientId === 1004)?.amount ?? 0
    const carbs = nutrients.find(n => n.nutrientId === 1005)?.amount ?? 0
    const computed = Math.round(protein * 4 + carbs * 4 + fat * 9)
    if (computed > 0) {
      calRow = { nutrientId: 1008, name: 'Energy', unit: 'kcal', amount: computed }
      nutrients.unshift(calRow)
    }
  }

  return { ...food, nutrients, portions, caloriesPer100g: calRow?.amount ?? null }
}
