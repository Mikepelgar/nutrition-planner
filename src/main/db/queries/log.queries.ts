import type Database from 'better-sqlite3'

export interface DailyLogEntry {
  date: string
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  entryCount: number
}

interface DailyLogRow {
  date: string
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  entry_count: number
}

export interface NutrientBreakdownEntry {
  nutrientId: number
  name: string
  unit: string
  dailyAvg: number
}

interface BreakdownRow {
  nutrientId: number
  name: string
  unit: string
  totalAmount: number
  daysLogged: number
}

export function getNutrientBreakdown(
  db: Database.Database,
  startDate: string,
  endDate: string
): NutrientBreakdownEntry[] {
  const rows = db.prepare(`
    WITH logged_days AS (
      SELECT COUNT(DISTINCT p.date) AS total_days
      FROM plan p
      JOIN plan_entry pe ON pe.plan_id = p.id
      WHERE p.date BETWEEN ? AND ?
    )
    SELECT
      fn.nutrient_id                          AS nutrientId,
      fn.nutrient_name                        AS name,
      fn.unit_name                            AS unit,
      SUM(fn.amount * pe.grams / 100.0)       AS totalAmount,
      (SELECT total_days FROM logged_days)    AS daysLogged
    FROM plan p
    JOIN plan_entry pe ON pe.plan_id = p.id
    JOIN food_nutrient fn ON fn.fdc_id = pe.fdc_id
    WHERE p.date BETWEEN ? AND ?
    GROUP BY fn.nutrient_id
  `).all(startDate, endDate, startDate, endDate) as BreakdownRow[]

  // Energy fallback: if 1008 is missing, compute from macros
  const calRow = rows.find(r => r.nutrientId === 1008)
  if (!calRow || calRow.totalAmount === 0) {
    const protein = rows.find(r => r.nutrientId === 1003)?.totalAmount ?? 0
    const carbs   = rows.find(r => r.nutrientId === 1005)?.totalAmount ?? 0
    const fat     = rows.find(r => r.nutrientId === 1004)?.totalAmount ?? 0
    const days    = rows.find(r => r.nutrientId === 1003)?.daysLogged ?? 1
    const computed = Math.round(protein * 4 + carbs * 4 + fat * 9)
    if (computed > 0) {
      if (calRow) { calRow.totalAmount = computed }
      else { rows.unshift({ nutrientId: 1008, name: 'Energy', unit: 'kcal', totalAmount: computed, daysLogged: days }) }
    }
  }

  return rows.map(r => ({
    nutrientId: r.nutrientId,
    name: r.name,
    unit: r.unit,
    dailyAvg: r.totalAmount / Math.max(r.daysLogged, 1)
  }))
}

export function getDailyLogs(
  db: Database.Database,
  startDate: string,
  endDate: string
): DailyLogEntry[] {
  const rows = db.prepare(`
    WITH entry_nutrients AS (
      SELECT
        p.date,
        COALESCE(
          (SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1008 LIMIT 1),
          COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1003 LIMIT 1), 0) * 4 +
          COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1005 LIMIT 1), 0) * 4 +
          COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1004 LIMIT 1), 0) * 9
        ) * (pe.grams / 100.0) AS calories,
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1003 LIMIT 1), 0) * (pe.grams / 100.0) AS protein,
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1004 LIMIT 1), 0) * (pe.grams / 100.0) AS fat,
        COALESCE((SELECT amount FROM food_nutrient WHERE fdc_id = pe.fdc_id AND nutrient_id = 1005 LIMIT 1), 0) * (pe.grams / 100.0) AS carbs
      FROM plan p
      JOIN plan_entry pe ON pe.plan_id = p.id
      WHERE p.date BETWEEN ? AND ?
    )
    SELECT
      date,
      ROUND(SUM(calories))      AS calories,
      ROUND(SUM(protein), 1)    AS protein_g,
      ROUND(SUM(fat), 1)        AS fat_g,
      ROUND(SUM(carbs), 1)      AS carbs_g,
      COUNT(*)                  AS entry_count
    FROM entry_nutrients
    GROUP BY date
    ORDER BY date DESC
  `).all(startDate, endDate) as DailyLogRow[]

  return rows.map(r => ({
    date: r.date,
    calories: r.calories ?? 0,
    proteinG: r.protein_g ?? 0,
    fatG: r.fat_g ?? 0,
    carbsG: r.carbs_g ?? 0,
    entryCount: r.entry_count
  }))
}
