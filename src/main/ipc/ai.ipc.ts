import { ipcMain, BrowserWindow } from 'electron'
import { getDb } from '../db/database'
import { getProfile } from '../db/queries/profile.queries'
import { getPlanEntries } from '../db/queries/plan.queries'
import { getDRIForProfile } from '../constants/rdi'
import { getFoodNutrientTotals, getEntryMacros } from '../db/queries/nutrient.queries'
import { getCaloriesBurnedForDate } from '../db/queries/exercise.queries'
import { streamChat, cancelAiStream, validateKeyFormat, PROVIDER_DEFAULTS, type AiProvider } from '../services/ai.service'
import { getDailyLogs } from '../db/queries/log.queries'
import { getWeightRange } from '../db/queries/tracking.queries'
import { calcMacroTargets } from '../services/tdee.service'
import { getSetting, setSetting, encryptSetting, decryptSetting } from '../db/settings.helpers'
import { getBuiltinUsage, checkAndConsumeBuiltinUsage } from '../services/ai-usage.service'
import { BUILTIN_MODEL } from '../constants/ai-limits'
import {
  buildCoachContext,
  buildChatMessages,
  buildWeeklyReviewMessages,
  buildMealPlanMessages,
  type ChatTurn,
  type CoachContext,
  type CoachContextInputs
} from '../../shared/aiContext'
import { AI_ERROR_MESSAGES, type AiErrorCode, type AiErrorPayload } from '../../shared/aiErrors'
import { asString, asEnum, asDate } from './validate'
import type { Goal, SuggestionStyle, UserProfile } from '../../renderer/src/lib/types'

type AiKeySource = 'builtin' | 'custom'

const MODES = ['maintain', 'bulk', 'cut', 'recomp'] as const
const STYLES = ['standard', 'budget', 'convenience', 'high_protein', 'whole_foods', 'vegetarian', 'low_sodium'] as const

/** Error whose `code` travels to the renderer via ai:error (raw cause stays in main). */
class AiIpcError extends Error {
  constructor(
    public code: AiErrorCode,
    message?: string
  ) {
    super(message ?? AI_ERROR_MESSAGES[code])
  }
}

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

function getActiveProvider(db: ReturnType<typeof getDb>): AiProvider {
  return (getSetting(db, 'ai_provider') as AiProvider | null) ?? 'anthropic'
}

/**
 * Determines whether this install is using the developer's embedded key or
 * the user's own. Backward-compatible default inference (no migration row
 * needed): if `ai_key_source` was never explicitly set, treat installs that
 * already have a saved provider key as `'custom'` (don't disrupt existing
 * users), and fresh installs as `'builtin'` (so AI Chat works immediately).
 */
function getKeySource(db: ReturnType<typeof getDb>, provider: AiProvider): AiKeySource {
  const stored = getSetting(db, 'ai_key_source') as AiKeySource | null
  return stored ?? (getSetting(db, `${provider}_api_key`) ? 'custom' : 'builtin')
}

function getApiKey(db: ReturnType<typeof getDb>): { key: string; provider: AiProvider; model: string; isBuiltin: boolean } {
  const provider = getActiveProvider(db)
  const source = getKeySource(db, provider)

  if (source === 'builtin' && __BUILTIN_API_KEY__) {
    // Always pinned to Anthropic + a cost-efficient model — deliberately
    // ignores any saved `ai_model` override so a leftover override from a
    // previous custom-provider setup can't route shared-key traffic to an
    // expensive/incompatible model.
    return { key: __BUILTIN_API_KEY__, provider: 'anthropic', model: BUILTIN_MODEL, isBuiltin: true }
  }

  // Falls through here for: source === 'custom', OR builtin selected but no
  // embedded key is compiled in (e.g. a from-source dev build without
  // BUILTIN_ANTHROPIC_API_KEY set) — same behavior as today, never sends a
  // blank key to the provider.
  const raw = getSetting(db, `${provider}_api_key`)
  // Ollama runs locally — no key required
  if (!raw && provider !== 'ollama') {
    throw new AiIpcError('NO_KEY')
  }
  const key = raw ? decryptSetting(raw) : ''
  const savedModel = getSetting(db, 'ai_model')
  const model = savedModel || PROVIDER_DEFAULTS[provider]
  return { key, provider, model, isBuiltin: false }
}

/**
 * Resolves the API key for a streaming AI feature, applying the built-in
 * rate-limit gate. A missing profile is NOT a blocker — the coach degrades to
 * general guidance (the context builder handles a null profile). The NO_KEY
 * check runs before checkAndConsumeBuiltinUsage, so it can never burn quota.
 * Sends a typed `ai:error` and returns null on any blocker.
 */
function resolveAi(
  db: ReturnType<typeof getDb>,
  event: Electron.IpcMainInvokeEvent,
  messageId: string
): { profile: UserProfile | null; key: string; provider: AiProvider; model: string; win: BrowserWindow | null } | null {
  const win = BrowserWindow.fromWebContents(event.sender)
  const profile = getProfile(db)
  let info: ReturnType<typeof getApiKey>
  try {
    info = getApiKey(db)
  } catch (e) {
    const code = e instanceof AiIpcError ? e.code : 'UNKNOWN'
    sendAiError(win, messageId, code)
    return null
  }
  if (info.isBuiltin) {
    const { allowed, usage } = checkAndConsumeBuiltinUsage(db)
    if (!allowed) {
      sendAiError(
        win,
        messageId,
        'LIMIT_REACHED',
        `Daily limit reached for built-in AI (${usage.dailyUsed}/${usage.dailyLimit} today). Add your own API key in Settings.`
      )
      return null
    }
  }
  return { profile, key: info.key, provider: info.provider, model: info.model, win }
}

/**
 * Gathers today's raw rows for buildCoachContext. This is the ONE data path
 * shared by chat, weekly review, meal plan, and the "what the AI can see"
 * panel — so every AI flow sees the identical picture of the user.
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
    // Validate everything BEFORE resolveAi so a malformed payload can never
    // consume a built-in quota slot.
    const messageId = asString(payload.messageId, 'messageId', 64)
    const prompt = asString(payload.prompt, 'prompt', 4000)
    const mode = asEnum(payload.mode, 'mode', MODES)
    const style = asEnum(payload.style, 'style', STYLES)
    const date = asDate(payload.date, 'date')
    const history = asChatHistory(payload.history)

    const r = resolveAi(db, event, messageId)
    if (!r) return

    const inputs = gatherCoachInputs(
      db, r.profile, mode, style,
      payload.budgetMode === true, payload.easyPrepMode === true, date
    )
    const { system, messages } = buildChatMessages(buildCoachContext(inputs), history, prompt)
    await streamChat(
      { messageId, system, messages, apiKey: r.key, provider: r.provider, model: r.model },
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
    const r = resolveAi(db, event, messageId)
    if (!r) return
    const inputs = gatherCoachInputs(db, r.profile, r.profile?.goal ?? 'maintain', 'standard', false, false, date)
    const summary = buildWeekSummary(db, r.profile, date)
    const { system, messages } = buildWeeklyReviewMessages(buildCoachContext(inputs), summary)
    await streamChat(
      { messageId, system, messages, apiKey: r.key, provider: r.provider, model: r.model },
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
    const r = resolveAi(db, event, messageId)
    if (!r) return
    const mode = payload.mode != null ? asEnum(payload.mode, 'mode', MODES) : (r.profile?.goal ?? 'maintain')
    const style = payload.style != null ? asEnum(payload.style, 'style', STYLES) : 'standard'
    const inputs = gatherCoachInputs(
      db, r.profile, mode, style,
      payload.budgetMode === true, payload.easyPrepMode === true, date
    )
    const { system, messages } = buildMealPlanMessages(buildCoachContext(inputs))
    await streamChat(
      // 1024 tokens truncates a full-day plan — give this flow more headroom.
      { messageId, system, messages, apiKey: r.key, provider: r.provider, model: r.model, maxTokens: 1500 },
      ...streamToRenderer(r.win, messageId)
    )
  })

  // Read-only context snapshot for the "what the AI can see" panel — exactly
  // the same gather + build path as a real chat call. No key, no quota.
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

  ipcMain.handle('ai:saveKey', (_event, payload: { provider: AiProvider; key: string; model?: string }) => {
    const db = getDb()
    const key = payload.key.trim()
    // Reject an obviously mismatched key up front (e.g. an OpenAI key pasted
    // while Anthropic is selected) instead of failing later with a 401.
    if (key) {
      const check = validateKeyFormat(payload.provider, key)
      if (!check.ok) {
        return {
          success: false,
          error: `That doesn't look like a ${payload.provider} key — expected it to start with "${check.expected}". Check the selected provider.`
        }
      }
    }
    // Always save the provider preference
    setSetting(db, 'ai_provider', payload.provider)
    // Save the key if provided (Ollama doesn't need one)
    if (key) {
      setSetting(db, `${payload.provider}_api_key`, encryptSetting(key))
    }
    // Save or clear model override
    if (payload.model?.trim()) {
      setSetting(db, 'ai_model', payload.model.trim())
    } else {
      db.prepare("DELETE FROM settings WHERE key = 'ai_model'").run()
    }
    return { success: true }
  })

  // Lets the user pick between the developer's embedded "built-in" key
  // (free, soft-rate-limited) and bringing their own provider key
  // (unlimited, billed to them). Independent of `ai_provider`/saved keys —
  // fully reversible, switching back and forth preserves everything.
  ipcMain.handle('ai:setKeySource', (_event, payload: { source: 'builtin' | 'custom' }) => {
    const db = getDb()
    setSetting(db, 'ai_key_source', payload.source)
    return { success: true }
  })

  ipcMain.handle('ai:hasKey', () => {
    const db = getDb()
    const provider = getActiveProvider(db)
    const keySource = getKeySource(db, provider)
    const builtinActive = keySource === 'builtin' && !!__BUILTIN_API_KEY__

    // Ollama is local — no key needed, always considered configured
    const hasKey = builtinActive || provider === 'ollama' || !!getSetting(db, `${provider}_api_key`)
    const model = builtinActive ? BUILTIN_MODEL : (getSetting(db, 'ai_model') ?? '')

    // Read-only status — NEVER consumes a quota slot. Only checkAndConsumeBuiltinUsage
    // (called from resolveAi) is allowed to increment usage.
    const usage = builtinActive ? getBuiltinUsage(db) : undefined

    // Lets the renderer distinguish "builtin selected but this build has no
    // embedded key" (e.g. a from-source dev build) from "builtin active and
    // working" — without ever exposing the key itself to the renderer.
    const builtinAvailable = !!__BUILTIN_API_KEY__

    return { hasKey, provider, model, keySource, usage, builtinAvailable }
  })
}
