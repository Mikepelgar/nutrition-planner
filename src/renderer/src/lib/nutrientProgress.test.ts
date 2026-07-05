import { describe, it, expect } from 'vitest'
import { computeNutrientProgress } from './nutrientProgress'

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
