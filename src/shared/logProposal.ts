/**
 * "Log this for me" from the AI chat.
 *
 * The model cannot pick USDA foods — the food database lives on the user's
 * machine and never reaches the proxy. So it proposes entries by NAME via the
 * `propose_log` tool, and the app resolves them locally and shows a confirm
 * card. Nothing is written until the user taps Add.
 *
 * The tool arguments come from the model, so everything here is treated as
 * untrusted: parsed defensively, clamped to sane ranges, and dropped when
 * malformed rather than trusted.
 */
import type { MealType } from '../renderer/src/lib/types'

export const LOG_TOOL_NAME = 'propose_log'

export interface ProposedFood {
  name: string
  grams: number
  meal: MealType
}

export interface ProposedExercise {
  activity: string
  durationMin: number
  caloriesBurned: number
}

export interface ProposedWeight {
  value: number
  unit: 'kg' | 'lb'
}

export interface LogProposal {
  foods: ProposedFood[]
  exercises: ProposedExercise[]
  weight: ProposedWeight | null
}

const MEALS: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MAX_ITEMS = 12

/** OpenAI tool definition (strict mode: every field required, weight nullable). */
export const LOG_TOOL = {
  type: 'function',
  function: {
    name: LOG_TOOL_NAME,
    description:
      "Propose entries for the user's log for TODAY. The app shows them as a confirmation card; " +
      'nothing is saved until the user confirms. Call this ONLY when the user asks to log, add, or ' +
      'record food they ate, exercise they did, or their weight.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['foods', 'exercises', 'weight'],
      properties: {
        foods: {
          type: 'array',
          description: 'Foods eaten. Empty array if none.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'grams', 'meal'],
            properties: {
              name: {
                type: 'string',
                description:
                  'Short generic food name for a USDA database search, e.g. "pork chop broiled", ' +
                  '"white rice cooked", "banana". No brand unless the user named one.'
              },
              grams: { type: 'number', description: 'Estimated amount in grams.' },
              meal: { type: 'string', enum: MEALS }
            }
          }
        },
        exercises: {
          type: 'array',
          description: 'Workouts done. Empty array if none.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['activity', 'duration_min', 'calories_burned'],
            properties: {
              activity: { type: 'string', description: 'e.g. "Running", "Weight training".' },
              duration_min: { type: 'number' },
              calories_burned: {
                type: 'number',
                description: "Estimate as MET × the user's weight in kg × hours."
              }
            }
          }
        },
        weight: {
          description: 'Body weight the user reported, or null.',
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['value', 'unit'],
              properties: {
                value: { type: 'number' },
                unit: { type: 'string', enum: ['kg', 'lb'] }
              }
            },
            { type: 'null' }
          ]
        }
      }
    }
  }
} as const

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : ''
}

function num(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

/**
 * Parses the tool-call arguments. Returns null when nothing usable survives, so
 * a malformed call renders no card instead of an empty one.
 */
export function parseLogProposal(argsJson: string): LogProposal | null {
  let raw: unknown
  try {
    raw = JSON.parse(argsJson)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const foods: ProposedFood[] = (Array.isArray(r.foods) ? r.foods : [])
    .slice(0, MAX_ITEMS)
    .flatMap((f: Record<string, unknown>) => {
      const name = str(f?.name, 80)
      const grams = num(f?.grams, 1, 5000)
      if (!name || grams == null) return []
      const meal = MEALS.includes(f?.meal as MealType) ? (f.meal as MealType) : 'snack'
      return [{ name, grams: Math.round(grams), meal }]
    })

  const exercises: ProposedExercise[] = (Array.isArray(r.exercises) ? r.exercises : [])
    .slice(0, MAX_ITEMS)
    .flatMap((e: Record<string, unknown>) => {
      const activity = str(e?.activity, 60)
      const durationMin = num(e?.duration_min, 1, 1440)
      const caloriesBurned = num(e?.calories_burned, 1, 5000)
      if (!activity || durationMin == null || caloriesBurned == null) return []
      return [{ activity, durationMin: Math.round(durationMin), caloriesBurned: Math.round(caloriesBurned) }]
    })

  let weight: ProposedWeight | null = null
  const w = r.weight as Record<string, unknown> | null | undefined
  if (w && typeof w === 'object') {
    const unit = w.unit === 'lb' ? 'lb' : w.unit === 'kg' ? 'kg' : null
    const value = unit === 'lb' ? num(w.value, 44, 1100) : num(w.value, 20, 500)
    if (unit && value != null) weight = { value: Math.round(value * 10) / 10, unit }
  }

  if (!foods.length && !exercises.length && !weight) return null
  return { foods, exercises, weight }
}

/**
 * One-line summary kept in chat history, so on the next turn the model knows
 * what it proposed (the card itself is UI, not conversation).
 */
export function describeProposal(p: LogProposal): string {
  const parts = [
    ...p.foods.map(f => `${f.grams} g ${f.name} (${f.meal})`),
    ...p.exercises.map(e => `${e.activity} ${e.durationMin} min, ${e.caloriesBurned} kcal`),
    ...(p.weight ? [`weight ${p.weight.value} ${p.weight.unit}`] : [])
  ]
  return `[Proposed for today's log: ${parts.join('; ')}]`
}
