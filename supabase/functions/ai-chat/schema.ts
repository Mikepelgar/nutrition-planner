/**
 * Server-side validation for everything the desktop app sends.
 *
 * The client is untrusted: it is code running on someone else's machine, and a
 * modified build can send whatever it likes. So the function accepts structured
 * context — numbers and enums — and never a prompt. The system prompt is built
 * here, from these values, which is what stops an account holder from turning
 * the proxy into a general-purpose model.
 *
 * Bounds are deliberately generous enough for any real person and tight enough
 * that no field can carry a paragraph of injected instructions. Free text that
 * legitimately varies (food names, avoid-foods, the question itself) is capped
 * here and fenced as data by sanitizeUserText/fenceUserData in aiContext.ts.
 */
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'

const SEX = ['male', 'female'] as const
const ACTIVITY = [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extra_active'
] as const
const GOAL = ['maintain', 'bulk', 'cut', 'recomp'] as const
const DIET = [
  'balanced',
  'keto',
  'low_carb',
  'high_protein',
  'low_fat',
  'paleo',
  'mediterranean',
  'vegetarian',
  'vegan'
] as const
const ALLERGEN = [
  'dairy',
  'eggs',
  'peanuts',
  'tree_nuts',
  'soy',
  'gluten',
  'fish',
  'shellfish',
  'sesame'
] as const
const STYLE = [
  'standard',
  'budget',
  'convenience',
  'high_protein',
  'whole_foods',
  'vegetarian',
  'low_sodium'
] as const
const MEAL = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const UNIT_SYSTEM = ['metric', 'imperial'] as const

const profileSchema = z
  .object({
    age: z.number().int().min(1).max(120),
    sex: z.enum(SEX),
    heightCm: z.number().min(50).max(280),
    weightKg: z.number().min(20).max(500),
    activityLevel: z.enum(ACTIVITY),
    goal: z.enum(GOAL),
    goalKcal: z.number().min(0).max(2000).optional(),
    dietType: z.enum(DIET).optional(),
    allergens: z.array(z.enum(ALLERGEN)).max(ALLERGEN.length).optional(),
    avoidFoods: z.array(z.string().max(80)).max(50).optional(),
    goalWeightKg: z.number().min(20).max(500).optional(),
    unitSystem: z.enum(UNIT_SYSTEM).optional(),
    useCustomTargets: z.boolean().optional(),
    customCalories: z.number().min(0).max(20000).optional(),
    customProteinG: z.number().min(0).max(2000).optional(),
    customCarbsG: z.number().min(0).max(2000).optional(),
    customFatG: z.number().min(0).max(2000).optional()
  })
  .strict()

const loggedItemSchema = z
  .object({
    name: z.string().max(200),
    meal: z.enum(MEAL),
    kcal: z.number().min(0).max(30000),
    proteinG: z.number().min(0).max(5000),
    carbsG: z.number().min(0).max(5000),
    fatG: z.number().min(0).max(5000)
  })
  .strict()

const nutrientStatusSchema = z
  .object({
    name: z.string().max(80),
    unit: z.string().max(16),
    intake: z.number().min(0),
    rdi: z.number().min(0),
    ul: z.number().min(0).nullable()
  })
  .strict()

/** Mirrors CoachContextInputs in _shared/aiContext.ts. */
const contextSchema = z
  .object({
    profile: profileSchema.nullable(),
    mode: z.enum(GOAL),
    style: z.enum(STYLE),
    budgetMode: z.boolean(),
    easyPrepMode: z.boolean(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // A day's log; 200 items is far past any real day and bounds the prompt.
    loggedItems: z.array(loggedItemSchema).max(200),
    kcalBurnedExercise: z.number().min(0).max(30000),
    nutrientStatuses: z.array(nutrientStatusSchema).max(60)
  })
  .strict()

const turnSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(8000)
  })
  .strict()

/**
 * `feature` selects which of the three prompt builders runs. The client cannot
 * choose the model, the token ceiling, or the system prompt — those are decided
 * here, per feature.
 */
export const requestSchema = z.discriminatedUnion('feature', [
  z
    .object({
      feature: z.literal('chat'),
      context: contextSchema,
      // capHistory() trims to 12 turns; 40 bounds the payload before that runs.
      history: z.array(turnSchema).max(40).default([]),
      question: z.string().min(1).max(4000)
    })
    .strict(),
  z
    .object({
      feature: z.literal('weekly_review'),
      context: contextSchema,
      weekSummary: z.string().max(8000)
    })
    .strict(),
  z
    .object({
      feature: z.literal('meal_plan'),
      context: contextSchema
    })
    .strict()
])

export type AiRequest = z.infer<typeof requestSchema>
