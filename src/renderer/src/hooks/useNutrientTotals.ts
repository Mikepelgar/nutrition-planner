import { useMemo } from 'react'
import type { NutrientProgressData } from '../lib/types'
import { usePlanStore } from '../store/usePlanStore'
import { useProfileStore } from '../store/useProfileStore'
import { computeNutrientProgress } from '../lib/nutrientProgress'

// RDI data is mirrored client-side for display (main process is authoritative for AI)
const CLIENT_RDI: Record<number, { name: string; unit: string }> = {
  1008: { name: 'Calories', unit: 'kcal' },
  1003: { name: 'Protein', unit: 'g' },
  1004: { name: 'Total Fat', unit: 'g' },
  1005: { name: 'Carbohydrates', unit: 'g' },
  1079: { name: 'Fiber', unit: 'g' },
  2000: { name: 'Sugars', unit: 'g' },
  1258: { name: 'Saturated Fat', unit: 'g' },
  1257: { name: 'Trans Fat', unit: 'g' },
  1253: { name: 'Cholesterol', unit: 'mg' },
  1293: { name: 'Polyunsaturated Fat', unit: 'g' },
  1162: { name: 'Vitamin C', unit: 'mg' },
  1106: { name: 'Vitamin A', unit: 'mcg' },
  1114: { name: 'Vitamin D', unit: 'mcg' },
  1109: { name: 'Vitamin E', unit: 'mg' },
  1185: { name: 'Vitamin K', unit: 'mcg' },
  1165: { name: 'Thiamin (B1)', unit: 'mg' },
  1166: { name: 'Riboflavin (B2)', unit: 'mg' },
  1167: { name: 'Niacin (B3)', unit: 'mg' },
  1175: { name: 'Vitamin B6', unit: 'mg' },
  1177: { name: 'Folate', unit: 'mcg' },
  1178: { name: 'Vitamin B12', unit: 'mcg' },
  1176: { name: 'Biotin', unit: 'mcg' },
  1170: { name: 'Pantothenic Acid', unit: 'mg' },
  1180: { name: 'Choline', unit: 'mg' },
  1087: { name: 'Calcium', unit: 'mg' },
  1089: { name: 'Iron', unit: 'mg' },
  1090: { name: 'Magnesium', unit: 'mg' },
  1091: { name: 'Phosphorus', unit: 'mg' },
  1095: { name: 'Zinc', unit: 'mg' },
  1098: { name: 'Copper', unit: 'mg' },
  1101: { name: 'Manganese', unit: 'mg' },
  1103: { name: 'Selenium', unit: 'mcg' },
  1093: { name: 'Sodium', unit: 'mg' },
  1092: { name: 'Potassium', unit: 'mg' }
}

export function useNutrientTotals(): NutrientProgressData[] {
  const nutrientTotals = usePlanStore(s => s.nutrientTotals)
  const profile = useProfileStore(s => s.profile)
  const macroTargets = useProfileStore(s => s.macroTargets)

  return useMemo(() => {
    if (!profile || !macroTargets) return []

    const intakeMap = new Map(nutrientTotals.map(n => [n.nutrientId, n]))

    // Build RDI map inline (simplified — main constants/rdi.ts is authoritative)
    const getRdi = (id: number): number => {
      if (id === 1008) return macroTargets.calories
      if (id === 1003) return macroTargets.proteinG
      if (id === 1004) return macroTargets.fatG
      if (id === 1005) return macroTargets.carbsG
      // For micronutrients: rough age/sex defaults
      const isMale = profile.sex === 'male'
      const age = profile.age
      const rdiTable: Record<number, number> = {
        1079: isMale ? 38 : 25,
        2000: 50, 1258: 20, 1257: 2, 1253: 300, 1293: isMale ? 17 : 12,
        1162: isMale ? 90 : 75,
        1106: isMale ? 900 : 700,
        1114: 15,
        1109: 15, 1185: isMale ? 120 : 90,
        1165: isMale ? 1.2 : 1.1, 1166: isMale ? 1.3 : 1.1,
        1167: isMale ? 16 : 14, 1175: age > 50 ? (isMale ? 1.7 : 1.5) : 1.3,
        1177: 400, 1178: 2.4, 1176: 30, 1170: 5,
        1180: isMale ? 550 : 425,
        1087: age > 50 ? 1200 : 1000,
        1089: isMale ? 8 : (age > 50 ? 8 : 18),
        1090: isMale ? (age > 30 ? 420 : 400) : (age > 30 ? 320 : 310),
        1091: 700, 1095: isMale ? 11 : 8, 1098: 0.9,
        1101: isMale ? 2.3 : 1.8, 1103: 55,
        1093: 1500, 1092: isMale ? 3400 : 2600
      }
      return rdiTable[id] ?? 0
    }

    const getUl = (id: number): number | null => {
      const ulTable: Record<number, number> = {
        1162: 2000, 1106: 3000, 1114: 100, 1109: 1000,
        1167: 35, 1175: 100, 1177: 1000,
        1087: 2500, 1089: 45, 1090: 350, 1091: 4000,
        1095: 40, 1098: 10, 1101: 11, 1103: 400,
        1093: 2300, 1180: 3500
      }
      return ulTable[id] ?? null
    }

    return Object.entries(CLIENT_RDI)
      .map(([idStr, meta]) => {
        const nutrientId = Number(idStr)
        const rdi = getRdi(nutrientId)
        if (rdi === 0) return null
        const ul = getUl(nutrientId)
        const intake = intakeMap.get(nutrientId)?.intake ?? 0
        return {
          nutrientId,
          ...meta,
          intake,
          rdi,
          ul,
          ...computeNutrientProgress(intake, rdi, ul)
        } as NutrientProgressData
      })
      .filter((n): n is NutrientProgressData => n !== null)
  }, [nutrientTotals, profile, macroTargets])
}
