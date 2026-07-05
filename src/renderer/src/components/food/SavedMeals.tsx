import { useState, useEffect } from 'react'
import { Plus, Trash2, Flame, Check } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { fmt } from '../../lib/formatters'

interface SavedMeal {
  id: number
  name: string
  itemCount: number
  calories: number
}

export function SavedMeals() {
  const { logSavedMeal } = usePlanStore()
  const [items, setItems] = useState<SavedMeal[]>([])
  const [adding, setAdding] = useState<number | null>(null)
  const [added, setAdded] = useState<number | null>(null)

  function reload() {
    window.api.savedMealList().then(setItems)
  }
  useEffect(() => { reload() }, [])

  async function handleLog(id: number) {
    if (adding) return
    setAdding(id)
    try {
      await logSavedMeal(id)
      setAdded(id)
      setTimeout(() => setAdded(null), 2000)
    } finally {
      setAdding(null)
    }
  }

  async function handleDelete(id: number) {
    await window.api.savedMealDelete({ id })
    reload()
  }

  return (
    <div className="overflow-y-auto max-h-64">
      {items.length === 0 ? (
        <div className="text-center py-5">
          <p className="text-xs text-gray-600">No saved meals yet.</p>
          <p className="text-xs text-gray-700 mt-0.5">Log some foods, then tap &ldquo;Save as meal&rdquo; on a meal header.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800/50">
          {items.map(m => (
            <div key={m.id} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800/40 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 truncate">{m.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-gray-500">{m.itemCount} item{m.itemCount === 1 ? '' : 's'}</span>
                  <span className="flex items-center gap-0.5 text-xs text-gray-500">
                    <Flame size={9} className="text-orange-400" />{fmt(m.calories, 0)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-700 hover:text-red-400 transition-colors"
                title="Delete saved meal"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={() => handleLog(m.id)}
                disabled={!!adding}
                className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  added === m.id
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'bg-gray-800 hover:bg-emerald-600 text-gray-400 hover:text-white'
                }`}
                title="Log this meal"
              >
                {added === m.id ? <Check size={13} /> : <Plus size={13} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
