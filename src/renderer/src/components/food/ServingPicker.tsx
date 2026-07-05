import { useState, useEffect } from 'react'
import type { FoodDetail, ServingUnit } from '../../lib/types'
import { toGrams, SERVING_UNIT_LABELS, ALL_SERVING_UNITS, getSmartDefault } from '../../lib/unitConversion'
import { fmt } from '../../lib/formatters'
import { Button } from '../ui/Button'

interface Props {
  food: FoodDetail
  onAdd: (servingUnit: ServingUnit, servingAmount: number) => void
  onCancel: () => void
}

export function ServingPicker({ food, onAdd, onCancel }: Props) {
  const [unit, setUnit] = useState<ServingUnit>('g')
  const [amount, setAmount] = useState('100')

  useEffect(() => {
    const { unit, amount } = getSmartDefault(food)
    setUnit(unit)
    setAmount(String(amount))
  }, [food])

  const numAmount = parseFloat(amount) || 0
  const grams = numAmount > 0 ? toGrams(numAmount, unit, food) : 0

  const calPer100 = food.nutrients.find(n => n.nutrientId === 1008)?.amount ?? 0
  const proteinPer100 = food.nutrients.find(n => n.nutrientId === 1003)?.amount ?? 0
  const fatPer100 = food.nutrients.find(n => n.nutrientId === 1004)?.amount ?? 0
  const carbsPer100 = food.nutrients.find(n => n.nutrientId === 1005)?.amount ?? 0

  const scale = grams / 100
  const cal = calPer100 * scale
  const protein = proteinPer100 * scale
  const fat = fatPer100 * scale
  const carbs = carbsPer100 * scale

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-100 truncate">{food.description}</p>
        {food.brandOwner && <p className="text-xs text-gray-500">{food.brandOwner}</p>}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-400 mb-1 block">Amount</label>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-400 mb-1 block">Unit</label>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value as ServingUnit)}
            className="w-full bg-gray-900 border border-gray-600 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            {ALL_SERVING_UNITS.map(u => (
              <option key={u} value={u}>{SERVING_UNIT_LABELS[u]}</option>
            ))}
          </select>
        </div>
      </div>

      {food.householdServing && (
        <p className="text-xs text-gray-500 -mt-1">
          Label serving: <span className="text-gray-400">{food.householdServing}</span>
        </p>
      )}

      {grams > 0 && (
        <div className="grid grid-cols-4 gap-1 text-center">
          {[
            { label: 'Cal', value: fmt(cal, 0) },
            { label: 'Protein', value: `${fmt(protein)}g` },
            { label: 'Fat', value: `${fmt(fat)}g` },
            { label: 'Carbs', value: `${fmt(carbs)}g` }
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 rounded-lg py-1.5 px-1">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-xs font-semibold text-gray-200">{value}</div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">{fmt(grams, 1)} g total</p>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          className="flex-1"
          disabled={grams <= 0}
          onClick={() => grams > 0 && onAdd(unit, numAmount)}
        >
          Add to Plan
        </Button>
      </div>
    </div>
  )
}
