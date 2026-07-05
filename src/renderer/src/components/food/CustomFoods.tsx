import { useState, useEffect } from 'react'
import { Plus, Trash2, Flame } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import type { FoodDetail, ServingUnit } from '../../lib/types'
import { fmt } from '../../lib/formatters'
import { CustomFoodForm } from './CustomFoodForm'
import { ServingPicker } from './ServingPicker'

interface CustomFood {
  fdcId: number
  description: string
  servingG: number
  caloriesPerServing: number
}

export function CustomFoods() {
  const { addEntry } = usePlanStore()
  const [items, setItems] = useState<CustomFood[]>([])
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<FoodDetail | null>(null)

  function reload() {
    window.api.customFoodList().then(setItems)
  }
  useEffect(() => { reload() }, [])

  async function openPicker(fdcId: number) {
    const detail = await window.api.foodDetail({ fdcId })
    if (detail) setSelected(detail)
  }

  async function handleAdd(servingUnit: ServingUnit, servingAmount: number) {
    if (!selected) return
    await addEntry(selected, servingUnit, servingAmount)
    setSelected(null)
  }

  async function handleDelete(fdcId: number) {
    const res = await window.api.customFoodDelete({ fdcId })
    if (res.success) reload()
    else if (res.reason === 'in_use') alert('This food is used in a logged day — remove those entries first.')
  }

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2 border-b border-gray-800">
        {creating ? (
          <CustomFoodForm
            onCancel={() => setCreating(false)}
            onCreated={() => { setCreating(false); reload() }}
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs bg-gray-800 hover:bg-emerald-600 text-gray-300 hover:text-white py-2 rounded-lg transition-colors"
          >
            <Plus size={13} /> Create custom food
          </button>
        )}
      </div>

      {selected && (
        <div className="px-4 py-2 border-b border-gray-800">
          <ServingPicker food={selected} onAdd={handleAdd} onCancel={() => setSelected(null)} />
        </div>
      )}

      <div className="overflow-y-auto max-h-56">
        {items.length === 0 && !creating ? (
          <div className="text-center py-5">
            <p className="text-xs text-gray-600">No custom foods yet.</p>
            <p className="text-xs text-gray-700 mt-0.5">Create one for home-cooked meals or items not in the database.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {items.map(item => (
              <div key={item.fdcId} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 truncate">{item.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-gray-500">{fmt(item.servingG, 0)}g serving</span>
                    <span className="flex items-center gap-0.5 text-xs text-gray-500">
                      <Flame size={9} className="text-orange-400" />{fmt(item.caloriesPerServing, 0)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item.fdcId)}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-700 hover:text-red-400 transition-colors"
                  title="Delete custom food"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  onClick={() => openPicker(item.fdcId)}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-gray-800 hover:bg-emerald-600 text-gray-400 hover:text-white transition-colors"
                  title="Add to log"
                >
                  <Plus size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
