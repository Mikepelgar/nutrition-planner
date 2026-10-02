import { useMemo } from 'react'
import type { MacroTargets } from '../lib/types'
import { usePlanStore } from '../store/usePlanStore'
import { useProfileStore } from '../store/useProfileStore'
import { addExerciseToTargets } from '../../../shared/macros'

/**
 * Targets for the currently loaded day: the profile's macro targets raised by
 * that day's exercise. Same function the AI briefing uses, so the bars and the
 * coaching agree on what "on target" means after a workout.
 */
export function useDayTargets(): MacroTargets | null {
  const macroTargets = useProfileStore(s => s.macroTargets)
  const dietType = useProfileStore(s => s.profile?.dietType)
  const burnedKcal = usePlanStore(s => s.burnedKcal)

  return useMemo(
    () => (macroTargets ? addExerciseToTargets(macroTargets, burnedKcal, dietType) : null),
    [macroTargets, burnedKcal, dietType]
  )
}
