import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getFavorites, getFavoriteIds, toggleFavorite } from '../db/queries/favorites.queries'
import type { QuickAddItem } from '../db/queries/quickadd.queries'
import { asEnum, asInt, asNumber, asString, SERVING_UNITS } from './validate'

export function registerFavoritesIPC(): void {
  ipcMain.handle('favorites:get', () => getFavorites(getDb()))

  ipcMain.handle('favorites:getIds', () => getFavoriteIds(getDb()))

  ipcMain.handle('favorites:toggle', (_event, item: Pick<QuickAddItem, 'fdcId' | 'foodDescription' | 'servingUnit' | 'servingAmount' | 'grams'>) => {
    const validated = {
      fdcId: asInt(item?.fdcId, 'fdcId'),
      foodDescription: asString(item?.foodDescription, 'foodDescription', 500),
      servingUnit: asEnum(item?.servingUnit, 'servingUnit', SERVING_UNITS),
      servingAmount: asNumber(item?.servingAmount, 'servingAmount', { min: 0, max: 100_000 }),
      grams: asNumber(item?.grams, 'grams', { min: 0, max: 100_000 })
    }
    return { isFavorite: toggleFavorite(getDb(), validated) }
  })
}
