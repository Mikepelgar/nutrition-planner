import { create } from 'zustand'
import type { ChatMode, SuggestionStyle } from '../lib/types'
import type { ChatTurn } from '../../../shared/aiContext'
import type { AiErrorCode } from '../../../shared/aiErrors'
import { MAX_HISTORY_TURNS } from '../../../shared/aiContext'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming: boolean
  errorCode?: AiErrorCode
}

interface ChatState {
  messages: ChatMessage[]
  mode: ChatMode
  style: SuggestionStyle
  budgetMode: boolean
  easyPrepMode: boolean
  isStreaming: boolean
  currentDate: string

  sendMessage: (text: string, date: string) => Promise<void>
  cancelStream: () => void
  setMode: (m: ChatMode) => void
  setStyle: (s: SuggestionStyle) => void
  setBudgetMode: (on: boolean) => void
  setEasyPrepMode: (on: boolean) => void
  clearMessages: () => void
}

let removeChunkListener: (() => void) | null = null
let removeDoneListener: (() => void) | null = null
let removeErrorListener: (() => void) | null = null

/**
 * Prior turns sent to the model for conversation memory. Failed and
 * still-streaming (cancelled mid-stream) turns are excluded so the model
 * never sees error text or half-answers as its own words.
 */
function historyFrom(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter(m => !m.streaming && !m.errorCode && m.content.trim().length > 0)
    .map(({ role, content }) => ({ role, content }))
    .slice(-MAX_HISTORY_TURNS)
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  mode: 'maintain',
  style: 'standard',
  budgetMode: false,
  easyPrepMode: false,
  isStreaming: false,
  currentDate: '',

  sendMessage: async (text, date) => {
    const { messages, mode, style, budgetMode, easyPrepMode } = get()
    const history = historyFrom(messages) // built BEFORE appending the new turn
    const messageId = `msg_${Date.now()}`
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: text, streaming: false }
    const assistantMsg: ChatMessage = { id: messageId, role: 'assistant', content: '', streaming: true }

    set({ messages: [...messages, userMsg, assistantMsg], isStreaming: true, currentDate: date })

    removeChunkListener?.()
    removeDoneListener?.()
    removeErrorListener?.()

    removeChunkListener = window.api.onAiChunk(({ messageId: mid, chunk }) => {
      if (mid !== messageId) return
      set(state => ({
        messages: state.messages.map(m =>
          m.id === messageId ? { ...m, content: m.content + chunk } : m
        )
      }))
    })

    removeDoneListener = window.api.onAiDone(({ messageId: mid }) => {
      if (mid !== messageId) return
      set(state => ({
        messages: state.messages.map(m => m.id === messageId ? { ...m, streaming: false } : m),
        isStreaming: false
      }))
    })

    removeErrorListener = window.api.onAiError(({ messageId: mid, code, message }) => {
      if (mid !== messageId) return
      set(state => ({
        messages: state.messages.map(m =>
          m.id === messageId ? { ...m, content: message, errorCode: code, streaming: false } : m
        ),
        isStreaming: false
      }))
    })

    try {
      await window.api.aiStartStream({
        messageId, prompt: text, mode, style, budgetMode, easyPrepMode, date, history
      })
    } catch (err: unknown) {
      const e = err as Error
      set(state => ({
        messages: state.messages.map(m =>
          m.id === messageId
            ? { ...m, content: e.message, errorCode: 'UNKNOWN' as AiErrorCode, streaming: false }
            : m
        ),
        isStreaming: false
      }))
    }
  },

  cancelStream: () => {
    const streaming = get().messages.find(m => m.streaming)
    if (streaming) window.api.aiCancelStream({ messageId: streaming.id })
    set(state => ({
      messages: state.messages.map(m => m.streaming ? { ...m, streaming: false } : m),
      isStreaming: false
    }))
  },

  setMode: (mode) => set({ mode }),
  setStyle: (style) => set({ style }),
  setBudgetMode: (budgetMode) => set({ budgetMode }),
  setEasyPrepMode: (easyPrepMode) => set({ easyPrepMode }),
  clearMessages: () => set({ messages: [] })
}))
