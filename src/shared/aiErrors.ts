/**
 * Typed AI error taxonomy shared by main (classification) and renderer (display).
 * The raw provider error never crosses IPC — main logs it, the renderer only
 * ever sees a code + friendly message.
 */

export type AiErrorCode =
  | 'NO_KEY' // no custom key saved and no built-in key compiled in
  | 'BAD_KEY' // provider rejected the key (401/403)
  | 'RATE_LIMIT' // provider 429
  | 'PROVIDER_DOWN' // provider 5xx
  | 'NETWORK' // could not reach the provider (also Ollama not running)
  | 'ABORTED' // user cancelled the stream
  | 'LIMIT_REACHED' // app-level soft cap on the built-in key
  | 'UNKNOWN'

export interface AiErrorPayload {
  code: AiErrorCode
  message: string
}

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  NO_KEY: 'No API key set. Add one in Settings → AI.',
  BAD_KEY:
    "The provider rejected your API key. Check in Settings that the key matches the selected provider (e.g. an OpenAI key won't work with Anthropic).",
  RATE_LIMIT: 'The AI provider is rate-limiting requests. Wait a minute and try again.',
  PROVIDER_DOWN: 'The AI provider is having trouble right now. Try again shortly.',
  NETWORK: 'Could not reach the AI provider. Check your internet connection (or that Ollama is running).',
  ABORTED: 'Response stopped.',
  LIMIT_REACHED: 'Daily limit reached for built-in AI. Add your own API key in Settings for unlimited access.',
  UNKNOWN: 'Something went wrong talking to the AI. Try again.'
}
