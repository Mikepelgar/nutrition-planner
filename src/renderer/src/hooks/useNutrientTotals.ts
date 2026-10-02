import { useMemo } from 'react'
import type { NutrientProgressData } from '../lib/types'
import { usePlanStore } from '../store/usePlanStore'
import { useProfileStore } from '../store/useProfileStore'
import { buildNutrientProgress } from '../lib/nutrientProgress'
import { useDayTargets } from './useDayTargets'

/**
 * Nutrient progress for the currently loaded day, against the shared DRI
 * table (`shared/rdi.ts`) + the user's macro targets raised by that day's
 * exercise — the same numbers the main process feeds the AI, so the bars can
 * never drift from the coaching.
 */
export function useNutrientTotals(): NutrientProgressData[] {
  const nutrientTotals = usePlanStore(s => s.nutrientTotals)
  const profile = useProfileStore(s => s.profile)
  const macroTargets = useDayTargets()

  return useMemo(() => {
    if (!profile || !macroTargets) return []
    const intakes = new Map(nutrientTotals.map(n => [n.nutrientId, n.intake]))
    return buildNutrientProgress(intakes, profile, macroTargets)
  }, [nutrientTotals, profile, macroTargets])
}
