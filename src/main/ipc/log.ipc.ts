import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getDailyLogs, getNutrientBreakdown } from '../db/queries/log.queries'
import { asDate } from './validate'

export function registerLogIPC(): void {
  ipcMain.handle('log:getDailyLogs', (_event, payload: { startDate: string; endDate: string }) => {
    return getDailyLogs(getDb(), asDate(payload?.startDate, 'startDate'), asDate(payload?.endDate, 'endDate'))
  })

  ipcMain.handle('log:getNutrientBreakdown', (_event, payload: { startDate: string; endDate: string }) => {
    return getNutrientBreakdown(getDb(), asDate(payload?.startDate, 'startDate'), asDate(payload?.endDate, 'endDate'))
  })
}
