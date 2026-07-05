import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getRecentFoods } from '../db/queries/quickadd.queries'
import { asDate } from './validate'

export function registerQuickAddIPC(): void {
  ipcMain.handle('quickadd:getRecent', (_event, payload?: { cutoffDate?: string }) => {
    const cutoffDate = payload?.cutoffDate != null ? asDate(payload.cutoffDate, 'cutoffDate') : undefined
    return getRecentFoods(getDb(), { cutoffDate })
  })
}
