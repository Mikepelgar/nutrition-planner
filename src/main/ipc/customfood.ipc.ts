import { ipcMain } from 'electron'
import { getDb } from '../db/database'
import { createCustomFood, listCustomFoods, deleteCustomFood, type CustomFoodInput } from '../db/queries/customFood.queries'
import { asString, asNumber, asInt } from './validate'

function validateCustomFood(raw: CustomFoodInput): CustomFoodInput {
  const opt = (v: unknown, f: string): number | undefined =>
    v == null || v === ('' as unknown) ? undefined : asNumber(v, f, { min: 0, max: 100000 })
  return {
    name: asString(raw?.name, 'name', 200).trim(),
    servingG: asNumber(raw?.servingG, 'servingG', { min: 0.1, max: 100000 }),
    calories: asNumber(raw?.calories, 'calories', { min: 0, max: 100000 }),
    proteinG: asNumber(raw?.proteinG, 'proteinG', { min: 0, max: 100000 }),
    carbsG: asNumber(raw?.carbsG, 'carbsG', { min: 0, max: 100000 }),
    fatG: asNumber(raw?.fatG, 'fatG', { min: 0, max: 100000 }),
    fiberG: opt(raw?.fiberG, 'fiberG'),
    sodiumMg: opt(raw?.sodiumMg, 'sodiumMg'),
    sugarG: opt(raw?.sugarG, 'sugarG')
  }
}

export function registerCustomFoodIPC(): void {
  ipcMain.handle('customfood:create', (_e, input: CustomFoodInput) => {
    const v = validateCustomFood(input)
    if (!v.name) throw new Error('Custom food requires a name')
    return { fdcId: createCustomFood(getDb(), v) }
  })
  ipcMain.handle('customfood:list', () => listCustomFoods(getDb()))
  ipcMain.handle('customfood:delete', (_e, p: { fdcId: number }) => deleteCustomFood(getDb(), asInt(p?.fdcId, 'fdcId')))
}
