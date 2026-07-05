import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getFavorites, getFavoriteIds, toggleFavorite } from '../db/queries/favorites.queries'
import type { QuickAddItem } from '../db/queries/quickadd.queries'

export function registerFavoritesIPC(): void {
  ipcMain.handle('favorites:get', () => getFavorites(getDb()))

  ipcMain.handle('favorites:getIds', () => getFavoriteIds(getDb()))

  ipcMain.handle('favorites:toggle', (_event, item: Pick<QuickAddItem, 'fdcId' | 'foodDescription' | 'servingUnit' | 'servingAmount' | 'grams'>) => {
    return { isFavorite: toggleFavorite(getDb(), item) }
  })
}
