import type { FoodDetail, FoodPortion, ServingUnit } from './types'

// Branded unit-code normalisation
// USDA branded data uses inconsistent codes: "GRM"/"GM" for grams, "MLT" for ml, etc.
const UNIT_CODE_MAP: Record<string, ServingUnit> = {
  g: 'g', grm: 'g', gm: 'g',
  ml: 'ml', mlt: 'ml',
  oz: 'oz',
  cup: 'cup',
  tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp',
  fl_oz: 'fl_oz', 'fl oz': 'fl_oz',
  lb: 'lb', lbs: 'lb',
  kg: 'kg',
}

export function normalizeSizeUnit(raw: string): ServingUnit | null {
  return UNIT_CODE_MAP[raw.toLowerCase().trim()] ?? null
}

// Smart serving defaults
const EGG_WORDS     = ['egg']
const LIQUID_WORDS  = ['milk', 'juice', 'beverage', 'drink', 'broth', 'stock', 'tea', 'coffee', 'water', 'soda', 'smoothie', 'lemonade', 'cider']
const PROTEIN_WORDS = ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'veal', 'bison', 'venison', 'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'halibut', 'steak', 'breast', 'thigh', 'drumstick', 'loin', 'sirloin', 'ribeye', 'tenderloin']

export function getSmartDefault(food: FoodDetail): { unit: ServingUnit; amount: number } {
  // 1. Branded foods — use the label serving size
  if (food.dataType === 'branded_food') {
    if (food.servingSize && food.servingSizeUnit) {
      const unit = normalizeSizeUnit(food.servingSizeUnit)
      // Known unit → use it directly; unknown (IU, MG, etc.) → fall back to grams
      // USDA always stores the gram-equivalent in serving_size when unit is exotic
      return { unit: unit ?? 'g', amount: food.servingSize }
    }
    if (food.portions.length > 0) return { unit: 'serving', amount: 1 }
    return { unit: 'g', amount: 100 }
  }

  // 2. USDA foods — keyword-based category detection
  const desc = food.description.toLowerCase()

  // Eggs first (egg whites/yolks also hit protein keywords — check eggs before proteins)
  if (EGG_WORDS.some(w => desc.includes(w)))     return { unit: 'g', amount: 50 }
  if (LIQUID_WORDS.some(w => desc.includes(w)))  return { unit: 'cup', amount: 1 }
  if (PROTEIN_WORDS.some(w => desc.includes(w))) return { unit: 'oz', amount: 4 }

  // Use the first USDA portion as "1 serving" when available
  if (food.portions.length > 0) return { unit: 'serving', amount: 1 }

  return { unit: 'g', amount: 100 }
}

const UNIT_ALIASES: Record<string, string[]> = {
  cup:   ['cup', 'cups', 'c.'],
  tbsp:  ['tablespoon', 'tbsp', 'tbs', 'tablespoons'],
  tsp:   ['teaspoon', 'tsp', 'teaspoons'],
  oz:    ['oz', 'ounce', 'ounces'],
  fl_oz: ['fl oz', 'fluid ounce', 'fluid ounces', 'fl. oz.'],
  lb:    ['lb', 'lbs', 'pound', 'pounds']
}

function findPortionMatch(unit: ServingUnit, portions: FoodPortion[]): FoodPortion | undefined {
  const aliases = UNIT_ALIASES[unit]
  if (!aliases) return undefined
  return portions.find(p =>
    aliases.some(a => p.measureUnit.toLowerCase().includes(a))
  )
}

function baseToGrams(amount: number, unit: ServingUnit): number {
  switch (unit) {
    case 'g':     return amount
    case 'kg':    return amount * 1000
    case 'oz':    return amount * 28.3495
    case 'lb':    return amount * 453.592
    case 'ml':    return amount
    case 'l':     return amount * 1000
    case 'fl_oz': return amount * 29.5735
    case 'cup':   return amount * 236.588
    case 'tbsp':  return amount * 14.7868
    case 'tsp':   return amount * 4.92892
    default:      return amount * 100
  }
}

export function toGrams(amount: number, unit: ServingUnit, food: FoodDetail): number {
  if (unit === 'serving') {
    if (food.servingSize && food.servingSizeUnit) {
      const sizeUnit = food.servingSizeUnit.toLowerCase() as ServingUnit
      if (sizeUnit === 'g') return amount * food.servingSize
      if (sizeUnit !== 'serving') return toGrams(amount * food.servingSize, sizeUnit, food)
    }
    if (food.portions.length > 0) return amount * food.portions[0].gramWeight
    return amount * 100
  }

  const portionMatch = findPortionMatch(unit, food.portions)
  if (portionMatch) {
    return (amount / portionMatch.amount) * portionMatch.gramWeight
  }

  return baseToGrams(amount, unit)
}

export const SERVING_UNIT_LABELS: Record<ServingUnit, string> = {
  g: 'g',
  kg: 'kg',
  oz: 'oz',
  lb: 'lb',
  ml: 'ml',
  l: 'l',
  fl_oz: 'fl oz',
  cup: 'cup',
  tbsp: 'tbsp',
  tsp: 'tsp',
  serving: 'serving'
}

export const ALL_SERVING_UNITS: ServingUnit[] = [
  'g', 'oz', 'lb', 'kg', 'serving', 'cup', 'tbsp', 'tsp', 'ml', 'fl_oz', 'l'
]
