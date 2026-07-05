import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getRecentFoods } from '../db/queries/quickadd.queries'

export function registerQuickAddIPC(): void {
  ipcMain.handle('quickadd:getRecent', (_event, payload?: { cutoffDate?: string }) => {
    return getRecentFoods(getDb(), { cutoffDate: payload?.cutoffDate })
  })
}
