import { describe, it, expect } from 'vitest'
import { buildNutrientProgress, computeNutrientProgress } from './nutrientProgress'
import { getDRIForProfile } from '../../../shared/rdi'

describe('computeNutrientProgress (3-state algorithm)', () => {
  it('below RDI → normal, primary bar = ratio', () => {
    const r = computeNutrientProgress(50, 100, 200)
    expect(r.state).toBe('normal')
    expect(r.primaryBarPercent).toBe(50)
    expect(r.secondaryBarPercent).toBe(0)
    expect(r.displayPercent).toBe(50)
  })

  it('between RDI and UL → over-rdi, secondary = progress toward UL', () => {
    const r = computeNutrientProgress(120, 100, 200)
    expect(r.state).toBe('over-rdi')
    expect(r.primaryBarPercent).toBe(100)
    expect(r.secondaryBarPercent).toBe(20) // (120-100)/(200-100)
  })

  it('above UL → excess, both bars full', () => {
    const r = computeNutrientProgress(250, 100, 200)
    expect(r.state).toBe('excess')
    expect(r.primaryBarPercent).toBe(100)
    expect(r.secondaryBarPercent).toBe(100)
  })

  it('over RDI with no UL → over-rdi with a 1.5×RDI ceiling', () => {
    const r = computeNutrientProgress(140, 100, null)
    expect(r.state).toBe('over-rdi')
    expect(r.secondaryBarPercent).toBe(80) // (140-100)/(150-100)
  })

  it('exactly at RDI is still normal', () => {
    expect(computeNutrientProgress(100, 100, 200).state).toBe('normal')
  })

  it('zero RDI does not divide by zero', () => {
    const r = computeNutrientProgress(10, 0, null)
    expect(r.displayPercent).toBe(0)
    expect(r.state).toBe('normal')
  })
})

describe('buildNutrientProgress (shared DRI table + macro overrides)', () => {
  const profile = { age: 30, sex: 'male' as const }
  const targets = { calories: 2500, proteinG: 160, carbsG: 280, fatG: 70 }

  it('overrides the four macro rows with the personalized targets', () => {
    const rows = buildNutrientProgress(new Map(), profile, targets)
    const byId = new Map(rows.map(r => [r.nutrientId, r]))
    expect(byId.get(1008)?.rdi).toBe(2500)
    expect(byId.get(1003)?.rdi).toBe(160)
    expect(byId.get(1004)?.rdi).toBe(70)
    expect(byId.get(1005)?.rdi).toBe(280)
  })

  it('takes micronutrient RDI/UL verbatim from the shared DRI table', () => {
    const rows = buildNutrientProgress(new Map(), profile, targets)
    const byId = new Map(rows.map(r => [r.nutrientId, r]))
    for (const dri of getDRIForProfile(profile.age, profile.sex)) {
      if ([1008, 1003, 1004, 1005].includes(dri.nutrientId)) continue
      expect(byId.get(dri.nutrientId)?.rdi).toBe(dri.rdi)
      expect(byId.get(dri.nutrientId)?.ul).toBe(dri.ul)
      expect(byId.get(dri.nutrientId)?.name).toBe(dri.name)
    }
  })

  it('applies intakes and the progress algorithm', () => {
    const rows = buildNutrientProgress(new Map([[1162, 45]]), profile, targets) // Vit C, RDI 90
    const vitC = rows.find(r => r.nutrientId === 1162)!
    expect(vitC.intake).toBe(45)
    expect(vitC.displayPercent).toBe(50)
    expect(vitC.state).toBe('normal')
  })

  it('missing intakes default to zero', () => {
    const rows = buildNutrientProgress(new Map(), profile, targets)
    expect(rows.every(r => r.intake === 0)).toBe(true)
  })
})
