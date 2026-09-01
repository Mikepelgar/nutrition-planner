/**
 * The AI proxy. Holds the OpenAI key, identifies the caller, meters per account,
 * builds the prompt, and streams the reply back as SSE.
 *
 * Order of operations matters and is not arbitrary:
 *
 *   auth → validate → consume quota → build prompt → call OpenAI
 *
 * Validation runs before metering so a malformed payload can never burn a quota
 * slot (the same rule the local implementation followed), and metering runs
 * before the upstream call so a rejected request costs nothing.
 *
 * Deployed WITH JWT verification (never --no-verify-jwt): the platform rejects
 * unauthenticated calls before this code runs, and auth.uid() inside
 * consume_ai_quota is what ties usage to a person.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { requestSchema } from './schema.ts'
import {
  buildCoachContext,
  buildChatMessages,
  buildWeeklyReviewMessages,
  buildMealPlanMessages,
  type AiMessages
} from '../_shared/aiContext.ts'

const MODEL = Deno.env.get('AI_MODEL') ?? 'gpt-5-mini'

// Overridable so the local harness can point at a fake OpenAI-compatible server
// instead of spending money. Unset in production.
const OPENAI_BASE_URL = Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1'

/** A full-day plan needs more room than a chat turn; both are bounded here, not by the client. */
const MAX_TOKENS: Record<string, number> = {
  chat: 1024,
  weekly_review: 1024,
  meal_plan: 2048
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'not_authenticated' }, 401)

  // Anon key + the caller's JWT: this client acts AS the user, so RLS applies to
  // it and consume_ai_quota sees the right auth.uid(). The service-role key is
  // deliberately never used here — nothing in this function needs to bypass RLS.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'not_authenticated' }, 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    // Field paths only — never the values, which carry the user's body metrics.
    return json(
      { error: 'invalid_request', fields: parsed.error.issues.map((i) => i.path.join('.')) },
      400
    )
  }
  const request = parsed.data

  // Limits come from the ai_limits table, not from here — so the allowance the
  // UI shows and the allowance enforced are read from the same row.
  const { data: quota, error: quotaError } = await supabase.rpc('consume_ai_quota')
  if (quotaError) {
    console.error('quota rpc failed:', quotaError.message)
    return json({ error: 'quota_unavailable' }, 500)
  }
  if (!quota?.allowed) {
    return json(
      {
        error: 'limit_reached',
        reason: quota?.reason ?? 'unknown',
        usage: {
          dailyUsed: quota?.daily_used ?? 0,
          dailyLimit: quota?.daily_limit ?? 0,
          monthlyUsed: quota?.monthly_used ?? 0,
          monthlyLimit: quota?.monthly_limit ?? 0
        }
      },
      429
    )
  }

  // Same builders the app used to run locally — the prompt is now assembled
  // where the client cannot substitute one.
  const ctx = buildCoachContext(request.context)
  let built: AiMessages
  switch (request.feature) {
    case 'chat':
      built = buildChatMessages(ctx, request.history, request.question)
      break
    case 'weekly_review':
      built = buildWeeklyReviewMessages(ctx, request.weekSummary)
      break
    case 'meal_plan':
      built = buildMealPlanMessages(ctx)
      break
  }

  const upstream = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: MAX_TOKENS[request.feature],
      stream: true,
      messages: [{ role: 'system', content: built.system }, ...built.messages]
    }),
    signal: req.signal
  })

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    // Log upstream failures here; the client only ever learns the status class,
    // never the provider's message (which can echo request content).
    console.error(`openai ${upstream.status}: ${detail.slice(0, 500)}`)
    return json({ error: upstream.status >= 500 ? 'provider_down' : 'provider_error' }, 502)
  }

  // Straight passthrough of the provider's SSE frames. The client already knows
  // how to read this shape, and re-encoding would only add a place to lose data.
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  })
})
