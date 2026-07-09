/**
 * Lightweight runtime validation for IPC payloads. Prepared statements already
 * prevent SQL injection and the app is local/single-user, but validating at the
 * boundary defends against crashes/abuse from malformed input (renderer bugs,
 * tampering) before it reaches SQL or the filesystem.
 */

export function asString(v: unknown, field: string, maxLen = 1000): string {
  if (typeof v !== 'string') throw new Error(`Invalid ${field}: expected string`)
  if (v.length > maxLen) throw new Error(`Invalid ${field}: exceeds ${maxLen} chars`)
  return v
}

export function asNumber(v: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) throw new Error(`Invalid ${field}: expected number`)
  if (opts.min != null && n < opts.min) throw new Error(`Invalid ${field}: below ${opts.min}`)
  if (opts.max != null && n > opts.max) throw new Error(`Invalid ${field}: above ${opts.max}`)
  return n
}

export function asInt(v: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
  const n = asNumber(v, field, opts)
  if (!Number.isInteger(n)) throw new Error(`Invalid ${field}: expected integer`)
  return n
}

export function asEnum<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    throw new Error(`Invalid ${field}: must be one of ${allowed.join(', ')}`)
  }
  return v as T
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export function asDate(v: unknown, field: string): string {
  const s = asString(v, field, 10)
  if (!ISO_DATE.test(s)) throw new Error(`Invalid ${field}: expected YYYY-MM-DD`)
  return s
}

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const

/** Runtime mirror of the renderer's ServingUnit union (types are erased at the boundary). */
export const SERVING_UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'fl_oz', 'cup', 'tbsp', 'tsp', 'serving'] as const
