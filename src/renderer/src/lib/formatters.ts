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

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const d = new Date(year, month - 1, day + days)
  return d.toISOString().slice(0, 10)
}
