// GENERATED — do not edit. Source of truth is src/shared/ (and lib/types.ts).
// Regenerate with: node scripts/sync-shared.mjs

export type ServingUnit = 'g' | 'kg' | 'oz' | 'lb' | 'ml' | 'l' | 'fl_oz' | 'cup' | 'tbsp' | 'tsp' | 'serving'

export type Sex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active'

export type Goal = 'maintain' | 'bulk' | 'cut' | 'recomp'

export type ChatMode = Goal

export type SuggestionStyle =
  | 'standard'
  | 'budget'
  | 'convenience'
  | 'high_protein'
  | 'whole_foods'
  | 'vegetarian'
  | 'low_sodium'

export type DietType =
  | 'balanced'
  | 'keto'
  | 'low_carb'
  | 'high_protein'
  | 'low_fat'
  | 'paleo'
  | 'mediterranean'
  | 'vegetarian'
  | 'vegan'

export type Allergen =
  | 'dairy'
  | 'eggs'
  | 'peanuts'
  | 'tree_nuts'
  | 'soy'
  | 'gluten'
  | 'fish'
  | 'shellfish'
  | 'sesame'

export type UnitSystem = 'metric' | 'imperial'

export interface UserProfile {
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
  goalKcal?: number
  dietType?: DietType
  allergens?: Allergen[]
  avoidFoods?: string[]
  goalWeightKg?: number
  unitSystem?: UnitSystem
  useCustomTargets?: boolean
  customCalories?: number
  customProteinG?: number
  customCarbsG?: number
  customFatG?: number
}

export interface MacroTargets {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface WeightEntry {
  date: string
  weightKg: number
}

export interface Exercise {
  id: number
  date: string
  name: string
  caloriesBurned: number
  durationMin: number | null
}

export interface ReminderPrefs {
  enabled: boolean
  mealsEnabled: boolean
  meals: { breakfast: string; lunch: string; dinner: string }
  waterEnabled: boolean
  waterIntervalHours: number
}

export interface FoodSearchResult {
  fdcId: number
  description: string
  dataType: 'sr_legacy_food' | 'foundation_food' | 'branded_food'
  brandOwner: string | null
  caloriesPer100g: number | null
}

export interface FoodPortion {
  id: number
  amount: number
  measureUnit: string
  portionDescription: string | null
  gramWeight: number
}

export interface FoodNutrient {
  nutrientId: number
  name: string
  unit: string
  amount: number
}

export interface FoodDetail extends FoodSearchResult {
  nutrients: FoodNutrient[]
  portions: FoodPortion[]
  servingSize: number | null
  servingSizeUnit: string | null
  householdServing: string | null
}

export interface Plan {
  id: number
  date: string
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface PlanEntry {
  id: number
  planId: number
  fdcId: number
  foodDescription: string
  servingUnit: ServingUnit
  servingAmount: number
  grams: number
  position: number
  meal: MealType
}

export interface NutrientTotal {
  nutrientId: number
  name: string
  unit: string
  intake: number
}

export type ProgressState = 'normal' | 'over-rdi' | 'excess'

export interface NutrientProgressData {
  nutrientId: number
  name: string
  unit: string
  intake: number
  rdi: number
  ul: number | null
  state: ProgressState
  primaryBarPercent: number
  secondaryBarPercent: number
  displayPercent: number
}
