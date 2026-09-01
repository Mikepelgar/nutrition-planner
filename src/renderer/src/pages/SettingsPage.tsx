import { useState, useEffect } from 'react'
import { CheckCircle, Sparkles, Bell, LogIn, LogOut } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ProfileForm } from '../components/profile/ProfileForm'
import type { ReminderPrefs } from '../lib/types'

interface AiUsage {
  dailyUsed: number
  dailyLimit: number
  monthlyUsed: number
  monthlyLimit: number
}

interface AiStatus {
  configured: boolean
  signedIn: boolean
  usage: AiUsage | null
}

export function SettingsPage() {
  const [ai, setAi] = useState<AiStatus>({ configured: true, signedIn: false, usage: null })
  const [email, setEmail] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [exportMsg, setExportMsg] = useState('')
  const [reminders, setReminders] = useState<ReminderPrefs | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState('')

  async function checkUpdates() {
    setUpdateStatus('Checking…')
    const r = await window.api.updateCheck()
    setUpdateStatus(
      r.status === 'dev'
        ? 'Updates run in packaged builds only.'
        : r.status === 'checked'
          ? r.version ? `Update available: v${r.version}` : "You're on the latest version."
          : 'Update server not configured yet.'
    )
  }

  useEffect(() => {
    window.api.remindersGet().then(setReminders)
    window.api.appVersion().then(setAppVersion)
  }, [])

  function updateReminders(patch: Partial<ReminderPrefs>) {
    setReminders(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      window.api.remindersSet(next)
      return next
    })
  }

  async function refreshAi() {
    const [status, auth] = await Promise.all([window.api.aiStatus(), window.api.authStatus()])
    setAi(status)
    setEmail(auth.email)
  }

  useEffect(() => {
    void refreshAi()
    // Sign-in finishes in the browser and returns through the protocol handler,
    // so the result arrives as a push rather than from the invoke that started it.
    return window.api.onAuthChanged(data => {
      if (data.error) setAuthError(data.error)
      setAuthBusy(false)
      void refreshAi()
    })
  }, [])

  async function handleSignIn(provider: 'google' | 'github') {
    setAuthError('')
    setAuthBusy(true)
    try {
      await window.api.authSignIn({ provider })
    } catch (err) {
      setAuthError((err as Error)?.message ?? 'Could not start sign-in.')
      setAuthBusy(false)
    }
  }

  async function handleSignOut() {
    await window.api.authSignOut()
    setEmail(null)
    void refreshAi()
  }

  async function handleExport(format: 'json' | 'csv') {
    const res = await window.api.exportData({ format })
    setExportMsg(res.success ? `Exported to ${res.path}` : 'Export cancelled')
    setTimeout(() => setExportMsg(''), 4000)
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <ProfileForm />

      <div className="pt-2 border-t border-gray-800">
        <h2 className="text-base font-semibold text-gray-100 mt-4">AI</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Coaching, the weekly review, and meal plans run on Nutrition Planner&apos;s
          AI service. Everything else works offline.
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-300">Account</h2>
          {ai.signedIn && <CheckCircle size={14} className="text-emerald-500 ml-auto" />}
        </div>

        {!ai.configured ? (
          <p className="text-xs text-amber-400">
            This build has no AI service configured (a from-source build without a
            <code className="mx-1">.env</code>). Food logging and every other feature work normally.
          </p>
        ) : ai.signedIn ? (
          <>
            <p className="text-xs text-gray-400">
              Signed in{email ? <> as <span className="text-gray-300">{email}</span></> : null}.
            </p>
            {ai.usage && (
              <p className="text-xs text-gray-400">
                {ai.usage.dailyUsed} / {ai.usage.dailyLimit} messages today &middot;{' '}
                {ai.usage.monthlyUsed} / {ai.usage.monthlyLimit} this month
              </p>
            )}
            <p className="text-xs text-gray-500">
              The daily allowance resets at midnight UTC. Your food log stays on this
              machine — only the context for a given question is sent, and only when you ask.
            </p>
            <Button onClick={handleSignOut}>
              <LogOut size={14} className="mr-1.5" /> Sign out
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              Sign in to use AI features. Your browser opens for the provider you pick —
              this app never sees your password.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleSignIn('google')} disabled={authBusy}>
                <LogIn size={14} className="mr-1.5" /> Continue with Google
              </Button>
              <Button onClick={() => handleSignIn('github')} disabled={authBusy}>
                <LogIn size={14} className="mr-1.5" /> Continue with GitHub
              </Button>
            </div>
            {authBusy && (
              <p className="text-xs text-gray-500">
                Waiting for the browser to finish sign-in…
              </p>
            )}
            {authError && <p className="text-xs text-red-400">{authError}</p>}
          </>
        )}
      </div>

      {/* Reminders */}
      <div className="pt-2 border-t border-gray-800">
        <h2 className="text-base font-semibold text-gray-100 mt-4 flex items-center gap-1.5"><Bell size={15} /> Reminders</h2>
        <p className="text-sm text-gray-500 mt-0.5">Desktop notifications for meals and water.</p>
      </div>
      {reminders && (
        <div className="bg-gray-900 rounded-xl p-4 space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-300">Enable reminders</span>
            <input type="checkbox" checked={reminders.enabled} onChange={e => updateReminders({ enabled: e.target.checked })} className="accent-emerald-500 w-4 h-4" />
          </label>
          {reminders.enabled && (
            <>
              <div className="border-t border-gray-800 pt-3 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-gray-400">Meal reminders</span>
                  <input type="checkbox" checked={reminders.mealsEnabled} onChange={e => updateReminders({ mealsEnabled: e.target.checked })} className="accent-emerald-500 w-4 h-4" />
                </label>
                {reminders.mealsEnabled && (
                  <div className="grid grid-cols-3 gap-2">
                    {(['breakfast', 'lunch', 'dinner'] as const).map(meal => (
                      <div key={meal}>
                        <label className="text-[10px] text-gray-500 capitalize">{meal}</label>
                        <input type="time" value={reminders.meals[meal]}
                          onChange={e => updateReminders({ meals: { ...reminders.meals, [meal]: e.target.value } })}
                          className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-gray-800 pt-3 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-gray-400">Water reminders</span>
                  <input type="checkbox" checked={reminders.waterEnabled} onChange={e => updateReminders({ waterEnabled: e.target.checked })} className="accent-emerald-500 w-4 h-4" />
                </label>
                {reminders.waterEnabled && (
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    Every
                    <input type="number" min={1} max={6} value={reminders.waterIntervalHours}
                      onChange={e => updateReminders({ waterIntervalHours: parseInt(e.target.value) || 2 })}
                      className="w-16 bg-gray-800 border border-gray-700 text-gray-100 text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500" />
                    hours (8am–9pm)
                  </label>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Data */}
      <div className="pt-2 border-t border-gray-800">
        <h2 className="text-base font-semibold text-gray-100 mt-4">Data</h2>
        <p className="text-sm text-gray-500 mt-0.5">Export your data. The database is also auto-backed-up daily.</p>
      </div>
      <div className="bg-gray-900 rounded-xl p-4 space-y-3">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => handleExport('csv')}>Export food log (CSV)</Button>
          <Button variant="ghost" onClick={() => handleExport('json')}>Export all (JSON)</Button>
        </div>
        {exportMsg && <p className="text-xs text-emerald-400 break-all">{exportMsg}</p>}
        <p className="text-xs text-gray-500">Daily backups are kept in your app data folder (last 7 days).</p>
      </div>

      {/* About */}
      <div className="pt-2 border-t border-gray-800">
        <h2 className="text-base font-semibold text-gray-100 mt-4">About</h2>
      </div>
      <div className="bg-gray-900 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-300">Nutrition Planner <span className="text-gray-500">v{appVersion || '—'}</span></p>
          <Button variant="ghost" size="sm" onClick={checkUpdates}>Check for updates</Button>
        </div>
        {updateStatus && <p className="text-xs text-gray-500">{updateStatus}</p>}
        <p className="text-xs text-gray-500">
          Food data: USDA FoodData Central (public domain) and Open Food Facts (ODbL).
        </p>
        <p className="text-xs text-gray-600">
          Not medical advice. Your data stays on this device; see the privacy policy &amp; notices included with the app.
        </p>
      </div>
    </div>
    </div>
  )
}
