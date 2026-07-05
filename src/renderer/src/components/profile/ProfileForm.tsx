import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { UserProfile, Allergen, DietType, UnitSystem } from '../../lib/types'
import { useProfileStore } from '../../store/useProfileStore'
import { calcMacroTargets, DIET_LABELS } from '../../../../shared/macros'
import { kgToDisplay, displayToKg, weightUnitLabel, cmToFtIn, ftInToCm, round } from '../../lib/units'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { fmt } from '../../lib/formatters'

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary (little or no exercise)' },
  { value: 'lightly_active', label: 'Lightly Active (1-3 days/week)' },
  { value: 'moderately_active', label: 'Moderately Active (3-5 days/week)' },
  { value: 'very_active', label: 'Very Active (6-7 days/week)' },
  { value: 'extra_active', label: 'Extra Active (intense daily training)' }
]

const GOAL_OPTIONS = [
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'cut', label: 'Cut / Lose fat' },
  { value: 'bulk', label: 'Gain / Build muscle' },
  { value: 'recomp', label: 'Body recomposition' }
]

const DIET_OPTIONS = (Object.keys(DIET_LABELS) as DietType[]).map(value => ({
  value,
  label: DIET_LABELS[value]
}))

const ALLERGEN_OPTIONS: Array<{ value: Allergen; label: string }> = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'tree_nuts', label: 'Tree nuts' },
  { value: 'soy', label: 'Soy' },
  { value: 'gluten', label: 'Gluten / Wheat' },
  { value: 'fish', label: 'Fish' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'sesame', label: 'Sesame' }
]

const DEFAULT_GOAL_KCAL: Record<string, number> = { bulk: 300, cut: 500 }

const EMPTY_FORM: UserProfile = {
  age: 25,
  sex: 'male',
  heightCm: 175,
  weightKg: 75,
  activityLevel: 'moderately_active',
  goal: 'maintain',
  dietType: 'balanced',
  allergens: [],
  avoidFoods: []
}

interface Props {
  onboarding?: boolean
  onSaved?: () => void
}

export function ProfileForm({ onboarding = false, onSaved }: Props) {
  const { profile, save } = useProfileStore()
  const [form, setForm] = useState<UserProfile>(EMPTY_FORM)
  const [avoidInput, setAvoidInput] = useState('')
  const [saved, setSaved] = useState(false)
  // Local display strings for unit-converted fields (avoids decimal-typing jitter).
  const [weightStr, setWeightStr] = useState('')
  const [ftStr, setFtStr] = useState('')
  const [inStr, setInStr] = useState('')
  const [goalWeightStr, setGoalWeightStr] = useState('')

  function syncUnitStrings(f: UserProfile, u: UnitSystem): void {
    setWeightStr(String(round(kgToDisplay(f.weightKg, u), 1)))
    const { ft, inch } = cmToFtIn(f.heightCm)
    setFtStr(String(ft))
    setInStr(String(inch))
    setGoalWeightStr(f.goalWeightKg != null ? String(round(kgToDisplay(f.goalWeightKg, u), 1)) : '')
  }

  useEffect(() => {
    if (profile) {
      const f = { ...EMPTY_FORM, ...profile }
      setForm(f)
      syncUnitStrings(f, f.unitSystem ?? 'metric')
    }
  }, [profile])

  function set<K extends keyof UserProfile>(key: K, val: UserProfile[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  const unit: UnitSystem = form.unitSystem ?? 'metric'

  function setUnit(u: UnitSystem) {
    setForm(f => ({ ...f, unitSystem: u }))
    syncUnitStrings(form, u)
  }

  function onWeightChange(v: string) {
    setWeightStr(v)
    const n = parseFloat(v)
    if (Number.isFinite(n)) set('weightKg', displayToKg(n, unit))
  }
  function onGoalWeightChange(v: string) {
    setGoalWeightStr(v)
    const n = parseFloat(v)
    set('goalWeightKg', v && Number.isFinite(n) ? displayToKg(n, unit) : undefined)
  }
  function onFtInChange(ft: string, inch: string) {
    setFtStr(ft); setInStr(inch)
    set('heightCm', ftInToCm(parseInt(ft) || 0, parseInt(inch) || 0))
  }

  function handleGoalChange(goal: UserProfile['goal']) {
    setForm(f => ({
      ...f,
      goal,
      goalKcal: goal === 'bulk' || goal === 'cut' ? (f.goalKcal ?? DEFAULT_GOAL_KCAL[goal]) : undefined
    }))
  }

  function toggleAllergen(a: Allergen) {
    setForm(f => {
      const cur = f.allergens ?? []
      return { ...f, allergens: cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a] }
    })
  }

  function addAvoidFood() {
    const v = avoidInput.trim().toLowerCase()
    if (!v) return
    setForm(f => {
      const cur = f.avoidFoods ?? []
      return cur.includes(v) ? f : { ...f, avoidFoods: [...cur, v] }
    })
    setAvoidInput('')
  }

  function removeAvoidFood(v: string) {
    setForm(f => ({ ...f, avoidFoods: (f.avoidFoods ?? []).filter(x => x !== v) }))
  }

  async function handleSave() {
    await save(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved?.()
  }

  // Live preview — recompute targets from the in-progress form (instant feedback
  // before saving), via the same shared engine the rest of the app uses.
  const preview = calcMacroTargets(form)
  const showGoalKcal = form.goal === 'bulk' || form.goal === 'cut'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-100">
          {onboarding ? 'Welcome to Nutrition Planner' : 'Profile'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {onboarding
            ? "Let's set up your profile — this drives your personalized daily targets and tailors AI suggestions."
            : 'Personalized targets and AI suggestions are based on this. Change it anytime.'}
        </p>
      </div>

      {/* Personal info */}
      <div className="bg-gray-900 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-400">Personal Info</h2>
          <div className="flex gap-1">
            {(['metric', 'imperial'] as UnitSystem[]).map(u => (
              <button key={u} type="button" onClick={() => setUnit(u)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  unit === u ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}>
                {u === 'metric' ? 'Metric' : 'Imperial'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Age" type="number" min={14} max={120} value={form.age}
            onChange={e => set('age', parseInt(e.target.value) || 25)} />
          <Select label="Sex" value={form.sex}
            onChange={e => set('sex', e.target.value as UserProfile['sex'])}
            options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
          {unit === 'metric' ? (
            <Input label="Height (cm)" type="number" min={100} max={250} step="0.1" value={form.heightCm}
              onChange={e => set('heightCm', parseFloat(e.target.value) || 170)} />
          ) : (
            <div className="flex gap-2">
              <Input label="Height (ft)" type="number" min={1} max={8} value={ftStr}
                onChange={e => onFtInChange(e.target.value, inStr)} />
              <Input label="in" type="number" min={0} max={11} value={inStr}
                onChange={e => onFtInChange(ftStr, e.target.value)} />
            </div>
          )}
          <Input label={`Weight (${weightUnitLabel(unit)})`} type="number" min={1} step="0.1" value={weightStr}
            onChange={e => onWeightChange(e.target.value)} />
        </div>
      </div>

      {/* Goals & diet */}
      <div className="bg-gray-900 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-medium text-gray-400">Goals &amp; Diet</h2>
        <Select label="Activity Level" value={form.activityLevel}
          onChange={e => set('activityLevel', e.target.value as UserProfile['activityLevel'])}
          options={ACTIVITY_OPTIONS} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Goal" value={form.goal}
            onChange={e => handleGoalChange(e.target.value as UserProfile['goal'])}
            options={GOAL_OPTIONS} />
          <Select label="Diet Type" value={form.dietType ?? 'balanced'}
            onChange={e => set('dietType', e.target.value as DietType)}
            options={DIET_OPTIONS} />
        </div>
        {showGoalKcal && (
          <Input
            label={form.goal === 'bulk' ? 'Daily surplus (kcal)' : 'Daily deficit (kcal)'}
            type="number" min={50} max={1000} step={50}
            value={form.goalKcal ?? DEFAULT_GOAL_KCAL[form.goal]}
            onChange={e => set('goalKcal', parseInt(e.target.value) || DEFAULT_GOAL_KCAL[form.goal])} />
        )}
        <Input label={`Goal weight (${weightUnitLabel(unit)}, optional)`} type="number" min={1} step="0.1"
          value={goalWeightStr} placeholder="optional"
          onChange={e => onGoalWeightChange(e.target.value)} />

        <div className="pt-1 border-t border-gray-800">
          <label className="flex items-center justify-between cursor-pointer py-1.5">
            <span className="text-xs text-gray-400 font-medium">Set my own targets (skip the formula)</span>
            <input type="checkbox" checked={!!form.useCustomTargets}
              onChange={e => set('useCustomTargets', e.target.checked)} className="accent-emerald-500 w-4 h-4" />
          </label>
          {form.useCustomTargets && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Input label="Calories" type="number" min={0} value={form.customCalories ?? ''}
                onChange={e => set('customCalories', e.target.value ? parseFloat(e.target.value) : undefined)} />
              <Input label="Protein (g)" type="number" min={0} value={form.customProteinG ?? ''}
                onChange={e => set('customProteinG', e.target.value ? parseFloat(e.target.value) : undefined)} />
              <Input label="Carbs (g)" type="number" min={0} value={form.customCarbsG ?? ''}
                onChange={e => set('customCarbsG', e.target.value ? parseFloat(e.target.value) : undefined)} />
              <Input label="Fat (g)" type="number" min={0} value={form.customFatG ?? ''}
                onChange={e => set('customFatG', e.target.value ? parseFloat(e.target.value) : undefined)} />
            </div>
          )}
        </div>
      </div>

      {/* Restrictions */}
      <div className="bg-gray-900 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-medium text-gray-400">Allergies &amp; Avoidances</h2>
        <div>
          <label className="text-xs text-gray-400 font-medium mb-2 block">Allergens (the AI will never suggest these)</label>
          <div className="flex flex-wrap gap-2">
            {ALLERGEN_OPTIONS.map(a => {
              const on = (form.allergens ?? []).includes(a.value)
              return (
                <button key={a.value} type="button" onClick={() => toggleAllergen(a.value)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    on ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                  }`}>
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 font-medium mb-2 block">Foods to avoid</label>
          <div className="flex gap-2">
            <Input className="flex-1" placeholder="e.g. cilantro — Enter to add" value={avoidInput}
              onChange={e => setAvoidInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAvoidFood() } }} />
            <Button variant="ghost" onClick={addAvoidFood}>Add</Button>
          </div>
          {(form.avoidFoods ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {(form.avoidFoods ?? []).map(v => (
                <span key={v} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300">
                  {v}
                  <button type="button" onClick={() => removeAvoidFood(v)} className="text-gray-500 hover:text-gray-200">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live targets preview */}
      <div className="bg-gray-900 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Your Daily Targets{form.useCustomTargets ? ' (custom)' : ''}</h2>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Calories', value: `${fmt(preview.calories, 0)}` },
            { label: 'Protein', value: `${fmt(preview.proteinG, 0)}g` },
            { label: 'Carbs', value: `${fmt(preview.carbsG, 0)}g` },
            { label: 'Fat', value: `${fmt(preview.fatG, 0)}g` }
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-sm font-semibold text-gray-200">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} className="w-full">
        {saved ? '✓ Saved' : onboarding ? 'Get Started →' : 'Save Profile'}
      </Button>
    </div>
  )
}
