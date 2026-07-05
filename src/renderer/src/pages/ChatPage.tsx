import { useRef, useEffect, useState } from 'react'
import { Send, Square, Trash2, KeyRound, Sparkles, AlertCircle } from 'lucide-react'
import { useChatStore } from '../store/useChatStore'
import { usePlanStore } from '../store/usePlanStore'
import { useProfileStore } from '../store/useProfileStore'
import { ChatMessage } from '../components/chat/ChatMessage'
import { ContextPanel } from '../components/chat/ContextPanel'
import { Button } from '../components/ui/Button'
import type { ChatMode, SuggestionStyle } from '../lib/types'

const MODE_OPTIONS: Array<{ value: ChatMode; label: string }> = [
  { value: 'cut', label: 'Cut' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'bulk', label: 'Gain' },
  { value: 'recomp', label: 'Recomp' }
]

// Budget and Quick-prep are independent toggles now (both can be on at once);
// the remaining styles stay a single-select row.
const STYLE_OPTIONS: Array<{ value: SuggestionStyle; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'high_protein', label: 'High protein' },
  { value: 'whole_foods', label: 'Whole foods' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'low_sodium', label: 'Low sodium' }
]

const QUICK_PROMPTS = [
  "What nutrients am I missing today?",
  "Suggest foods to complete my nutritional goals.",
  "What should I avoid to stay under my upper limits?",
  "What's a good high-protein meal I can add?"
]

interface Props {
  onGoToSettings: () => void
}

export function ChatPage({ onGoToSettings }: Props) {
  const {
    messages, mode, style, budgetMode, easyPrepMode, isStreaming,
    sendMessage, cancelStream, setMode, setStyle, setBudgetMode, setEasyPrepMode, clearMessages
  } = useChatStore()
  const { date } = usePlanStore()
  const profileGoal = useProfileStore(s => s.profile?.goal)
  const didInitMode = useRef(false)
  const [input, setInput] = useState('')
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [keySource, setKeySource] = useState<'builtin' | 'custom'>('custom')
  const [usage, setUsage] = useState<
    { dailyUsed: number; dailyLimit: number; monthlyUsed: number; monthlyLimit: number } | undefined
  >(undefined)
  const [builtinAvailable, setBuiltinAvailable] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wasStreamingRef = useRef(false)

  function refreshAiStatus() {
    window.api.aiHasKey().then(res => {
      setHasKey(res.hasKey)
      setKeySource(res.keySource)
      setUsage(res.usage)
      setBuiltinAvailable(res.builtinAvailable)
    })
  }

  // Check AI access status every time this tab is opened (component mounts on tab switch)
  useEffect(() => {
    refreshAiStatus()
  }, [])

  // Built-in AI usage changes with every exchange — refresh the displayed
  // count/limit state right after each stream completes (or errors out),
  // i.e. on the isStreaming: true → false transition.
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) refreshAiStatus()
    wasStreamingRef.current = isStreaming
  }, [isStreaming])

  // Seed the chat goal from the user's profile goal once (still user-overridable).
  useEffect(() => {
    if (profileGoal && !didInitMode.current) {
      setMode(profileGoal)
      didInitMode.current = true
    }
  }, [profileGoal, setMode])

  const limitReached = keySource === 'builtin' && !!usage && usage.dailyUsed >= usage.dailyLimit

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    await sendMessage(text, date)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 flex-wrap">
        <span className="text-xs text-gray-500">Goal:</span>
        {MODE_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => setMode(o.value)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              mode === o.value ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {o.label}
          </button>
        ))}
        <span className="text-gray-700">·</span>
        <span className="text-xs text-gray-500">Style:</span>
        {STYLE_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => setStyle(o.value)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              style === o.value ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {o.label}
          </button>
        ))}
        <span className="text-gray-700">·</span>
        <button
          onClick={() => setBudgetMode(!budgetMode)}
          title="Prioritize cheap, high-value foods"
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
            budgetMode ? 'bg-amber-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          $ Budget
        </button>
        <button
          onClick={() => setEasyPrepMode(!easyPrepMode)}
          title="Only meals under 10 minutes or no cooking"
          className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
            easyPrepMode ? 'bg-amber-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          ⚡ Easy prep
        </button>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={clearMessages} title="Clear chat">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      <ContextPanel date={date} mode={mode} style={style} budgetMode={budgetMode} easyPrepMode={easyPrepMode} />

      {/* AI access status banner — exactly one of these variants applies */}
      {((keySource === 'custom' && hasKey === false) ||
        (keySource === 'builtin' && !builtinAvailable && hasKey === false)) && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-950/60 border-b border-amber-800/50">
          <KeyRound size={14} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 flex-1">
            {keySource === 'builtin' && !builtinAvailable
              ? "Built-in AI isn't available in this build — add your own API key to use AI Chat."
              : 'No API key configured.'}
          </p>
          <button
            onClick={onGoToSettings}
            className="text-xs font-medium text-amber-400 hover:text-amber-200 underline underline-offset-2 transition-colors shrink-0"
          >
            Open Settings →
          </button>
        </div>
      )}

      {keySource === 'builtin' && builtinAvailable && usage && !limitReached && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-sky-950/60 border-b border-sky-800/50">
          <Sparkles size={14} className="text-sky-400 shrink-0" />
          <p className="text-xs text-sky-300 flex-1">
            Using built-in AI · {usage.dailyUsed}/{usage.dailyLimit} messages today
          </p>
          <button
            onClick={onGoToSettings}
            className="text-xs font-medium text-sky-400 hover:text-sky-200 underline underline-offset-2 transition-colors shrink-0"
          >
            Add your own key for unlimited →
          </button>
        </div>
      )}

      {keySource === 'builtin' && builtinAvailable && limitReached && usage && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-950/60 border-b border-red-800/50">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <p className="text-xs text-red-300 flex-1">
            Daily limit reached for built-in AI ({usage.dailyUsed}/{usage.dailyLimit}). Add your own key
            in Settings for unlimited access, or try again tomorrow.
          </p>
          <button
            onClick={onGoToSettings}
            className="text-xs font-medium text-red-400 hover:text-red-200 underline underline-offset-2 transition-colors shrink-0"
          >
            Open Settings →
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">Ask the AI for food suggestions based on your current plan.</p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => { setInput(p); textareaRef.current?.focus() }}
                  className="text-xs text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => <ChatMessage key={msg.id} msg={msg} onGoToSettings={onGoToSettings} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || !hasKey || limitReached}
            rows={1}
            placeholder={
              limitReached
                ? 'Daily limit reached — see Settings'
                : hasKey === false
                  ? 'API key required — see Settings'
                  : 'Ask about your nutrition…'
            }
            className="flex-1 resize-none bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl px-3 py-2.5 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 max-h-32 overflow-y-auto disabled:opacity-60"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          {isStreaming ? (
            <Button variant="danger" size="sm" onClick={cancelStream} title="Stop">
              <Square size={14} />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSend} disabled={!input.trim() || !hasKey || limitReached}>
              <Send size={14} />
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
