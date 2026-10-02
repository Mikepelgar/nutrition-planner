/**
 * AI transport. Everything goes to the app's own proxy — the Edge Function holds
 * the provider key, meters usage per account, and builds the prompt from the
 * structured context sent here.
 *
 * This module used to route ten providers and carry a key. It now moves a
 * validated context object over one authenticated connection and reads back an
 * SSE stream. What it does NOT send is a prompt: the system prompt is assembled
 * server-side, so a modified client cannot repurpose the proxy as a general
 * model.
 */
import log from 'electron-log/main'
import { getAccessToken } from './supabase'
import { AI_ERROR_MESSAGES, type AiErrorCode, type AiErrorPayload } from '../../shared/aiErrors'
import type { ChatTurn, CoachContextInputs } from '../../shared/aiContext'
import { LOG_TOOL_NAME, parseLogProposal, type LogProposal } from '../../shared/logProposal'

export type AiFeature = 'chat' | 'weekly_review' | 'meal_plan'

export interface AiStreamRequest {
  messageId: string
  feature: AiFeature
  context: CoachContextInputs
  history?: ChatTurn[]
  question?: string
  weekSummary?: string
}

export interface AiUsage {
  dailyUsed: number
  dailyLimit: number
  monthlyUsed: number
  monthlyLimit: number
}

const activeStreams = new Map<string, AbortController>()

function functionUrl(): string {
  return `${__SUPABASE_URL__}/functions/v1/ai-chat`
}

/** Maps proxy responses onto the existing shared taxonomy the renderer renders. */
function statusToCode(status: number): AiErrorCode {
  if (status === 401 || status === 403) return 'NOT_SIGNED_IN'
  if (status === 429) return 'LIMIT_REACHED'
  if (status === 502) return 'PROVIDER_DOWN'
  if (status >= 500) return 'PROVIDER_DOWN'
  return 'UNKNOWN'
}

interface SseResult {
  gotText: boolean
  finishReason: string | null
  /** Tool calls, each reassembled from its streamed fragments. */
  toolCalls: Array<{ name: string; args: string }>
}

/**
 * Reads an OpenAI-compatible SSE stream, emitting text deltas. Resolves with
 * whether any text arrived, the provider's finish_reason, and any tool calls,
 * so an empty reply can be reported instead of rendering as a blank message.
 *
 * Frames are not guaranteed to align with network chunks, so a partial line is
 * held back and prepended to the next read rather than being parsed and lost.
 */
async function readSse(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<SseResult> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let gotText = false
  let finishReason: string | null = null
  // Tool calls stream as fragments keyed by index: the name arrives once, the
  // JSON arguments arrive in pieces that only parse once concatenated.
  const calls = new Map<number, { name: string; args: string }>()
  const result = (): SseResult => ({ gotText, finishReason, toolCalls: [...calls.values()] })

  while (!signal.aborted) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') return result()
      try {
        const choice = JSON.parse(payload)?.choices?.[0]
        const delta = choice?.delta?.content
        if (delta) {
          gotText = true
          onChunk(delta)
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason
        for (const tc of choice?.delta?.tool_calls ?? []) {
          const idx = typeof tc?.index === 'number' ? tc.index : 0
          const call = calls.get(idx) ?? { name: '', args: '' }
          if (tc?.function?.name) call.name = tc.function.name
          if (tc?.function?.arguments) call.args += tc.function.arguments
          calls.set(idx, call)
        }
      } catch {
        // A malformed frame is not worth killing a good stream over.
      }
    }
  }
  return result()
}

export async function streamChat(
  req: AiStreamRequest,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: AiErrorPayload) => void,
  onProposal?: (proposal: LogProposal) => void
): Promise<void> {
  const controller = new AbortController()
  activeStreams.set(req.messageId, controller)

  try {
    const token = await getAccessToken()
    if (!token) {
      onError({ code: 'NOT_SIGNED_IN', message: AI_ERROR_MESSAGES.NOT_SIGNED_IN })
      return
    }

    // Sizes only — the context carries the user's body metrics and food log.
    log.info(
      `AI ${req.feature}: items=${req.context.loggedItems.length}, ` +
        `turns=${req.history?.length ?? 0}, nutrients=${req.context.nutrientStatuses.length}`
    )

    const response = await fetch(functionUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        feature: req.feature,
        context: req.context,
        ...(req.feature === 'chat' ? { history: req.history ?? [], question: req.question } : {}),
        ...(req.feature === 'weekly_review' ? { weekSummary: req.weekSummary } : {})
      }),
      signal: controller.signal
    })

    if (!response.ok || !response.body) {
      const code = statusToCode(response.status)
      const detail = await response.json().catch(() => null)
      log.error(`AI proxy ${response.status}: ${detail?.error ?? 'no detail'}`)
      onError({ code, message: AI_ERROR_MESSAGES[code] })
      return
    }

    const { gotText, finishReason, toolCalls } = await readSse(response.body, onChunk, controller.signal)
    if (controller.signal.aborted) return

    let proposed = false
    for (const call of toolCalls) {
      if (call.name !== LOG_TOOL_NAME) continue
      const proposal = parseLogProposal(call.args)
      if (proposal && onProposal) {
        onProposal(proposal)
        proposed = true
      } else {
        log.warn(`AI ${LOG_TOOL_NAME} call had no usable items (${call.args.length} chars)`)
      }
    }

    if (!gotText && !proposed) {
      log.error(`AI stream ended with no text (finish_reason=${finishReason ?? 'none'})`)
      onError({ code: 'UNKNOWN', message: AI_ERROR_MESSAGES.UNKNOWN })
      return
    }
    onDone()
  } catch (err) {
    if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return
    log.error('AI stream failed:', (err as Error)?.message)
    onError({ code: 'NETWORK', message: AI_ERROR_MESSAGES.NETWORK })
  } finally {
    activeStreams.delete(req.messageId)
  }
}

export function cancelAiStream(messageId: string): void {
  activeStreams.get(messageId)?.abort()
  activeStreams.delete(messageId)
}
