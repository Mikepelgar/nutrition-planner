/**
 * Supabase client for the main process.
 *
 * supabase-js defaults to localStorage, which does not exist here, so the
 * session is persisted through the app's own `settings` table with the refresh
 * token encrypted via safeStorage — the same treatment the provider API keys
 * used to get. A refresh token is a bearer credential: anyone holding it can
 * mint access tokens until it is revoked, so it never touches disk in plaintext
 * on a machine whose keychain is available.
 *
 * The URL and anon key are compiled in at build time. Unlike the provider key
 * they replace, neither is a secret: the anon key is a publishable identifier
 * that grants exactly what the RLS policies allow, which is why every policy in
 * the schema is written to be safe in the hands of a hostile client.
 */
import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js'
import log from 'electron-log/main'
import { getDb } from '../db/database'
import { getSetting, setSetting, encryptSetting, decryptSetting } from '../db/settings.helpers'

const SETTING_PREFIX = 'sb_session_'

/** Synchronous is fine — better-sqlite3 is synchronous and these are single-row reads. */
const sqliteStorage: SupportedStorage = {
  getItem: (key) => {
    const raw = getSetting(getDb(), SETTING_PREFIX + key)
    return raw ? decryptSetting(raw) : null
  },
  setItem: (key, value) => {
    setSetting(getDb(), SETTING_PREFIX + key, encryptSetting(value))
  },
  removeItem: (key) => {
    getDb().prepare('DELETE FROM settings WHERE key = ?').run(SETTING_PREFIX + key)
  }
}

let client: SupabaseClient | null = null

export function isConfigured(): boolean {
  return Boolean(__SUPABASE_URL__ && __SUPABASE_ANON_KEY__)
}

export function getSupabase(): SupabaseClient {
  if (client) return client

  if (!isConfigured()) {
    // A build from source with no .env. Surfaced to the user as "AI unavailable
    // in this build" rather than a stack trace on first chat message.
    throw new Error('Supabase is not configured in this build')
  }

  client = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, {
    auth: {
      // PKCE is required for the desktop flow: the code that comes back through
      // the protocol handler is worthless without the verifier held in memory
      // here, so a hostile app registering the same scheme gains nothing.
      flowType: 'pkce',
      storage: sqliteStorage,
      persistSession: true,
      autoRefreshToken: true,
      // There is no browser URL to read a callback out of; auth.service.ts
      // hands the code to exchangeCodeForSession explicitly.
      detectSessionInUrl: false
    }
  })

  client.auth.onAuthStateChange((event) => {
    log.info(`supabase auth: ${event}`)
  })

  return client
}

export interface AiUsage {
  dailyUsed: number
  dailyLimit: number
  monthlyUsed: number
  monthlyLimit: number
}

/**
 * Read-only usage for the Settings display. Never increments anything — the
 * counters are writable only by consume_ai_quota, and RLS returns just this
 * user's row regardless of what the query asks for.
 *
 * Counters are stale once the stored day/month rolls over (the reset is lazy,
 * applied on the next spend), so the same rollover the database does is applied
 * here for display; otherwise yesterday's total shows until the first message.
 */
export async function getUsage(): Promise<AiUsage | null> {
  if (!isConfigured()) return null
  const supabase = getSupabase()

  const [{ data: usage }, { data: limits }] = await Promise.all([
    supabase.from('ai_usage').select('day, daily_count, month, monthly_count').maybeSingle(),
    supabase.from('ai_limits').select('daily_limit, monthly_limit').maybeSingle()
  ])
  if (!limits) return null

  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  return {
    dailyUsed: usage?.day === today ? usage.daily_count : 0,
    dailyLimit: limits.daily_limit,
    monthlyUsed: usage?.month === month ? usage.monthly_count : 0,
    monthlyLimit: limits.monthly_limit
  }
}

/** Access token for the Edge Function call, refreshed if it has expired. */
export async function getAccessToken(): Promise<string | null> {
  if (!isConfigured()) return null
  const { data, error } = await getSupabase().auth.getSession()
  if (error) {
    log.error('failed to read supabase session:', error.message)
    return null
  }
  return data.session?.access_token ?? null
}
