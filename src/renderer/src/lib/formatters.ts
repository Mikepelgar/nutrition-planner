export function fmt(value: number, decimals = 1): string {
  if (value === 0) return '0'
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return value % 1 === 0 ? String(Math.round(value)) : value.toFixed(decimals)
}

export function fmtDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Format a Date as YYYY-MM-DD using LOCAL date parts. Never use
 * `toISOString().slice(0, 10)` for calendar dates — it returns the UTC date,
 * which is a different day than the user's around midnight (e.g. evening in
 * UTC-5 is already "tomorrow" in UTC, so food logged at 8pm landed on the
 * wrong day).
 */
export function localIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIso(): string {
  return localIso(new Date())
}

export function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return localIso(new Date(year, month - 1, day + days))
}
