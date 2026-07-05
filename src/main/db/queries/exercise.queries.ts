import type Database from 'better-sqlite3'
import type { Exercise } from '../../../renderer/src/lib/types'

export function addExercise(
  db: Database.Database,
  payload: { date: string; name: string; caloriesBurned: number; durationMin?: number | null }
): Exercise {
  return db.prepare(`
    INSERT INTO exercise (date, name, calories_burned, duration_min)
    VALUES (?, ?, ?, ?)
    RETURNING id, date, name, calories_burned AS caloriesBurned, duration_min AS durationMin
  `).get(payload.date, payload.name, payload.caloriesBurned, payload.durationMin ?? null) as Exercise
}

export function getExercisesForDate(db: Database.Database, date: string): Exercise[] {
  return db.prepare(`
    SELECT id, date, name, calories_burned AS caloriesBurned, duration_min AS durationMin
    FROM exercise WHERE date = ? ORDER BY id ASC
  `).all(date) as Exercise[]
}

export function deleteExercise(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM exercise WHERE id = ?').run(id)
}

export function getCaloriesBurnedForDate(db: Database.Database, date: string): number {
  const row = db.prepare('SELECT COALESCE(SUM(calories_burned), 0) AS c FROM exercise WHERE date = ?').get(date) as { c: number }
  return Math.round(row.c)
}

/** Daily calorie-burn totals over a window (for trends). */
export function getExerciseRange(
  db: Database.Database,
  startDate: string,
  endDate: string
): Array<{ date: string; calories: number }> {
  return db.prepare(`
    SELECT date, ROUND(SUM(calories_burned)) AS calories
    FROM exercise WHERE date BETWEEN ? AND ?
    GROUP BY date ORDER BY date ASC
  `).all(startDate, endDate) as Array<{ date: string; calories: number }>
}
