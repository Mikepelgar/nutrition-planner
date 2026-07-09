import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { getOrCreatePlan, getPlanEntries, addPlanEntry, updatePlanEntry, deletePlanEntry, copyEntries } from '../db/queries/plan.queries'
import { getFoodDetail } from '../db/queries/food.queries'
import type { ServingUnit, MealType } from '../../renderer/src/lib/types'
import { asDate, asEnum, asInt, asNumber, MEALS, SERVING_UNITS } from './validate'

const MAX_GRAMS = 100_000 // guards NaN/garbage; 100 kg in one entry is already absurd

export function registerPlanIPC(): void {
  ipcMain.handle('plan:getOrCreate', (_event, payload: { date: string }) => {
    return getOrCreatePlan(getDb(), asDate(payload?.date, 'date'))
  })

  ipcMain.handle('plan:getEntries', (_event, payload: { planId: number }) => {
    return getPlanEntries(getDb(), asInt(payload?.planId, 'planId'))
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
    const fdcId = asInt(payload?.fdcId, 'fdcId')
    const food = getFoodDetail(db, fdcId)
    if (!food) throw new Error(`Food ${fdcId} not found`)
    return addPlanEntry(db, {
      planId: asInt(payload.planId, 'planId'),
      fdcId,
      foodDescription: food.description,
      servingUnit: asEnum(payload.servingUnit, 'servingUnit', SERVING_UNITS),
      servingAmount: asNumber(payload.servingAmount, 'servingAmount', { min: 0, max: MAX_GRAMS }),
      grams: asNumber(payload.grams, 'grams', { min: 0, max: MAX_GRAMS }),
      meal: asEnum(payload.meal ?? 'snack', 'meal', MEALS)
    })
  })

  ipcMain.handle('plan:updateEntry', (_event, payload: {
    entryId: number
    servingUnit: ServingUnit
    servingAmount: number
    grams: number
    meal?: MealType
  }) => {
    return updatePlanEntry(getDb(), {
      entryId: asInt(payload?.entryId, 'entryId'),
      servingUnit: asEnum(payload?.servingUnit, 'servingUnit', SERVING_UNITS),
      servingAmount: asNumber(payload?.servingAmount, 'servingAmount', { min: 0, max: MAX_GRAMS }),
      grams: asNumber(payload?.grams, 'grams', { min: 0, max: MAX_GRAMS }),
      meal: payload?.meal != null ? asEnum(payload.meal, 'meal', MEALS) : undefined
    })
  })

  ipcMain.handle('plan:deleteEntry', (_event, payload: { entryId: number }) => {
    deletePlanEntry(getDb(), asInt(payload?.entryId, 'entryId'))
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
