import type Database from 'better-sqlite3'
import type { WeightEntry } from '../../../renderer/src/lib/types'

// ---- Weight ----

export function setWeight(db: Database.Database, date: string, weightKg: number): void {
  db.prepare(`
    INSERT INTO weight_log (date, weight_kg) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg
  `).run(date, weightKg)
}

export function getWeightRange(db: Database.Database, startDate: string, endDate: string): WeightEntry[] {
  return db.prepare(`
    SELECT date, weight_kg AS weightKg
    FROM weight_log
    WHERE date BETWEEN ? AND ?
    ORDER BY date ASC
  `).all(startDate, endDate) as WeightEntry[]
}

export function getLatestWeight(db: Database.Database): WeightEntry | null {
  const row = db.prepare(`
    SELECT date, weight_kg AS weightKg FROM weight_log ORDER BY date DESC LIMIT 1
  `).get() as WeightEntry | undefined
  return row ?? null
}

// ---- Water (ml per day) ----

export function getWater(db: Database.Database, date: string): number {
  const row = db.prepare('SELECT ml FROM water_log WHERE date = ?').get(date) as { ml: number } | undefined
  return row?.ml ?? 0
}

export function getWaterRange(
  db: Database.Database,
  startDate: string,
  endDate: string
): Array<{ date: string; ml: number }> {
  return db.prepare(
    'SELECT date, ml FROM water_log WHERE date BETWEEN ? AND ? ORDER BY date ASC'
  ).all(startDate, endDate) as Array<{ date: string; ml: number }>
}

/** Add (or subtract) ml to the day's total, clamped at 0. Returns the new total. */
export function addWater(db: Database.Database, date: string, deltaMl: number): number {
  const current = getWater(db, date)
  const next = Math.max(0, current + deltaMl)
  db.prepare(`
    INSERT INTO water_log (date, ml, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(date) DO UPDATE SET ml = excluded.ml, updated_at = datetime('now')
  `).run(date, next)
  return next
}
