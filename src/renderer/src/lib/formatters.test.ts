import { describe, it, expect } from 'vitest'
import { fmt, localIso, todayIso, shiftDate } from './formatters'

describe('localIso / todayIso', () => {
  it('formats using local date parts', () => {
    expect(localIso(new Date(2026, 6, 5))).toBe('2026-07-05')
    expect(localIso(new Date(2026, 0, 1))).toBe('2026-01-01')
  })

  it('matches the local calendar day even at local midnight (UTC would differ)', () => {
    // Local midnight: toISOString() reports a different day for any non-UTC
    // offset, which was the original bug.
    const d = new Date(2026, 6, 5, 0, 0, 1)
    expect(localIso(d)).toBe('2026-07-05')
  })

  it('todayIso equals the local date of now', () => {
    const now = new Date()
    expect(todayIso()).toBe(localIso(now))
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('shiftDate', () => {
  it('shifts forward and backward', () => {
    expect(shiftDate('2026-07-05', 1)).toBe('2026-07-06')
    expect(shiftDate('2026-07-05', -1)).toBe('2026-07-04')
    expect(shiftDate('2026-07-05', 0)).toBe('2026-07-05')
  })

  it('crosses month and year boundaries', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDate('2025-12-31', 1)).toBe('2026-01-01')
  })

  it('handles leap years', () => {
    expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29')
    expect(shiftDate('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('crosses DST transitions without dropping or repeating a day', () => {
    // US DST starts 2026-03-08 and ends 2026-11-01.
    expect(shiftDate('2026-03-08', 1)).toBe('2026-03-09')
    expect(shiftDate('2026-11-01', 1)).toBe('2026-11-02')
    expect(shiftDate('2026-03-07', 7)).toBe('2026-03-14')
  })

  it('round-trips', () => {
    expect(shiftDate(shiftDate('2026-07-05', 40), -40)).toBe('2026-07-05')
  })
})

describe('fmt', () => {
  it('formats whole numbers without decimals', () => {
    expect(fmt(0)).toBe('0')
    expect(fmt(42)).toBe('42')
  })

  it('formats decimals to the requested precision', () => {
    expect(fmt(1.25)).toBe('1.3')
    expect(fmt(1.25, 2)).toBe('1.25')
  })

  it('abbreviates thousands', () => {
    expect(fmt(1500)).toBe('1.5k')
  })
})
