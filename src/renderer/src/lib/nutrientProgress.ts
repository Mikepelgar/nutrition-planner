import type { NutrientProgressData } from './types'

export function computeNutrientProgress(
  intake: number,
  rdi: number,
  ul: number | null
): Pick<NutrientProgressData, 'state' | 'primaryBarPercent' | 'secondaryBarPercent' | 'displayPercent'> {
  const rdiRatio = rdi > 0 ? intake / rdi : 0
  const displayPercent = Math.round(rdiRatio * 100)

  if (ul !== null && intake > ul) {
    return { state: 'excess', primaryBarPercent: 100, secondaryBarPercent: 100, displayPercent }
  }

  if (rdiRatio <= 1.0) {
    return {
      state: 'normal',
      primaryBarPercent: Math.min(rdiRatio * 100, 100),
      secondaryBarPercent: 0,
      displayPercent
    }
  }

  const ceiling = ul ?? rdi * 1.5
  const overRdiRatio = ceiling > rdi ? (intake - rdi) / (ceiling - rdi) : 1
  return {
    state: 'over-rdi',
    primaryBarPercent: 100,
    secondaryBarPercent: Math.min(overRdiRatio * 100, 100),
    displayPercent
  }
}

export const NUTRIENT_GROUPS: Array<{ label: string; nutrientIds: number[] }> = [
  {
    label: 'Macros',
    nutrientIds: [1008, 1003, 1004, 1005, 1079, 2000, 1258, 1293, 1257, 1253]
  },
  {
    label: 'Vitamins',
    nutrientIds: [1162, 1106, 1114, 1109, 1185, 1165, 1166, 1167, 1175, 1177, 1178, 1176, 1170, 1180]
  },
  {
    label: 'Minerals',
    nutrientIds: [1087, 1089, 1090, 1091, 1095, 1098, 1101, 1103]
  },
  {
    label: 'Electrolytes',
    nutrientIds: [1093, 1092]
  }
]
