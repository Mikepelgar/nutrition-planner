import { create } from 'zustand'
import type { Plan, PlanEntry, FoodDetail, NutrientTotal, ServingUnit, MealType } from '../lib/types'
import { toGrams } from '../lib/unitConversion'
import { todayIso } from '../lib/formatters'

/** Sensible default meal based on the current time of day. */
export function defaultMeal(): MealType {
  const h = new Date().getHours()
  if (h >= 4 && h < 11) return 'breakfast'
  if (h >= 11 && h < 16) return 'lunch'
  if (h >= 16 && h < 21) return 'dinner'
  return 'snack'
}

interface PlanState {
  date: string
  plan: Plan | null
  entries: PlanEntry[]
  foodCache: Map<number, FoodDetail>
  nutrientTotals: NutrientTotal[]
  loading: boolean
  activeMeal: MealType

  loadDay: (date: string) => Promise<void>
  addEntry: (food: FoodDetail, servingUnit: ServingUnit, servingAmount: number) => Promise<void>
  updateEntry: (entryId: number, food: FoodDetail, servingUnit: ServingUnit, servingAmount: number) => Promise<void>
  deleteEntry: (entryId: number) => Promise<void>
  cacheFood: (food: FoodDetail) => void
  setActiveMeal: (meal: MealType) => void
  logSavedMeal: (savedMealId: number, meal?: MealType) => Promise<void>
  saveMealAsRecipe: (name: string, meal?: MealType) => Promise<number | null>
  copyFrom: (sourceDate: string, meal?: MealType) => Promise<void>
}

function computeTotals(entries: PlanEntry[], foodCache: Map<number, FoodDetail>): NutrientTotal[] {
  const totals = new Map<number, NutrientTotal>()

  for (const entry of entries) {
    const food = foodCache.get(entry.fdcId)
    if (!food) continue
    for (const n of food.nutrients) {
      const intake = (entry.grams / 100) * n.amount
      const existing = totals.get(n.nutrientId)
      if (existing) {
        existing.intake += intake
      } else {
        totals.set(n.nutrientId, { nutrientId: n.nutrientId, name: n.name, unit: n.unit, intake })
      }
    }
  }

  return Array.from(totals.values())
}

export const usePlanStore = create<PlanState>((set, get) => ({
  date: todayIso(),
  plan: null,
  entries: [],
  foodCache: new Map(),
  nutrientTotals: [],
  loading: false,
  activeMeal: defaultMeal(),

  loadDay: async (date) => {
    set({ loading: true, date })
    const plan = await window.api.planGetOrCreate({ date })
    const entries = await window.api.planGetEntries({ planId: plan.id })

    // Fetch food details for any uncached entries
    const cache = new Map(get().foodCache)
    for (const entry of entries) {
      if (!cache.has(entry.fdcId)) {
        const detail = await window.api.foodDetail({ fdcId: entry.fdcId })
        if (detail) cache.set(entry.fdcId, detail)
      }
    }

    set({ plan, entries, foodCache: cache, nutrientTotals: computeTotals(entries, cache), loading: false })
  },

  addEntry: async (food, servingUnit, servingAmount) => {
    const { plan, entries, foodCache, activeMeal } = get()
    if (!plan) return
    const grams = toGrams(servingAmount, servingUnit, food)
    const entry = await window.api.planAddEntry({ planId: plan.id, fdcId: food.fdcId, servingUnit, servingAmount, grams, meal: activeMeal })
    const newCache = new Map(foodCache)
    newCache.set(food.fdcId, food)
    const newEntries = [...entries, entry]
    set({ entries: newEntries, foodCache: newCache, nutrientTotals: computeTotals(newEntries, newCache) })
  },

  updateEntry: async (entryId, food, servingUnit, servingAmount) => {
    const { entries, foodCache } = get()
    const grams = toGrams(servingAmount, servingUnit, food)
    const updated = await window.api.planUpdateEntry({ entryId, servingUnit, servingAmount, grams })
    const newCache = new Map(foodCache)
    newCache.set(food.fdcId, food)
    const newEntries = entries.map(e => e.id === entryId ? updated : e)
    set({ entries: newEntries, foodCache: newCache, nutrientTotals: computeTotals(newEntries, newCache) })
  },

  deleteEntry: async (entryId) => {
    await window.api.planDeleteEntry({ entryId })
    const { entries, foodCache } = get()
    const newEntries = entries.filter(e => e.id !== entryId)
    set({ entries: newEntries, nutrientTotals: computeTotals(newEntries, foodCache) })
  },

  cacheFood: (food) => {
    const cache = new Map(get().foodCache)
    cache.set(food.fdcId, food)
    set({ foodCache: cache })
  },

  setActiveMeal: (meal) => set({ activeMeal: meal }),

  logSavedMeal: async (savedMealId, meal) => {
    const { plan, date, activeMeal } = get()
    if (!plan) return
    await window.api.savedMealLog({ planId: plan.id, savedMealId, meal: meal ?? activeMeal })
    await get().loadDay(date)
  },

  saveMealAsRecipe: async (name, meal) => {
    const { plan } = get()
    if (!plan) return null
    const res = await window.api.savedMealCreateFromDay({ name, planId: plan.id, meal })
    return res.id
  },

  copyFrom: async (sourceDate, meal) => {
    const { date } = get()
    if (meal) await window.api.planCopyMeal({ sourceDate, meal, targetDate: date })
    else await window.api.planCopyDay({ sourceDate, targetDate: date })
    await get().loadDay(date)
  }
}))
