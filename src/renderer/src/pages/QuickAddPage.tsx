import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, Check, Flame } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { Skeleton } from '../components/ui/Skeleton'
import { fmt, fmtDate } from '../lib/formatters'
import { SERVING_UNIT_LABELS } from '../lib/unitConversion'
import type { ServingUnit } from '../lib/types'

interface QuickItem {
  fdcId: number
  foodDescription: string
  servingUnit: string
  servingAmount: number
  grams: number
  caloriesPer100g: number | null
  useCount: number
  lastUsed: string
}

export function QuickAddPage() {
  const { date, addEntry } = usePlanStore()
  const [items, setItems] = useState<QuickItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<string | null>(null)   // key of item being added
  const [added, setAdded] = useState<Set<string>>(new Set())  // recently added keys

  useEffect(() => {
    window.api.quickAddGetRecent().then(data => {
      setItems(data as QuickItem[])
      setLoading(false)
    })
  }, [])

  // Filter by search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(i => i.foodDescription.toLowerCase().includes(q))
  }, [items, query])

  function itemKey(item: QuickItem) {
    return `${item.fdcId}__${item.servingUnit}__${item.servingAmount}`
  }

  async function handleAdd(item: QuickItem) {
    const key = itemKey(item)
    if (adding) return
    setAdding(key)
    try {
      const food = await window.api.foodDetail({ fdcId: item.fdcId })
      if (food) {
        await addEntry(food, item.servingUnit as ServingUnit, item.servingAmount)
        setAdded(prev => new Set(prev).add(key))
        setTimeout(() => setAdded(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        }), 2000)
      }
    } finally {
      setAdding(null)
    }
  }

  const calories = (item: QuickItem) =>
    item.caloriesPer100g != null ? Math.round((item.grams / 100) * item.caloriesPer100g) : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-200">Quick Add</h1>
            <p className="text-xs text-gray-500 mt-0.5">Adding to <span className="text-emerald-400">{fmtDate(date)}</span></p>
          </div>
          {items.length > 0 && (
            <span className="text-xs text-gray-600">{items.length} foods</span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter foods…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded-lg pl-8 pr-3 py-2 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500">
              {query ? 'No matching foods.' : 'No foods logged yet.'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {!query && 'Foods you log in Add will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {filtered.map(item => {
              const key = itemKey(item)
              const cal = calories(item)
              const isAdding = adding === key
              const wasAdded = added.has(key)
              const label = SERVING_UNIT_LABELS[item.servingUnit as ServingUnit] ?? item.servingUnit

              return (
                <div key={key} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-900/50 transition-colors">
                  {/* Food info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{item.foodDescription}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">
                        {fmt(item.servingAmount)} {label} · {fmt(item.grams, 0)}g
                      </span>
                      {cal != null && (
                        <span className="flex items-center gap-0.5 text-xs text-gray-500">
                          <Flame size={10} className="text-orange-400" />
                          {fmt(cal, 0)} kcal
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Use count */}
                  {item.useCount > 1 && (
                    <span className="text-xs text-gray-600 shrink-0">{item.useCount}×</span>
                  )}

                  {/* Add button */}
                  <button
                    onClick={() => handleAdd(item)}
                    disabled={!!adding}
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      wasAdded
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : isAdding
                          ? 'bg-gray-800 text-gray-500'
                          : 'bg-gray-800 hover:bg-emerald-600 text-gray-400 hover:text-white'
                    } disabled:cursor-not-allowed`}
                    title={wasAdded ? 'Added!' : 'Add to log'}
                  >
                    {wasAdded ? <Check size={14} /> : <Plus size={14} />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
