/**
 * Typed AI error taxonomy shared by main (classification) and renderer (display).
 * The raw provider error never crosses IPC — main logs it, the renderer only
 * ever sees a code + friendly message.
 */

export type AiErrorCode =
  | 'NOT_SIGNED_IN' // no account session; AI runs through the hosted proxy
  | 'LIMIT_REACHED' // per-account quota exhausted (enforced server-side)
  | 'PROVIDER_DOWN' // the proxy could not reach the model provider
  | 'NETWORK' // could not reach the proxy at all
  | 'UNCONFIGURED' // build has no Supabase credentials compiled in
  | 'ABORTED' // user cancelled the stream
  | 'UNKNOWN'

export interface AiErrorPayload {
  code: AiErrorCode
  message: string
}

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  NOT_SIGNED_IN: 'Sign in to use AI features. Settings → AI.',
  LIMIT_REACHED: "You've used all your AI messages for now. The daily allowance resets at midnight UTC.",
  PROVIDER_DOWN: 'The AI service is having trouble right now. Try again shortly.',
  NETWORK: 'Could not reach the AI service. Check your internet connection.',
  UNCONFIGURED: 'This build has no AI service configured. See README → AI configuration.',
  ABORTED: 'Response stopped.',
  UNKNOWN: 'Something went wrong talking to the AI. Try again.'
}
