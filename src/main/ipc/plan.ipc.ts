import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getOrCreatePlan, getPlanEntries, addPlanEntry, updatePlanEntry, deletePlanEntry, copyEntries } from '../db/queries/plan.queries'
import { getFoodDetail } from '../db/queries/food.queries'
import type { ServingUnit, MealType } from '../../renderer/src/lib/types'
import { asDate, asEnum, MEALS } from './validate'

export function registerPlanIPC(): void {
  ipcMain.handle('plan:getOrCreate', (_event, payload: { date: string }) => {
    return getOrCreatePlan(getDb(), payload.date)
  })

  ipcMain.handle('plan:getEntries', (_event, payload: { planId: number }) => {
    return getPlanEntries(getDb(), payload.planId)
  })

  ipcMain.handle('plan:addEntry', (_event, payload: {
    planId: number
    fdcId: number
    servingUnit: ServingUnit
    servingAmount: number
    grams: number
    meal?: MealType
  }) => {
    const db = getDb()
    const food = getFoodDetail(db, payload.fdcId)
    if (!food) throw new Error(`Food ${payload.fdcId} not found`)
    return addPlanEntry(db, {
      planId: payload.planId,
      fdcId: payload.fdcId,
      foodDescription: food.description,
      servingUnit: payload.servingUnit,
      servingAmount: payload.servingAmount,
      grams: payload.grams,
      meal: payload.meal ?? 'snack'
    })
  })

  ipcMain.handle('plan:updateEntry', (_event, payload: {
    entryId: number
    servingUnit: ServingUnit
    servingAmount: number
    grams: number
    meal?: MealType
  }) => {
    const meal = payload.meal != null ? asEnum(payload.meal, 'meal', MEALS) : undefined
    return updatePlanEntry(getDb(), { ...payload, meal })
  })

  ipcMain.handle('plan:deleteEntry', (_event, payload: { entryId: number }) => {
    deletePlanEntry(getDb(), payload.entryId)
    return { success: true }
  })

  ipcMain.handle('plan:copyDay', (_event, payload: { sourceDate: string; targetDate: string }) => {
    const db = getDb()
    const source = getOrCreatePlan(db, asDate(payload?.sourceDate, 'sourceDate'))
    const target = getOrCreatePlan(db, asDate(payload?.targetDate, 'targetDate'))
    copyEntries(db, source.id, target.id)
    return { success: true }
  })
}
