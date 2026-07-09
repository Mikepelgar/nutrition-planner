import { useState, useEffect } from 'react'
import { Key, CheckCircle, Eye, EyeOff, Sparkles, Bell } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Pill } from '../components/ui/Pill'
import { ProfileForm } from '../components/profile/ProfileForm'
import type { ReminderPrefs } from '../lib/types'

type AiKeySource = 'builtin' | 'custom'

interface BuiltinUsage {
  dailyUsed: number
  dailyLimit: number
  monthlyUsed: number
  monthlyLimit: number
}

type Provider =
  | 'anthropic' | 'openai' | 'groq' | 'deepseek' | 'mistral'
  | 'gemini' | 'xai' | 'perplexity' | 'together' | 'ollama'

interface ProviderConfig {
  value: Provider
  label: string
  placeholder: string
  docsUrl: string
  defaultModel: string
  requiresKey: boolean
}

const PROVIDERS: ProviderConfig[] = [
  { value: 'anthropic',  label: 'Anthropic',       placeholder: 'sk-ant-…',   docsUrl: 'console.anthropic.com',           defaultModel: 'claude-sonnet-4-5',               requiresKey: true  },
  { value: 'openai',     label: 'OpenAI',           placeholder: 'sk-…',       docsUrl: 'platform.openai.com',             defaultModel: 'gpt-4o',                          requiresKey: true  },
  { value: 'groq',       label: 'Groq',             placeholder: 'gsk_…',      docsUrl: 'console.groq.com',                defaultModel: 'llama-3.3-70b-versatile',         requiresKey: true  },
  { value: 'deepseek',   label: 'DeepSeek',         placeholder: 'sk-…',       docsUrl: 'platform.deepseek.com',           defaultModel: 'deepseek-chat',                   requiresKey: true  },
  { value: 'mistral',    label: 'Mistral',          placeholder: 'your key',   docsUrl: 'console.mistral.ai',              defaultModel: 'mistral-large-latest',            requiresKey: true  },
  { value: 'gemini',     label: 'Google Gemini',    placeholder: 'AIza…',      docsUrl: 'aistudio.google.com',             defaultModel: 'gemini-2.0-flash',                requiresKey: true  },
  { value: 'xai',        label: 'xAI / Grok',       placeholder: 'xai-…',      docsUrl: 'console.x.ai',                    defaultModel: 'grok-3',                          requiresKey: true  },
  { value: 'perplexity', label: 'Perplexity',       placeholder: 'pplx-…',     docsUrl: 'docs.perplexity.ai',              defaultModel: 'sonar-pro',                       requiresKey: true  },
  { value: 'together',   label: 'Together AI',      placeholder: 'your key',   docsUrl: 'api.together.ai',                 defaultModel: 'meta-llama/Llama-3-70b-chat-hf',  requiresKey: true  },
  { value: 'ollama',     label: 'Ollama (local)',    placeholder: 'no key needed', docsUrl: 'ollama.ai',                   defaultModel: 'llama3.2',                        requiresKey: false },
]

export function SettingsPage() {
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keySource, setKeySource] = useState<AiKeySource>('builtin')
  const [usage, setUsage] = useState<BuiltinUsage | undefined>(undefined)
  const [builtinAvailable, setBuiltinAvailable] = useState(true)
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

  useEffect(() => {
    window.api.aiHasKey().then(res => {
      setProvider(res.provider as Provider)
      setHasKey(res.hasKey)
      setModel(res.model)
      setKeySource(res.keySource)
      setUsage(res.usage)
      setBuiltinAvailable(res.builtinAvailable)
    })
  }, [])

  async function handleKeySourceChange(source: AiKeySource) {
    setKeySource(source)
    await window.api.aiSetKeySource({ source })
    // Re-sync (provider/model/usage may now reflect the built-in defaults)
    window.api.aiHasKey().then(res => {
      setHasKey(res.hasKey)
      setModel(res.model)
      setUsage(res.usage)
      setBuiltinAvailable(res.builtinAvailable)
    })
  }

  function handleProviderChange(p: Provider) {
    setProvider(p)
    setKey('')
    setShowKey(false)
    setSaved(false)
    setKeyError('')
    // Optimistically mark as unconfigured; the save will re-confirm
    setHasKey(p === 'ollama')
  }

  async function handleSave() {
    const cfg = PROVIDERS.find(p => p.value === provider)!
    if (cfg.requiresKey && !key.trim()) return
    setKeyError('')
    const res = await window.api.aiSaveKey({ provider, key: key.trim(), model: model.trim() || undefined })
    if (!res.success) {
      setKeyError(res.error ?? 'Could not save the key.')
      return
    }
    setHasKey(true)
    setSaved(true)
    setKey('')
    setShowKey(false)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleExport(format: 'json' | 'csv') {
    const res = await window.api.exportData({ format })
    setExportMsg(res.success ? `Exported to ${res.path}` : 'Export cancelled')
    setTimeout(() => setExportMsg(''), 4000)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
  }

  const cfg = PROVIDERS.find(p => p.value === provider)!
  const canSave = !cfg.requiresKey || !!key.trim()

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <ProfileForm />

      <div className="pt-2 border-t border-gray-800">
        <h2 className="text-base font-semibold text-gray-100 mt-4">AI Configuration</h2>
        <p className="text-sm text-gray-500 mt-0.5">Choose how AI Chat is powered.</p>
      </div>

      {/* AI access source */}
      <div className="bg-gray-900 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-300">AI Access</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill active={keySource === 'builtin'} onClick={() => handleKeySourceChange('builtin')}>
            Use built-in AI (free, rate-limited)
          </Pill>
          <Pill active={keySource === 'custom'} onClick={() => handleKeySourceChange('custom')}>
            Use my own API key
          </Pill>
        </div>

        {keySource === 'builtin' ? (
          <div className="text-xs text-gray-500 space-y-1">
            {builtinAvailable ? (
              <>
                <p>
                  Powered by Nutrition Planner&apos;s built-in key — works immediately, no setup required.
                  To keep it sustainable for everyone, usage is soft-limited per install.
                </p>
                {usage && (
                  <p className="text-gray-400">
                    {usage.dailyUsed} / {usage.dailyLimit} messages today &middot;{' '}
                    {usage.monthlyUsed} / {usage.monthlyLimit} this month
                  </p>
                )}
                <p>Want unlimited use? Switch to &ldquo;Use my own API key&rdquo; and add a key from any provider below.</p>
              </>
            ) : (
              <p className="text-amber-400">
                This build doesn&apos;t include a built-in key (e.g. a from-source dev build). Switch to
                &ldquo;Use my own API key&rdquo; below to use AI Chat.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Bring your own key for unlimited use — billed to your own account, never rate-limited by this app.
          </p>
        )}
      </div>

      {keySource === 'custom' && (
      <div className="bg-gray-900 rounded-xl p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Key size={16} className="text-gray-400" />
          <h2 className="text-sm font-medium text-gray-300">AI Provider</h2>
          {hasKey && <CheckCircle size={14} className="text-emerald-500 ml-auto" />}
        </div>

        {/* Provider dropdown */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Provider</label>
          <select
            value={provider}
            onChange={e => handleProviderChange(e.target.value as Provider)}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
          >
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Docs link */}
        <p className="text-xs text-gray-500 -mt-2">
          {cfg.requiresKey
            ? <>Your key is encrypted and stored locally. Get one at <span className="text-emerald-400">{cfg.docsUrl}</span>.</>
            : <>Ollama runs locally — no API key needed. Make sure Ollama is running at <span className="text-emerald-400">localhost:11434</span>.</>
          }
        </p>

        {/* API Key input */}
        {cfg.requiresKey && (
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={hasKey ? 'Enter a new key to replace the saved one' : cfg.placeholder}
                value={key}
                onChange={e => setKey(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 pr-10 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
                title={showKey ? 'Hide key' : 'Show key'}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        )}

        {/* Model override */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">
            Model <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="text"
            placeholder={`Default: ${cfg.defaultModel}`}
            value={model}
            onChange={e => setModel(e.target.value)}
            spellCheck={false}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 font-mono"
          />
        </div>

        {keyError && <p className="text-xs text-red-400">{keyError}</p>}

        <Button onClick={handleSave} disabled={!canSave}>
          {saved ? '✓ Saved' : hasKey ? 'Update' : 'Save'}
        </Button>
      </div>
      )}

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
