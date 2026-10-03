/**
 * Normalizes a typed or scanned barcode to the form stored in `food.gtin_upc`.
 *
 * The USDA import stored GTINs as numbers, so every leading zero was dropped:
 * the Coke Zero can printed `049000042566` is stored as `49000042566`. The same
 * product can also be written as UPC-A (12 digits), EAN-13 or GTIN-14, which
 * differ only by leading zeros. Stripping them on the way in makes all of those
 * forms match the stored value.
 *
 * Returns null for input that cannot be a barcode (no digits, or longer than a
 * GTIN-14), so the caller can skip the query.
 */
export function normalizeBarcode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(digits)) return null
  const trimmed = digits.replace(/^0+/, '')
  if (!trimmed || trimmed.length > 14) return null
  return trimmed
}
