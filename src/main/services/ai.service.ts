/**
 * AI transport layer. Prompt/context assembly lives in `src/shared/aiContext.ts`
 * (the single provider-neutral builder); this module only moves an already-built
 * { system, messages } pair over the wire and streams the reply back.
 *
 * The ONLY per-provider difference is shape: Anthropic takes the system prompt
 * as a top-level `system` parameter, the OpenAI-compatible SDK takes it as a
 * leading { role: 'system' } message. The content is identical either way.
 */
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { app } from 'electron'
import log from 'electron-log/main'
import type { ChatTurn } from '../../shared/aiContext'
import { AI_ERROR_MESSAGES, type AiErrorPayload } from '../../shared/aiErrors'

export type AiProvider =
  | 'anthropic' | 'openai' | 'groq' | 'deepseek' | 'mistral'
  | 'gemini' | 'xai' | 'perplexity' | 'together' | 'ollama'

export const PROVIDER_DEFAULTS: Record<AiProvider, string> = {
  anthropic:  'claude-sonnet-4-5',
  openai:     'gpt-4o',
  groq:       'llama-3.3-70b-versatile',
  deepseek:   'deepseek-chat',
  mistral:    'mistral-large-latest',
  gemini:     'gemini-2.0-flash',
  xai:        'grok-3',
  perplexity: 'sonar-pro',
  together:   'meta-llama/Llama-3-70b-chat-hf',
  ollama:     'llama3.2',
}

// All non-Anthropic providers use the OpenAI-compatible API — just different base URLs
const PROVIDER_BASE_URLS: Partial<Record<AiProvider, string>> = {
  groq:       'https://api.groq.com/openai/v1',
  deepseek:   'https://api.deepseek.com',
  mistral:    'https://api.mistral.ai/v1',
  gemini:     'https://generativelanguage.googleapis.com/v1beta/openai/',
  xai:        'https://api.x.ai/v1',
  perplexity: 'https://api.perplexity.ai',
  together:   'https://api.together.xyz/v1',
  ollama:     'http://localhost:11434/v1',
}

/** Light per-provider key-format check (prefix only) to catch pasted-wrong-key mistakes early. */
const KEY_PREFIXES: Partial<Record<AiProvider, string>> = {
  anthropic: 'sk-ant-',
  openai: 'sk-',
  groq: 'gsk_',
  deepseek: 'sk-',
  gemini: 'AIza',
  xai: 'xai-',
  perplexity: 'pplx-'
  // mistral / together have no stable prefix; ollama needs no key
}

export function validateKeyFormat(provider: AiProvider, key: string): { ok: boolean; expected?: string } {
  const prefix = KEY_PREFIXES[provider]
  if (!prefix || key.startsWith(prefix)) return { ok: true }
  return { ok: false, expected: prefix }
}

const activeStreams = new Map<string, AbortController>()

export interface AiStreamRequest {
  messageId: string
  system: string
  messages: ChatTurn[]
  apiKey: string
  provider: AiProvider
  model: string
  maxTokens?: number
}

/** Map SDK/network errors to the shared taxonomy. Raw details stay in the main-process log. */
function toAiError(err: unknown): AiErrorPayload {
  const code = ((): AiErrorPayload['code'] => {
    if (
      err instanceof Anthropic.APIUserAbortError ||
      err instanceof OpenAI.APIUserAbortError ||
      (err as Error)?.name === 'AbortError'
    ) {
      return 'ABORTED'
    }
    if (err instanceof Anthropic.APIConnectionError || err instanceof OpenAI.APIConnectionError) {
      return 'NETWORK'
    }
    const status = (err as { status?: number })?.status
    if (status === 401 || status === 403) return 'BAD_KEY'
    if (status === 429) return 'RATE_LIMIT'
    if (status != null && status >= 500) return 'PROVIDER_DOWN'
    return 'UNKNOWN'
  })()
  return { code, message: AI_ERROR_MESSAGES[code] }
}

/**
 * Shared streaming core (provider routing + abort) used by chat, weekly review,
 * and meal planning. Logs sizes only — never the API key, never prompt content
 * (it contains the user's body metrics).
 */
export async function streamChat(
  req: AiStreamRequest,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: AiErrorPayload) => void
): Promise<void> {
  const { messageId, system, messages, apiKey, provider, model } = req
  const maxTokens = req.maxTokens ?? 1024
  const controller = new AbortController()
  activeStreams.set(messageId, controller)

  log.info(
    `AI request ${provider}/${model}: system=${system.length}ch, turns=${messages.length}, ` +
    `lastTurn=${messages[messages.length - 1]?.content.length ?? 0}ch`
  )
  // Dev-only prompt eyeballing; double-gated (env var + unpackaged) so it can
  // never fire in a packaged build. info level so it reaches the file log.
  if (process.env.AI_DEBUG_PROMPTS === '1' && !app.isPackaged) {
    log.info(`AI_DEBUG_PROMPTS system:\n${system}\n--- messages ---\n${JSON.stringify(messages, null, 2)}`)
  }

  try {
    if (provider !== 'anthropic') {
      const baseURL = PROVIDER_BASE_URLS[provider]
      const client = new OpenAI({ apiKey: apiKey || 'ollama', baseURL })
      const stream = await client.chat.completions.create({
        model, max_tokens: maxTokens, stream: true,
        messages: [{ role: 'system', content: system }, ...messages]
      }, { signal: controller.signal })
      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        const delta = chunk.choices[0]?.delta?.content
        if (delta) onChunk(delta)
      }
    } else {
      const client = new Anthropic({ apiKey })
      const stream = client.messages.stream(
        { model, max_tokens: maxTokens, system, messages },
        { signal: controller.signal }
      )
      for await (const event of stream) {
        if (controller.signal.aborted) break
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onChunk(event.delta.text)
        }
      }
    }
    if (!controller.signal.aborted) onDone()
  } catch (err: unknown) {
    const mapped = toAiError(err)
    if (mapped.code !== 'ABORTED') {
      const status = (err as { status?: number })?.status
      log.error(
        `AI stream failed (${provider}/${model}) code=${mapped.code} status=${status ?? 'n/a'}:`,
        (err as Error)?.message
      )
      onError(mapped)
    }
  } finally {
    activeStreams.delete(messageId)
  }
}

export function cancelAiStream(messageId: string): void {
  activeStreams.get(messageId)?.abort()
  activeStreams.delete(messageId)
}
