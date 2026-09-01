import { safeStorage } from 'electron'
import log from 'electron-log/main'
import { getDb } from './database'

/**
 * Shared helpers for the `settings` key/value table. The encrypt/decrypt pair
 * is what backs the Supabase session storage adapter in supabase.ts, so the
 * refresh token gets the same at-rest treatment provider keys used to.
 */

export function getSetting(db: ReturnType<typeof getDb>, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(db: ReturnType<typeof getDb>, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function decryptSetting(value: string): string {
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  } catch {
    return value
  }
}

export function encryptSetting(value: string): string {
  try {
    return safeStorage.encryptString(value).toString('base64')
  } catch (err) {
    // Deliberate fallback so a missing OS keychain doesn't break saving, but
    // it means the value is stored in PLAINTEXT — make that visible in logs.
    log.warn('safeStorage encryption unavailable — storing setting unencrypted:', (err as Error)?.message)
    return value
  }
}
