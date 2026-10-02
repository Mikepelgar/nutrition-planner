import { create } from 'zustand'
import type { ChatMode, SuggestionStyle } from '../lib/types'
import type { ChatTurn } from '../../../shared/aiContext'
import type { AiErrorCode } from '../../../shared/aiErrors'
import { MAX_HISTORY_TURNS } from '../../../shared/aiContext'
import { describeProposal, type LogProposal } from '../../../shared/logProposal'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming: boolean
  errorCode?: AiErrorCode
  /** Entries the AI offered to log; rendered as a confirm card. */
  proposal?: LogProposal
  /** Card rows the user already added (or dismissed), by row key — survives tab switches. */
  settledRows?: Record<string, 'added' | 'dismissed'>
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
  settleRow: (messageId: string, rowKey: string, state: 'added' | 'dismissed') => void
}

let removeChunkListener: (() => void) | null = null
let removeDoneListener: (() => void) | null = null
let removeErrorListener: (() => void) | null = null
let removeProposalListener: (() => void) | null = null

/**
 * Prior turns sent to the model for conversation memory. Failed and
 * still-streaming (cancelled mid-stream) turns are excluded so the model
 * never sees error text or half-answers as its own words.
 */
function historyFrom(messages: ChatMessage[]): ChatTurn[] {
  return messages
    .filter(m => !m.streaming && !m.errorCode)
    // A proposal is carried as a one-line summary so the model remembers what
    // it offered to log (the card itself is UI, not conversation).
    .map(({ role, content, proposal }) => ({
      role,
      content: proposal ? `${content}\n\n${describeProposal(proposal)}`.trim() : content
    }))
    .filter(t => t.content.trim().length > 0)
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
    removeProposalListener?.()

    removeProposalListener = window.api.onAiProposal(({ messageId: mid, proposal }) => {
      if (mid !== messageId) return
      set(state => ({
        messages: state.messages.map(m => (m.id === messageId ? { ...m, proposal } : m))
      }))
    })

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
  clearMessages: () => set({ messages: [] }),
  settleRow: (messageId, rowKey, rowState) =>
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, settledRows: { ...m.settledRows, [rowKey]: rowState } } : m
      )
    }))
}))
