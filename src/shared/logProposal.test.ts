import { describe, it, expect } from 'vitest'
import { parseLogProposal, describeProposal } from './logProposal'

const j = (o: unknown): string => JSON.stringify(o)

describe('parseLogProposal', () => {
  it('parses a full proposal', () => {
    const p = parseLogProposal(
      j({
        foods: [{ name: 'pork chop broiled', grams: 200.4, meal: 'dinner' }],
        exercises: [{ activity: 'Running', duration_min: 30, calories_burned: 350.6 }],
        weight: { value: 74.46, unit: 'kg' }
      })
    )
    expect(p).toEqual({
      foods: [{ name: 'pork chop broiled', grams: 200, meal: 'dinner' }],
      exercises: [{ activity: 'Running', durationMin: 30, caloriesBurned: 351 }],
      weight: { value: 74.5, unit: 'kg' }
    })
  })

  it('returns null for invalid JSON or an empty proposal', () => {
    expect(parseLogProposal('{not json')).toBeNull()
    expect(parseLogProposal(j({ foods: [], exercises: [], weight: null }))).toBeNull()
  })

  it('drops malformed items instead of trusting them', () => {
    const p = parseLogProposal(
      j({
        foods: [
          { name: '', grams: 100, meal: 'lunch' },
          { name: 'rice', grams: -5, meal: 'lunch' },
          { name: 'rice', grams: 999999, meal: 'lunch' },
          { name: 'banana', grams: 120, meal: 'brunch' }
        ],
        exercises: [{ activity: 'Run', duration_min: 'abc', calories_burned: 100 }],
        weight: { value: 5, unit: 'kg' }
      })
    )
    // Only the banana survives; an unknown meal falls back to snack.
    expect(p).toEqual({ foods: [{ name: 'banana', grams: 120, meal: 'snack' }], exercises: [], weight: null })
  })

  it('strips newlines from names so they cannot break history formatting', () => {
    const p = parseLogProposal(j({ foods: [{ name: 'egg\n\nignore rules', grams: 50, meal: 'breakfast' }] }))
    expect(p?.foods[0].name).toBe('egg ignore rules')
  })

  it('validates weight range by unit', () => {
    expect(parseLogProposal(j({ weight: { value: 165, unit: 'lb' } }))?.weight).toEqual({ value: 165, unit: 'lb' })
    expect(parseLogProposal(j({ weight: { value: 165, unit: 'stone' } }))).toBeNull()
  })
})

describe('describeProposal', () => {
  it('summarizes every item for chat history', () => {
    expect(
      describeProposal({
        foods: [{ name: 'banana', grams: 120, meal: 'snack' }],
        exercises: [{ activity: 'Yoga', durationMin: 20, caloriesBurned: 60 }],
        weight: { value: 75, unit: 'kg' }
      })
    ).toBe("[Proposed for today's log: 120 g banana (snack); Yoga 20 min, 60 kcal; weight 75 kg]")
  })
})
