import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import {
  listSavedMeals, createSavedMealFromEntries, logSavedMeal, deleteSavedMeal
} from '../db/queries/savedMeal.queries'
import type { MealType } from '../../renderer/src/lib/types'

export function registerSavedMealIPC(): void {
  ipcMain.handle('savedmeal:list', () => listSavedMeals(getDb()))
  ipcMain.handle('savedmeal:createFromDay', (_e, p: { name: string; planId: number; meal?: MealType }) =>
    ({ id: createSavedMealFromEntries(getDb(), p.name, p.planId, p.meal) })
  )
  ipcMain.handle('savedmeal:log', (_e, p: { planId: number; savedMealId: number; meal: MealType }) => {
    logSavedMeal(getDb(), p.planId, p.savedMealId, p.meal)
    return { success: true }
  })
  ipcMain.handle('savedmeal:delete', (_e, p: { id: number }) => {
    deleteSavedMeal(getDb(), p.id)
    return { success: true }
  })
}
