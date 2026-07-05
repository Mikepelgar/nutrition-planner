import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { setWeight, getWeightRange, getLatestWeight, getWater, getWaterRange, addWater } from '../db/queries/tracking.queries'
import { asDate, asNumber } from './validate'

export function registerTrackingIPC(): void {
  ipcMain.handle('weight:set', (_e, p: { date: string; weightKg: number }) => {
    setWeight(getDb(), asDate(p?.date, 'date'), asNumber(p?.weightKg, 'weightKg', { min: 1, max: 1000 }))
    return { success: true }
  })
  ipcMain.handle('weight:getRange', (_e, p: { startDate: string; endDate: string }) =>
    getWeightRange(getDb(), asDate(p?.startDate, 'startDate'), asDate(p?.endDate, 'endDate'))
  )
  ipcMain.handle('weight:latest', () => getLatestWeight(getDb()))
  ipcMain.handle('water:get', (_e, p: { date: string }) => ({ ml: getWater(getDb(), asDate(p?.date, 'date')) }))
  ipcMain.handle('water:getRange', (_e, p: { startDate: string; endDate: string }) =>
    getWaterRange(getDb(), asDate(p?.startDate, 'startDate'), asDate(p?.endDate, 'endDate'))
  )
  ipcMain.handle('water:add', (_e, p: { date: string; deltaMl: number }) => ({
    ml: addWater(getDb(), asDate(p?.date, 'date'), asNumber(p?.deltaMl, 'deltaMl', { min: -5000, max: 5000 }))
  }))
}
