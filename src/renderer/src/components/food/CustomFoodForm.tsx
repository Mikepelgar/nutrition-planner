import { useState } from 'react'
import { Button } from '../ui/Button'

interface Props {
  onCreated: (fdcId: number) => void
  onCancel: () => void
}

const num = (s: string): number => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function CustomFoodForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [servingG, setServingG] = useState('100')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [sodium, setSodium] = useState('')
  const [sugar, setSugar] = useState('')
  const [saving, setSaving] = useState(false)

  const canSave = name.trim().length > 0 && num(servingG) > 0

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const res = await window.api.customFoodCreate({
        name: name.trim(),
        servingG: num(servingG),
        calories: num(calories),
        proteinG: num(protein),
        carbsG: num(carbs),
        fatG: num(fat),
        fiberG: fiber ? num(fiber) : undefined,
        sodiumMg: sodium ? num(sodium) : undefined,
        sugarG: sugar ? num(sugar) : undefined
      })
      onCreated(res.fdcId)
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, ph = '') => (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <input
        type="number" min="0" step="any" value={value} placeholder={ph}
        onChange={e => set(e.target.value)}
        className="w-full bg-gray-900 border border-gray-600 text-gray-100 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
      />
    </div>
  )

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-100">New custom food</p>

      <div>
        <label className="text-xs text-gray-400 mb-1 block">Name</label>
        <input
          type="text" value={name} placeholder="e.g. Grandma's chili"
          onChange={e => setName(e.target.value)}
          className="w-full bg-gray-900 border border-gray-600 text-gray-100 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {field('Serving size (g)', servingG, setServingG, '100')}
        {field('Calories (per serving)', calories, setCalories, '0')}
      </div>

      <p className="text-xs text-gray-500 -mb-1">Per serving:</p>
      <div className="grid grid-cols-3 gap-2">
        {field('Protein (g)', protein, setProtein, '0')}
        {field('Carbs (g)', carbs, setCarbs, '0')}
        {field('Fat (g)', fat, setFat, '0')}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {field('Fiber (g)', fiber, setFiber)}
        {field('Sodium (mg)', sodium, setSodium)}
        {field('Sugar (g)', sugar, setSugar)}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="flex-1" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Create food'}
        </Button>
      </div>
    </div>
  )
}
