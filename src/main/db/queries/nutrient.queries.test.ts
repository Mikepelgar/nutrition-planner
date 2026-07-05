import { describe, it, expect } from 'vitest'
import type Database from 'better-sqlite3'
import { getFoodNutrientTotals } from './nutrient.queries'

// Stub db: returns per-100g food_nutrient rows for whichever fdc_ids are queried.
function stubDb(
  nutrientRows: Array<{ fdc_id: number; nutrient_id: number; amount: number }>
): Database.Database {
  return {
    prepare: () => ({
      all: (...fdcIds: number[]) => nutrientRows.filter(r => fdcIds.includes(r.fdc_id))
    })
  } as unknown as Database.Database
}

describe('getFoodNutrientTotals', () => {
  it('returns an empty map for no items', () => {
    expect(getFoodNutrientTotals(stubDb([]), []).size).toBe(0)
  })

  it('scales per-100g amounts by grams', () => {
    const db = stubDb([{ fdc_id: 1, nutrient_id: 1003, amount: 10 }])
    const totals = getFoodNutrientTotals(db, [{ fdcId: 1, grams: 50 }])
    expect(totals.get(1003)).toBeCloseTo(5)
  })

  // Regression: the same food logged twice in one day (two plan_entry rows with
  // the same fdc_id) used to keep only the last entry's grams, undercounting
  // micronutrient totals fed to the gap bars and the AI coach context.
  it('sums grams across duplicate fdc_id entries', () => {
    const db = stubDb([
      { fdc_id: 1, nutrient_id: 1003, amount: 12 }, // protein per 100g
      { fdc_id: 1, nutrient_id: 1087, amount: 50 } // calcium per 100g
    ])
    const totals = getFoodNutrientTotals(db, [
      { fdcId: 1, grams: 100 }, // eggs at breakfast
      { fdcId: 1, grams: 60 } // eggs at dinner
    ])
    expect(totals.get(1003)).toBeCloseTo(12 * 1.6)
    expect(totals.get(1087)).toBeCloseTo(50 * 1.6)
  })

  it('totals across different foods sharing a nutrient', () => {
    const db = stubDb([
      { fdc_id: 1, nutrient_id: 1003, amount: 10 },
      { fdc_id: 2, nutrient_id: 1003, amount: 20 }
    ])
    const totals = getFoodNutrientTotals(db, [
      { fdcId: 1, grams: 100 },
      { fdcId: 2, grams: 100 }
    ])
    expect(totals.get(1003)).toBeCloseTo(30)
  })
})
