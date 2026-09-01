import { ipcMain, BrowserWindow } from 'electron'
import { getDb } from '../db/database'
import { getProfile } from '../db/queries/profile.queries'
import { getPlanEntries } from '../db/queries/plan.queries'
import { getDRIForProfile } from '../constants/rdi'
import { getFoodNutrientTotals, getEntryMacros } from '../db/queries/nutrient.queries'
import { getCaloriesBurnedForDate } from '../db/queries/exercise.queries'
import { streamChat, cancelAiStream } from '../services/ai.service'
import { getAccessToken, getUsage, isConfigured } from '../services/supabase'
import { getDailyLogs } from '../db/queries/log.queries'
import { getWeightRange } from '../db/queries/tracking.queries'
import { calcMacroTargets } from '../services/tdee.service'
import { buildCoachContext, type ChatTurn, type CoachContext, type CoachContextInputs } from '../../shared/aiContext'
import { AI_ERROR_MESSAGES, type AiErrorCode, type AiErrorPayload } from '../../shared/aiErrors'
import { asString, asEnum, asDate } from './validate'
import type { Goal, SuggestionStyle, UserProfile } from '../../renderer/src/lib/types'

const MODES = ['maintain', 'bulk', 'cut', 'recomp'] as const
const STYLES = ['standard', 'budget', 'convenience', 'high_protein', 'whole_foods', 'vegetarian', 'low_sodium'] as const

function sendAiError(win: BrowserWindow | null, messageId: string, code: AiErrorCode, message?: string): void {
  win?.webContents.send('ai:error', { messageId, code, message: message ?? AI_ERROR_MESSAGES[code] })
}

/** Bounded validation for the renderer-supplied conversation history. */
function asChatHistory(v: unknown): ChatTurn[] {
  if (v == null) return []
  if (!Array.isArray(v)) throw new Error('Invalid history: expected array')
  return v.slice(-40).map(t => ({
    role: asEnum((t as { role?: unknown })?.role, 'history role', ['user', 'assistant'] as const),
    content: asString((t as { content?: unknown })?.content, 'history content', 8000)
  }))
}

/**
 * Confirms this install can talk to the proxy at all, before any work is done.
 *
 * Quota is NOT checked here — it is enforced by the Edge Function, which is the
 * only place it can be enforced honestly. This is a fail-fast for the two states
 * the client can know on its own: a build with no Supabase credentials, and a
 * user who is not signed in. A missing profile is still not a blocker; the
 * context builder handles a null profile and the coach degrades to general
 * guidance.
 */
async function resolveAi(
  db: ReturnType<typeof getDb>,
  event: Electron.IpcMainInvokeEvent,
  messageId: string
): Promise<{ profile: UserProfile | null; win: BrowserWindow | null } | null> {
  const win = BrowserWindow.fromWebContents(event.sender)

  if (!isConfigured()) {
    sendAiError(win, messageId, 'UNCONFIGURED')
    return null
  }
  if (!(await getAccessToken())) {
    sendAiError(win, messageId, 'NOT_SIGNED_IN')
    return null
  }
  return { profile: getProfile(db), win }
}

/**
 * Gathers today's raw rows for buildCoachContext. This is the ONE data path
 * shared by chat, weekly review, meal plan, and the "what the AI can see"
 * panel — so every AI flow sees the identical picture of the user.
 *
 * The result now travels to the Edge Function, which runs buildCoachContext
 * itself. Sending these rows rather than a finished prompt is what keeps the
 * system prompt out of the client's hands.
 */
function gatherCoachInputs(
  db: ReturnType<typeof getDb>,
  profile: UserProfile | null,
  mode: Goal,
  style: SuggestionStyle,
  budgetMode: boolean,
  easyPrepMode: boolean,
  date: string
): CoachContextInputs {
  const plan = db.prepare('SELECT id FROM plan WHERE date = ?').get(date) as { id: number } | undefined
  const loggedItems = plan ? getEntryMacros(db, plan.id) : []
  const kcalBurnedExercise = getCaloriesBurnedForDate(db, date)

  let nutrientStatuses: CoachContextInputs['nutrientStatuses'] = []
  if (profile) {
    const entries = plan ? getPlanEntries(db, plan.id) : []
    const totals = getFoodNutrientTotals(db, entries.map(e => ({ fdcId: e.fdcId, grams: e.grams })))
    nutrientStatuses = getDRIForProfile(profile.age, profile.sex).map(dri => ({
      name: dri.name,
      unit: dri.unit,
      intake: totals.get(dri.nutrientId) ?? 0,
      rdi: dri.rdi,
      ul: dri.ul
    }))
  }

  return { profile, mode, style, budgetMode, easyPrepMode, date, loggedItems, kcalBurnedExercise, nutrientStatuses }
}

/** Pre-aggregates the last 7 days into a compact summary for the weekly review. */
function buildWeekSummary(db: ReturnType<typeof getDb>, profile: UserProfile | null, endDate: string): string {
  const start = new Date(Date.parse(endDate + 'T00:00:00') - 6 * 86_400_000).toISOString().slice(0, 10)
  const logs = getDailyLogs(db, start, endDate)
  const daysLogged = logs.filter(l => l.entryCount > 0).length
  const avg = (xs: number[]): number => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0)
  const weights = getWeightRange(db, start, endDate)
  const weightChange = weights.length >= 2 ? (weights[weights.length - 1].weightKg - weights[0].weightKg).toFixed(1) : 'n/a'
  const targets = profile ? calcMacroTargets(profile) : null
  const vs = (value: number, target: number | undefined, unit = ''): string =>
    target != null ? `${value}${unit} (target ${target}${unit})` : `${value}${unit}`
  return [
    '## Last 7 days',
    `Days logged: ${daysLogged}/7`,
    `Avg calories: ${vs(avg(logs.map(l => l.calories)), targets?.calories)}`,
    `Avg protein: ${vs(avg(logs.map(l => l.proteinG)), targets?.proteinG, 'g')}`,
    `Avg carbs: ${vs(avg(logs.map(l => l.carbsG)), targets?.carbsG, 'g')}`,
    `Avg fat: ${vs(avg(logs.map(l => l.fatG)), targets?.fatG, 'g')}`,
    `Weight change this week: ${weightChange} kg`
  ].join('\n')
}

/** Wires a streamChat call to the renderer's ai:chunk / ai:done / ai:error channels. */
function streamToRenderer(
  win: BrowserWindow | null,
  messageId: string
): [(chunk: string) => void, () => void, (err: AiErrorPayload) => void] {
  return [
    chunk => win?.webContents.send('ai:chunk', { messageId, chunk }),
    () => win?.webContents.send('ai:done', { messageId }),
    err => sendAiError(win, messageId, err.code, err.message)
  ]
}

export function registerAiIPC(): void {
  ipcMain.handle('ai:startStream', async (event, payload: {
    messageId: string
    prompt: string
    mode: string
    style: string
    budgetMode?: boolean
    easyPrepMode?: boolean
    date: string
    history?: ChatTurn[]
  }) => {
    const db = getDb()
    // Validate before resolveAi, as before — the server validates again, and
    // more strictly, but there is no reason to open a connection for a payload
    // this process can already see is malformed.
    const messageId = asString(payload.messageId, 'messageId', 64)
    const prompt = asString(payload.prompt, 'prompt', 4000)
    const mode = asEnum(payload.mode, 'mode', MODES)
    const style = asEnum(payload.style, 'style', STYLES)
    const date = asDate(payload.date, 'date')
    const history = asChatHistory(payload.history)

    const r = await resolveAi(db, event, messageId)
    if (!r) return

    const context = gatherCoachInputs(
      db, r.profile, mode, style,
      payload.budgetMode === true, payload.easyPrepMode === true, date
    )
    await streamChat(
      { messageId, feature: 'chat', context, history, question: prompt },
      ...streamToRenderer(r.win, messageId)
    )
  })

  ipcMain.handle('ai:cancelStream', (_event, payload: { messageId: string }) => {
    cancelAiStream(asString(payload.messageId, 'messageId', 64))
  })

  ipcMain.handle('ai:weeklyReview', async (event, payload: { messageId: string; date: string }) => {
    const db = getDb()
    const messageId = asString(payload.messageId, 'messageId', 64)
    const date = asDate(payload.date, 'date')
    const r = await resolveAi(db, event, messageId)
    if (!r) return
    const context = gatherCoachInputs(db, r.profile, r.profile?.goal ?? 'maintain', 'standard', false, false, date)
    await streamChat(
      { messageId, feature: 'weekly_review', context, weekSummary: buildWeekSummary(db, r.profile, date) },
      ...streamToRenderer(r.win, messageId)
    )
  })

  ipcMain.handle('ai:planDay', async (event, payload: {
    messageId: string
    date: string
    mode?: string
    style?: string
    budgetMode?: boolean
    easyPrepMode?: boolean
  }) => {
    const db = getDb()
    const messageId = asString(payload.messageId, 'messageId', 64)
    const date = asDate(payload.date, 'date')
    const r = await resolveAi(db, event, messageId)
    if (!r) return
    const mode = payload.mode != null ? asEnum(payload.mode, 'mode', MODES) : (r.profile?.goal ?? 'maintain')
    const style = payload.style != null ? asEnum(payload.style, 'style', STYLES) : 'standard'
    const context = gatherCoachInputs(
      db, r.profile, mode, style,
      payload.budgetMode === true, payload.easyPrepMode === true, date
    )
    // The larger token ceiling a full-day plan needs is set server-side now,
    // keyed off the feature — the client cannot ask for more headroom.
    await streamChat(
      { messageId, feature: 'meal_plan', context },
      ...streamToRenderer(r.win, messageId)
    )
  })

  // Read-only context snapshot for the "what the AI can see" panel — the same
  // gather + build path a real call uses, run locally. No account, no quota.
  ipcMain.handle('ai:getContext', (_event, payload: {
    date: string
    mode: string
    style: string
    budgetMode?: boolean
    easyPrepMode?: boolean
  }): CoachContext => {
    const db = getDb()
    const date = asDate(payload.date, 'date')
    const mode = asEnum(payload.mode, 'mode', MODES)
    const style = asEnum(payload.style, 'style', STYLES)
    const profile = getProfile(db)
    return buildCoachContext(
      gatherCoachInputs(db, profile, mode, style, payload.budgetMode === true, payload.easyPrepMode === true, date)
    )
  })

  // Status for the Chat banner and the Settings panel. Read-only: reading usage
  // can never consume it, which is why it goes to ai_usage directly rather than
  // through the function.
  ipcMain.handle('ai:status', async () => {
    if (!isConfigured()) {
      return { configured: false, signedIn: false, usage: null }
    }
    const signedIn = Boolean(await getAccessToken())
    return {
      configured: true,
      signedIn,
      usage: signedIn ? await getUsage() : null
    }
  })
}
