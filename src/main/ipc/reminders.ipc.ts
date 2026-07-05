import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { setSetting } from '../db/settings.helpers'
import { getReminderPrefs } from '../services/reminders.service'
import type { ReminderPrefs } from '../../renderer/src/lib/types'

export function registerRemindersIPC(): void {
  ipcMain.handle('reminders:get', () => getReminderPrefs())
  ipcMain.handle('reminders:set', (_e, prefs: ReminderPrefs) => {
    setSetting(getDb(), 'reminders', JSON.stringify(prefs))
    return { success: true }
  })
}
