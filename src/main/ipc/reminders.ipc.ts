import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { setSetting } from '../db/settings.helpers'
import { getReminderPrefs, DEFAULT_REMINDERS } from '../services/reminders.service'
import type { ReminderPrefs } from '../../renderer/src/lib/types'

const TIME_RE = /^\d{2}:\d{2}$/

/**
 * Lenient shape-sanitize: booleans coerced strictly, malformed times fall back
 * to the defaults (a cleared <input type="time"> yields ''), interval clamped.
 * Never throws — a reminder pref should never be able to fail to save.
 */
function sanitizePrefs(p: ReminderPrefs): ReminderPrefs {
  const time = (v: unknown, fallback: string): string =>
    typeof v === 'string' && TIME_RE.test(v) ? v : fallback
  const rawInterval = Number(p?.waterIntervalHours)
  const interval = Number.isFinite(rawInterval)
    ? Math.min(Math.max(1, Math.floor(rawInterval)), 12)
    : DEFAULT_REMINDERS.waterIntervalHours

  return {
    enabled: p?.enabled === true,
    mealsEnabled: p?.mealsEnabled === true,
    meals: {
      breakfast: time(p?.meals?.breakfast, DEFAULT_REMINDERS.meals.breakfast),
      lunch: time(p?.meals?.lunch, DEFAULT_REMINDERS.meals.lunch),
      dinner: time(p?.meals?.dinner, DEFAULT_REMINDERS.meals.dinner)
    },
    waterEnabled: p?.waterEnabled === true,
    waterIntervalHours: interval
  }
}

export function registerRemindersIPC(): void {
  ipcMain.handle('reminders:get', () => getReminderPrefs())
  ipcMain.handle('reminders:set', (_e, prefs: ReminderPrefs) => {
    setSetting(getDb(), 'reminders', JSON.stringify(sanitizePrefs(prefs)))
    return { success: true }
  })
}
