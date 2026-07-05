import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { searchFoods, getFoodDetail, findFoodByBarcode } from '../db/queries/food.queries'
import { asString, asInt } from './validate'

export function registerFoodIPC(): void {
  ipcMain.handle('food:search', (_event, payload: { query: string; limit?: number; offset?: number }) => {
    const limit = payload?.limit == null ? undefined : asInt(payload.limit, 'limit', { min: 1, max: 100 })
    return searchFoods(getDb(), asString(payload?.query, 'query', 200), limit)
  })

  ipcMain.handle('food:detail', (_event, payload: { fdcId: number }) => {
    return getFoodDetail(getDb(), asInt(payload?.fdcId, 'fdcId'))
  })

  ipcMain.handle('food:byBarcode', (_event, payload: { upc: string }) => {
    return findFoodByBarcode(getDb(), asString(payload?.upc, 'upc', 64))
  })
}
