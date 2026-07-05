import { getDb } from '../db/database'
import { getSetting, setSetting } from '../db/settings.helpers'
import { BUILTIN_DAILY_LIMIT, BUILTIN_MONTHLY_LIMIT } from '../constants/ai-limits'

/**
 * Local soft-rate-limit tracking for the developer-embedded "built-in" AI
 * key. Counters live in the existing `settings` k/v table (no migration
 * needed) under these keys:
 *   builtin_usage_date           'YYYY-MM-DD' — date the daily counter covers
 *   builtin_usage_daily_count    number of built-in requests made "today"
 *   builtin_usage_month          'YYYY-MM'    — month the monthly counter covers
 *   builtin_usage_monthly_count  number of built-in requests made "this month"
 *
 * Rollover is handled lazily: whenever the stored date/month no longer
 * matches "now", the relevant counter is treated as zero (and persisted as
 * such on the next consume) — no cron job or startup migration required.
 *
 * IMPORTANT: this is a local, soft deterrent — a determined user could clear
 * or edit these rows directly. It exists to bound casual/accidental overuse
 * of the developer's own shared key, not to provide a hard guarantee.
 */

export interface BuiltinUsage {
  dailyUsed: number
  dailyLimit: number
  monthlyUsed: number
  monthlyLimit: number
}

const KEY_DATE = 'builtin_usage_date'
const KEY_DAILY_COUNT = 'builtin_usage_daily_count'
const KEY_MONTH = 'builtin_usage_month'
const KEY_MONTHLY_COUNT = 'builtin_usage_monthly_count'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

function monthStr(): string {
  return todayStr().slice(0, 7) // 'YYYY-MM'
}

function readInt(db: ReturnType<typeof getDb>, key: string): number {
  const raw = getSetting(db, key)
  const n = raw ? parseInt(raw, 10) : 0
  return Number.isFinite(n) ? n : 0
}

interface EffectiveCounts {
  today: string
  month: string
  effectiveDaily: number
  effectiveMonthly: number
}

/** Computes the "effective" counts as of right now, rolling stale stored
 *  date/month to zero WITHOUT writing anything — pure read. */
function computeEffective(db: ReturnType<typeof getDb>): EffectiveCounts {
  const today = todayStr()
  const month = monthStr()

  const storedDate = getSetting(db, KEY_DATE)
  const storedMonth = getSetting(db, KEY_MONTH)

  const effectiveDaily = storedDate === today ? readInt(db, KEY_DAILY_COUNT) : 0
  const effectiveMonthly = storedMonth === month ? readInt(db, KEY_MONTHLY_COUNT) : 0

  return { today, month, effectiveDaily, effectiveMonthly }
}

/**
 * Read-only status check — safe to call as often as needed (e.g. on every
 * Chat/Settings tab mount). Never increments counters.
 */
export function getBuiltinUsage(db: ReturnType<typeof getDb> = getDb()): BuiltinUsage {
  const { effectiveDaily, effectiveMonthly } = computeEffective(db)
  return {
    dailyUsed: effectiveDaily,
    dailyLimit: BUILTIN_DAILY_LIMIT,
    monthlyUsed: effectiveMonthly,
    monthlyLimit: BUILTIN_MONTHLY_LIMIT
  }
}

/**
 * Checks both caps and, if under limit, atomically increments + persists the
 * (possibly rolled-over) counters in one step. If at/over either cap, returns
 * `allowed: false` WITHOUT writing anything — a rejected request must never
 * consume a quota slot.
 *
 * This is the ONLY function permitted to increment usage. Status checks
 * (ai:hasKey) must use `getBuiltinUsage` instead.
 */
export function checkAndConsumeBuiltinUsage(
  db: ReturnType<typeof getDb> = getDb()
): { allowed: boolean; usage: BuiltinUsage } {
  const consume = db.transaction(() => {
    const { today, month, effectiveDaily, effectiveMonthly } = computeEffective(db)

    if (effectiveDaily >= BUILTIN_DAILY_LIMIT || effectiveMonthly >= BUILTIN_MONTHLY_LIMIT) {
      return {
        allowed: false,
        usage: {
          dailyUsed: effectiveDaily,
          dailyLimit: BUILTIN_DAILY_LIMIT,
          monthlyUsed: effectiveMonthly,
          monthlyLimit: BUILTIN_MONTHLY_LIMIT
        }
      }
    }

    const nextDaily = effectiveDaily + 1
    const nextMonthly = effectiveMonthly + 1

    setSetting(db, KEY_DATE, today)
    setSetting(db, KEY_DAILY_COUNT, String(nextDaily))
    setSetting(db, KEY_MONTH, month)
    setSetting(db, KEY_MONTHLY_COUNT, String(nextMonthly))

    return {
      allowed: true,
      usage: {
        dailyUsed: nextDaily,
        dailyLimit: BUILTIN_DAILY_LIMIT,
        monthlyUsed: nextMonthly,
        monthlyLimit: BUILTIN_MONTHLY_LIMIT
      }
    }
  })

  return consume()
}
