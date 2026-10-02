import type {
  FoodSearchResult,
  FoodDetail,
  Plan,
  PlanEntry,
  UserProfile,
  ServingUnit,
  MealType,
  WeightEntry,
  Exercise,
  ReminderPrefs
} from '../renderer/src/lib/types'
import type { LogProposal } from '../shared/logProposal'
import type { DailyLogEntry, NutrientBreakdownEntry } from '../main/db/queries/log.queries'
import type { QuickAddItem } from '../main/db/queries/quickadd.queries'
import type { FavoriteItem } from '../main/db/queries/favorites.queries'
import type { CoachContext, ChatTurn } from '../shared/aiContext'
import type { AiErrorCode } from '../shared/aiErrors'

declare global {
  interface Window {
    api: {
      foodSearch(payload: { query: string; limit?: number; offset?: number }): Promise<FoodSearchResult[]>
      foodDetail(payload: { fdcId: number }): Promise<FoodDetail>
      foodByBarcode(payload: { upc: string }): Promise<FoodDetail | null>

      planGetOrCreate(payload: { date: string }): Promise<Plan>
      planGetEntries(payload: { planId: number }): Promise<PlanEntry[]>
      planAddEntry(payload: {
        planId: number
        fdcId: number
        servingUnit: ServingUnit
        servingAmount: number
        grams: number
        meal?: MealType
      }): Promise<PlanEntry>
      planUpdateEntry(payload: {
        entryId: number
        servingUnit: ServingUnit
        servingAmount: number
        grams: number
        meal?: MealType
      }): Promise<PlanEntry>
      planDeleteEntry(payload: { entryId: number }): Promise<{ success: boolean }>
      planCopyDay(payload: { sourceDate: string; targetDate: string }): Promise<{ success: boolean }>

      profileGet(): Promise<UserProfile | null>
      profileSave(profile: UserProfile): Promise<UserProfile>

      aiStartStream(payload: {
        messageId: string
        prompt: string
        mode: string
        style: string
        budgetMode?: boolean
        easyPrepMode?: boolean
        date: string
        history?: ChatTurn[]
      }): Promise<void>
      aiCancelStream(payload: { messageId: string }): Promise<void>
      aiWeeklyReview(payload: { messageId: string; date: string }): Promise<void>
      aiPlanDay(payload: {
        messageId: string
        date: string
        mode?: string
        style?: string
        budgetMode?: boolean
        easyPrepMode?: boolean
      }): Promise<void>
      aiGetContext(payload: {
        date: string
        mode: string
        style: string
        budgetMode?: boolean
        easyPrepMode?: boolean
      }): Promise<CoachContext>
      aiStatus(): Promise<{
        configured: boolean
        signedIn: boolean
        usage: { dailyUsed: number; dailyLimit: number; monthlyUsed: number; monthlyLimit: number } | null
      }>

      authSignIn(payload: { provider: 'google' | 'github' }): Promise<{ success: boolean }>
      authSignOut(): Promise<{ success: boolean }>
      authStatus(): Promise<{ signedIn: boolean; email: string | null; configured: boolean }>

      quickAddGetRecent(payload?: { cutoffDate?: string }): Promise<QuickAddItem[]>
      favoritesGet(): Promise<FavoriteItem[]>
      favoritesGetIds(): Promise<number[]>
      favoritesToggle(payload: { fdcId: number; foodDescription: string; servingUnit: string; servingAmount: number; grams: number }): Promise<{ isFavorite: boolean }>

      logGetDailyLogs(payload: { startDate: string; endDate: string }): Promise<DailyLogEntry[]>
      logGetNutrientBreakdown(payload: { startDate: string; endDate: string }): Promise<NutrientBreakdownEntry[]>

      weightSet(payload: { date: string; weightKg: number }): Promise<{ success: boolean }>
      weightGetRange(payload: { startDate: string; endDate: string }): Promise<WeightEntry[]>
      weightLatest(): Promise<WeightEntry | null>
      waterGet(payload: { date: string }): Promise<{ ml: number }>
      waterGetRange(payload: { startDate: string; endDate: string }): Promise<Array<{ date: string; ml: number }>>
      waterAdd(payload: { date: string; deltaMl: number }): Promise<{ ml: number }>

      exerciseAdd(payload: { date: string; name: string; caloriesBurned: number; durationMin?: number }): Promise<Exercise>
      exerciseGetForDate(payload: { date: string }): Promise<Exercise[]>
      exerciseDelete(payload: { id: number }): Promise<{ success: boolean }>
      exerciseCaloriesForDate(payload: { date: string }): Promise<{ calories: number }>
      exerciseGetRange(payload: { startDate: string; endDate: string }): Promise<Array<{ date: string; calories: number }>>

      appVersion(): Promise<string>
      updateCheck(): Promise<{ status: 'dev' | 'checked' | 'error'; version?: string; message?: string }>
      updateInstall(): Promise<{ success: boolean }>
      onUpdateAvailable(cb: (data: { version: string }) => void): () => void
      onUpdateDownloaded(cb: (data: { version: string }) => void): () => void
      remindersGet(): Promise<ReminderPrefs>
      remindersSet(prefs: ReminderPrefs): Promise<{ success: boolean }>

      exportData(payload: { format: 'json' | 'csv' }): Promise<{ success: boolean; path?: string }>

      onAiChunk(cb: (data: { messageId: string; chunk: string }) => void): () => void
      onAiDone(cb: (data: { messageId: string }) => void): () => void
      onAiError(cb: (data: { messageId: string; code: AiErrorCode; message: string }) => void): () => void
      onAiProposal(cb: (data: { messageId: string; proposal: LogProposal }) => void): () => void
      onAuthChanged(cb: (data: { signedIn: boolean; email?: string | null; error?: string }) => void): () => void
    }
  }
}
