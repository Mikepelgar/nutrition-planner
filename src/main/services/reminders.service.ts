import { Notification } from 'electron'
import log from 'electron-log/main'
import { getDb } from '../db/database'
import { getSetting } from '../db/settings.helpers'
import type { ReminderPrefs } from '../../renderer/src/lib/types'

export const DEFAULT_REMINDERS: ReminderPrefs = {
  enabled: false,
  mealsEnabled: true,
  meals: { breakfast: '08:00', lunch: '12:30', dinner: '18:30' },
  waterEnabled: false,
  waterIntervalHours: 2
}

export function getReminderPrefs(): ReminderPrefs {
  try {
    const raw = getSetting(getDb(), 'reminders')
    return raw ? { ...DEFAULT_REMINDERS, ...JSON.parse(raw) } : DEFAULT_REMINDERS
  } catch {
    return DEFAULT_REMINDERS
  }
}

let timer: NodeJS.Timeout | null = null
let lastFiredMinute = ''
let lastWaterHour = -1

function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body }).show()
}

function tick(): void {
  let prefs: ReminderPrefs
  try {
    prefs = getReminderPrefs()
  } catch {
    return
  }
  if (!prefs.enabled) return

  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const hhmm = `${hh}:${mm}`

  if (hhmm !== lastFiredMinute) {
    if (prefs.mealsEnabled) {
      if (hhmm === prefs.meals.breakfast) notify('Breakfast time', 'Log your breakfast in Nutrition Planner.')
      if (hhmm === prefs.meals.lunch) notify('Lunch time', 'Log your lunch in Nutrition Planner.')
      if (hhmm === prefs.meals.dinner) notify('Dinner time', 'Log your dinner in Nutrition Planner.')
    }
    lastFiredMinute = hhmm
  }

  // Water: fire once on entering a qualifying waking hour.
  const h = now.getHours()
  if (prefs.waterEnabled && h >= 8 && h <= 21) {
    const interval = Math.max(1, Math.floor(prefs.waterIntervalHours))
    if (h !== lastWaterHour && (h - 8) % interval === 0) {
      notify('Hydration reminder', 'Time for a glass of water 💧')
      lastWaterHour = h
    }
  }
}

export function startReminders(): void {
  if (timer) return
  // 30s cadence guarantees each minute is observed at least once for meal times.
  timer = setInterval(tick, 30_000)
  log.info('Reminders scheduler started')
}
