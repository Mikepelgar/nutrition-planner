import { useState } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { PlanEntry as Entry, ServingUnit } from '../../lib/types'
import { usePlanStore } from '../../store/usePlanStore'
import { ServingPicker } from '../food/ServingPicker'
import { fmt } from '../../lib/formatters'
import { SERVING_UNIT_LABELS } from '../../lib/unitConversion'

interface Props {
  entry: Entry
}

export function PlanEntryRow({ entry }: Props) {
  const { deleteEntry, updateEntry, foodCache } = usePlanStore()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const food = foodCache.get(entry.fdcId)

  const calPer100 = food?.nutrients.find(n => n.nutrientId === 1008)?.amount ?? 0
  const calories = (entry.grams / 100) * calPer100

  async function handleDelete() {
    setDeleting(true)
    await deleteEntry(entry.id)
  }

  async function handleUpdate(servingUnit: ServingUnit, servingAmount: number) {
    if (!food) return
    await updateEntry(entry.id, food, servingUnit, servingAmount)
    setEditing(false)
  }

  return (
    <div className="group border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 truncate">{entry.foodDescription}</p>
          <p className="text-xs text-gray-500">
            {fmt(entry.servingAmount)} {SERVING_UNIT_LABELS[entry.servingUnit]} · {fmt(entry.grams, 0)}g · {fmt(calories, 0)} kcal
          </p>
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          className="text-gray-600 hover:text-gray-400 transition-colors p-1"
          title="Edit serving"
        >
          {editing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-gray-600 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
          title="Remove"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {editing && food && (
        <div className="px-3 pb-3">
          <ServingPicker food={food} onAdd={handleUpdate} onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  )
}
