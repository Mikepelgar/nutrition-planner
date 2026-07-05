import type { UnitSystem } from './types'

// Body data is always STORED in metric (kg, cm, ml). These helpers convert for
// display/input only.

const LB_PER_KG = 2.2046226218
const ML_PER_FLOZ = 29.5735

export const weightUnitLabel = (sys: UnitSystem): string => (sys === 'imperial' ? 'lb' : 'kg')
export const volumeUnitLabel = (sys: UnitSystem): string => (sys === 'imperial' ? 'fl oz' : 'ml')

export function kgToDisplay(kg: number, sys: UnitSystem): number {
  return sys === 'imperial' ? kg * LB_PER_KG : kg
}
export function displayToKg(val: number, sys: UnitSystem): number {
  return sys === 'imperial' ? val / LB_PER_KG : val
}

export function mlToDisplay(ml: number, sys: UnitSystem): number {
  return sys === 'imperial' ? ml / ML_PER_FLOZ : ml
}

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = cm / 2.54
  let ft = Math.floor(totalIn / 12)
  let inch = Math.round(totalIn - ft * 12)
  if (inch === 12) { ft += 1; inch = 0 }
  return { ft, inch }
}
export function ftInToCm(ft: number, inch: number): number {
  return (ft * 12 + inch) * 2.54
}

/** Round to n decimals (returns a number). */
export function round(v: number, n = 0): number {
  const f = 10 ** n
  return Math.round(v * f) / f
}
