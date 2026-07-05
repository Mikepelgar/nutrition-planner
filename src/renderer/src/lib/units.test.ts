import { describe, it, expect } from 'vitest'
import {
  kgToDisplay, displayToKg, weightUnitLabel, mlToDisplay, volumeUnitLabel, cmToFtIn, ftInToCm, round
} from './units'

describe('weight conversion', () => {
  it('metric is a passthrough', () => expect(kgToDisplay(80, 'metric')).toBe(80))
  it('kg → lb', () => expect(kgToDisplay(100, 'imperial')).toBeCloseTo(220.462, 2))
  it('round-trips kg ↔ lb', () => expect(displayToKg(kgToDisplay(72.5, 'imperial'), 'imperial')).toBeCloseTo(72.5, 5))
  it('labels', () => {
    expect(weightUnitLabel('imperial')).toBe('lb')
    expect(weightUnitLabel('metric')).toBe('kg')
  })
})

describe('volume conversion', () => {
  it('metric is a passthrough', () => expect(mlToDisplay(500, 'metric')).toBe(500))
  it('ml → fl oz', () => expect(mlToDisplay(1000, 'imperial')).toBeCloseTo(33.814, 2))
  it('labels', () => {
    expect(volumeUnitLabel('imperial')).toBe('fl oz')
    expect(volumeUnitLabel('metric')).toBe('ml')
  })
})

describe('height conversion', () => {
  it('180cm → 5ft 11in', () => expect(cmToFtIn(180)).toEqual({ ft: 5, inch: 11 }))
  it('carries inches==12 up to the next foot', () => {
    const { ft, inch } = cmToFtIn(182.88) // exactly 6ft
    expect(ft).toBe(6)
    expect(inch).toBe(0)
  })
  it('round-trips approximately', () => {
    const { ft, inch } = cmToFtIn(175)
    expect(ftInToCm(ft, inch)).toBeCloseTo(175, 0)
  })
})

describe('round', () => {
  it('rounds to n decimals', () => {
    expect(round(220.462, 1)).toBe(220.5)
    expect(round(220.462, 0)).toBe(220)
  })
})
