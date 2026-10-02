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
  /** kcal burned via exercise on `date` — raises that day's targets. */
  burnedKcal: number
  loading: boolean

  loadDay: (date: string) => Promise<void>
  refreshBurned: () => Promise<void>
  addEntry: (food: FoodDetail, servingUnit: ServingUnit, servingAmount: number) => Promise<void>
  updateEntry: (entryId: number, food: FoodDetail, servingUnit: ServingUnit, servingAmount: number) => Promise<void>
  setEntryMeal: (entryId: number, meal: MealType) => Promise<void>
  deleteEntry: (entryId: number) => Promise<void>
  cacheFood: (food: FoodDetail) => void
  copyFrom: (sourceDate: string) => Promise<void>
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
  burnedKcal: 0,
  loading: false,

  loadDay: async (date) => {
    set({ loading: true, date })
    const [plan, burned] = await Promise.all([
      window.api.planGetOrCreate({ date }),
      window.api.exerciseCaloriesForDate({ date })
    ])
    const entries = await window.api.planGetEntries({ planId: plan.id })

    // Fetch food details for any uncached entries — in parallel, one request
    // per unique food (the old serial loop was one IPC round-trip per entry).
    const cache = new Map(get().foodCache)
    const missingIds = [...new Set(entries.map(e => e.fdcId))].filter(id => !cache.has(id))
    const details = await Promise.all(missingIds.map(fdcId => window.api.foodDetail({ fdcId })))
    for (const detail of details) {
      if (detail) cache.set(detail.fdcId, detail)
    }

    set({
      plan, entries, foodCache: cache, nutrientTotals: computeTotals(entries, cache),
      burnedKcal: burned.calories, loading: false
    })
  },

  refreshBurned: async () => {
    const { date } = get()
    const { calories } = await window.api.exerciseCaloriesForDate({ date })
    if (get().date === date) set({ burnedKcal: calories })
  },

  addEntry: async (food, servingUnit, servingAmount) => {
    const { plan, entries, foodCache } = get()
    if (!plan) return
    const grams = toGrams(servingAmount, servingUnit, food)
    // Meal label defaults to the time of day the entry is LOGGED (evaluating
    // at store creation froze the label at app-launch time).
    const entry = await window.api.planAddEntry({ planId: plan.id, fdcId: food.fdcId, servingUnit, servingAmount, grams, meal: defaultMeal() })
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

  setEntryMeal: async (entryId, meal) => {
    const { entries } = get()
    const current = entries.find(e => e.id === entryId)
    if (!current || current.meal === meal) return
    const updated = await window.api.planUpdateEntry({
      entryId,
      servingUnit: current.servingUnit,
      servingAmount: current.servingAmount,
      grams: current.grams,
      meal
    })
    set({ entries: get().entries.map(e => e.id === entryId ? updated : e) })
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

  copyFrom: async (sourceDate) => {
    const { date } = get()
    await window.api.planCopyDay({ sourceDate, targetDate: date })
    await get().loadDay(date)
  }
}))
