import { describe, it, expect } from 'vitest'
import { toGrams, normalizeSizeUnit } from './unitConversion'
import type { FoodDetail, ServingUnit } from './types'

const food = (o: Partial<FoodDetail> = {}): FoodDetail => ({
  fdcId: 1,
  description: 'Test food',
  dataType: 'sr_legacy_food',
  brandOwner: null,
  caloriesPer100g: null,
  nutrients: [],
  portions: [],
  servingSize: null,
  servingSizeUnit: null,
  householdServing: null,
  ...o
})

describe('toGrams base conversions', () => {
  const f = food()
  const cases: Array<[number, ServingUnit, number]> = [
    [100, 'g', 100],
    [1, 'kg', 1000],
    [1, 'oz', 28.3495],
    [1, 'lb', 453.592],
    [200, 'ml', 200],
    [1, 'l', 1000],
    [1, 'fl_oz', 29.5735],
    [1, 'cup', 236.588],
    [1, 'tbsp', 14.7868],
    [1, 'tsp', 4.92892]
  ]
  for (const [amt, unit, grams] of cases) {
    it(`${amt} ${unit} → ${grams} g`, () => expect(toGrams(amt, unit, f)).toBeCloseTo(grams, 3))
  }
})

describe('toGrams serving', () => {
  it('uses label servingSize (g)', () =>
    expect(toGrams(2, 'serving', food({ servingSize: 50, servingSizeUnit: 'g' }))).toBe(100))
  it('falls back to 100g per serving when nothing is known', () =>
    expect(toGrams(1, 'serving', food())).toBe(100))
  it('uses the first portion gram weight when present', () =>
    expect(
      toGrams(2, 'serving', food({ portions: [{ id: 1, amount: 1, measureUnit: 'cup', portionDescription: null, gramWeight: 30 }] }))
    ).toBe(60))
})

describe('normalizeSizeUnit', () => {
  it('maps branded unit codes', () => {
    expect(normalizeSizeUnit('GRM')).toBe('g')
    expect(normalizeSizeUnit('MLT')).toBe('ml')
    expect(normalizeSizeUnit('lbs')).toBe('lb')
  })
  it('returns null for unknown codes', () => expect(normalizeSizeUnit('IU')).toBeNull())
})
