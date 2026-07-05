import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getDailyLogs, getNutrientBreakdown } from '../db/queries/log.queries'

export function registerLogIPC(): void {
  ipcMain.handle('log:getDailyLogs', (_event, payload: { startDate: string; endDate: string }) => {
    return getDailyLogs(getDb(), payload.startDate, payload.endDate)
  })

  ipcMain.handle('log:getNutrientBreakdown', (_event, payload: { startDate: string; endDate: string }) => {
    return getNutrientBreakdown(getDb(), payload.startDate, payload.endDate)
  })
}
