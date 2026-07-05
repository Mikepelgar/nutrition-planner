/**
 * DRI (RDI + upper-limit) reference table — the SINGLE source of truth for
 * nutrient targets, following the `macros.ts` pattern: pure (no Electron/DOM
 * deps) so the main process (AI briefing) and the renderer (nutrient bars on
 * the Add/Dashboard/History pages) read identical numbers. Previously the
 * renderer kept two hand-copied mirrors that had drifted from this table.
 */
import type { Sex } from '../renderer/src/lib/types'

export interface NutrientDRI {
  nutrientId: number
  name: string
  unit: string
  rdi: number
  ul: number | null
}

export interface DRIBracket {
  sex: Sex
  minAge: number
  maxAge: number
  nutrients: NutrientDRI[]
}

function makeBracket(sex: Sex, minAge: number, maxAge: number, overrides: Partial<Record<number, Partial<NutrientDRI>>> = {}): DRIBracket {
  const base: NutrientDRI[] = [
    // --- Macros ---
    { nutrientId: 1008, name: 'Calories',          unit: 'kcal', rdi: 2000, ul: null },
    { nutrientId: 1003, name: 'Protein',           unit: 'g',    rdi: sex === 'male' ? 56 : 46, ul: null },
    { nutrientId: 1004, name: 'Total Fat',         unit: 'g',    rdi: sex === 'male' ? 78 : 62, ul: null },
    { nutrientId: 1005, name: 'Carbohydrates',     unit: 'g',    rdi: 130, ul: null },
    { nutrientId: 1079, name: 'Fiber',             unit: 'g',    rdi: sex === 'male' ? 38 : 25, ul: null },
    { nutrientId: 2000, name: 'Sugars',            unit: 'g',    rdi: 50,  ul: null },
    { nutrientId: 1258, name: 'Saturated Fat',     unit: 'g',    rdi: 20,  ul: null },
    { nutrientId: 1257, name: 'Trans Fat',         unit: 'g',    rdi: 2,   ul: null },
    { nutrientId: 1253, name: 'Cholesterol',       unit: 'mg',   rdi: 300, ul: null },
    { nutrientId: 1293, name: 'Polyunsaturated Fat', unit: 'g',  rdi: sex === 'male' ? 17 : 12, ul: null },
    // --- Vitamins ---
    { nutrientId: 1162, name: 'Vitamin C',         unit: 'mg',   rdi: sex === 'male' ? 90 : 75, ul: 2000 },
    { nutrientId: 1106, name: 'Vitamin A',         unit: 'mcg',  rdi: sex === 'male' ? 900 : 700, ul: 3000 },
    { nutrientId: 1114, name: 'Vitamin D',         unit: 'mcg',  rdi: 15,  ul: 100 },
    { nutrientId: 1109, name: 'Vitamin E',         unit: 'mg',   rdi: 15,  ul: 1000 },
    { nutrientId: 1185, name: 'Vitamin K',         unit: 'mcg',  rdi: sex === 'male' ? 120 : 90, ul: null },
    { nutrientId: 1165, name: 'Thiamin (B1)',      unit: 'mg',   rdi: sex === 'male' ? 1.2 : 1.1, ul: null },
    { nutrientId: 1166, name: 'Riboflavin (B2)',   unit: 'mg',   rdi: sex === 'male' ? 1.3 : 1.1, ul: null },
    { nutrientId: 1167, name: 'Niacin (B3)',       unit: 'mg',   rdi: sex === 'male' ? 16 : 14, ul: 35 },
    { nutrientId: 1175, name: 'Vitamin B6',        unit: 'mg',   rdi: 1.3, ul: 100 },
    { nutrientId: 1177, name: 'Folate',            unit: 'mcg',  rdi: 400, ul: 1000 },
    { nutrientId: 1178, name: 'Vitamin B12',       unit: 'mcg',  rdi: 2.4, ul: null },
    { nutrientId: 1176, name: 'Biotin',            unit: 'mcg',  rdi: 30,  ul: null },
    { nutrientId: 1170, name: 'Pantothenic Acid',  unit: 'mg',   rdi: 5,   ul: null },
    { nutrientId: 1180, name: 'Choline',           unit: 'mg',   rdi: sex === 'male' ? 550 : 425, ul: 3500 },
    // --- Minerals ---
    { nutrientId: 1087, name: 'Calcium',           unit: 'mg',   rdi: 1000, ul: 2500 },
    { nutrientId: 1089, name: 'Iron',              unit: 'mg',   rdi: sex === 'male' ? 8 : 18, ul: 45 },
    { nutrientId: 1090, name: 'Magnesium',         unit: 'mg',   rdi: sex === 'male' ? 400 : 310, ul: 350 },
    { nutrientId: 1091, name: 'Phosphorus',        unit: 'mg',   rdi: 700,  ul: 4000 },
    { nutrientId: 1095, name: 'Zinc',              unit: 'mg',   rdi: sex === 'male' ? 11 : 8, ul: 40 },
    { nutrientId: 1098, name: 'Copper',            unit: 'mg',   rdi: 0.9,  ul: 10 },
    { nutrientId: 1101, name: 'Manganese',         unit: 'mg',   rdi: sex === 'male' ? 2.3 : 1.8, ul: 11 },
    { nutrientId: 1103, name: 'Selenium',          unit: 'mcg',  rdi: 55,   ul: 400 },
    // --- Electrolytes ---
    { nutrientId: 1093, name: 'Sodium',            unit: 'mg',   rdi: 1500, ul: 2300 },
    { nutrientId: 1092, name: 'Potassium',         unit: 'mg',   rdi: sex === 'male' ? 3400 : 2600, ul: null }
  ]

  return {
    sex,
    minAge,
    maxAge,
    nutrients: base.map(n => {
      const ov = overrides[n.nutrientId]
      return ov ? { ...n, ...ov } : n
    })
  }
}

export const DRI_TABLE: DRIBracket[] = [
  // Males 19-30
  makeBracket('male', 19, 30, {
    1090: { rdi: 400 }
  }),
  // Males 31-50
  makeBracket('male', 31, 50, {
    1090: { rdi: 420 }
  }),
  // Males 51-70
  makeBracket('male', 51, 70, {
    1087: { rdi: 1000 },
    1114: { rdi: 15 },
    1090: { rdi: 420 },
    1175: { rdi: 1.7, ul: 100 }
  }),
  // Males 71+
  makeBracket('male', 71, 999, {
    1087: { rdi: 1200 },
    1114: { rdi: 20 },
    1090: { rdi: 420 },
    1175: { rdi: 1.7, ul: 100 }
  }),
  // Females 19-30
  makeBracket('female', 19, 30, {
    1087: { rdi: 1000 },
    1090: { rdi: 310 }
  }),
  // Females 31-50
  makeBracket('female', 31, 50, {
    1087: { rdi: 1000 },
    1090: { rdi: 320 }
  }),
  // Females 51-70
  makeBracket('female', 51, 70, {
    1087: { rdi: 1200 },
    1089: { rdi: 8 },
    1114: { rdi: 15 },
    1090: { rdi: 320 },
    1175: { rdi: 1.5, ul: 100 }
  }),
  // Females 71+
  makeBracket('female', 71, 999, {
    1087: { rdi: 1200 },
    1089: { rdi: 8 },
    1114: { rdi: 20 },
    1090: { rdi: 320 },
    1175: { rdi: 1.5, ul: 100 }
  })
]

export function getDRIForProfile(age: number, sex: Sex): NutrientDRI[] {
  const bracket = DRI_TABLE.find(b => b.sex === sex && age >= b.minAge && age <= b.maxAge)
  return bracket?.nutrients ?? DRI_TABLE[0].nutrients
}
