import { describe, it, expect } from 'vitest'
import { normalizeBarcode } from './barcode'

describe('normalizeBarcode', () => {
  it('strips the leading zero the import dropped (UPC-A as printed)', () =>
    expect(normalizeBarcode('049000042566')).toBe('49000042566'))

  it('matches the same product written as EAN-13 or GTIN-14', () => {
    expect(normalizeBarcode('0049000042566')).toBe('49000042566')
    expect(normalizeBarcode('00049000042566')).toBe('49000042566')
  })

  it('leaves codes without leading zeros unchanged', () =>
    expect(normalizeBarcode('894700010137')).toBe('894700010137'))

  it('ignores spaces and dashes', () => {
    expect(normalizeBarcode(' 0 49000-04256 6 ')).toBe('49000042566')
  })

  it('rejects input that cannot be a barcode', () => {
    expect(normalizeBarcode('')).toBeNull()
    expect(normalizeBarcode('0000')).toBeNull()
    expect(normalizeBarcode('coke zero')).toBeNull()
    expect(normalizeBarcode('12345678901234567')).toBeNull()
  })
})
