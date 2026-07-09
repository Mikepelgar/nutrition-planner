import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, Check, Flame, Star } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { useFavoritesStore } from '../../store/useFavoritesStore'
import { Skeleton } from '../ui/Skeleton'
import { fmt } from '../../lib/formatters'
import { SERVING_UNIT_LABELS } from '../../lib/unitConversion'
import type { ServingUnit } from '../../lib/types'

export type FoodHistoryMode = 'history' | 'favorites'

/** Row shape shared by both endpoints — see QuickAddItem (main/db/queries/quickadd.queries). */
type HistoryItem = Awaited<ReturnType<typeof window.api.quickAddGetRecent>>[number]

function itemKey(item: HistoryItem) {
  return `${item.fdcId}__${item.servingUnit}__${item.servingAmount}`
}

const EMPTY_MSG: Record<FoodHistoryMode, { primary: string; secondary: string }> = {
  history:   { primary: 'No foods logged yet.', secondary: 'Foods you log will show up here.' },
  favorites: { primary: 'No favorites yet.',    secondary: 'Tap ★ on any food to save it here.' }
}

interface Props {
  mode: FoodHistoryMode
}

export function RecentFoods({ mode }: Props) {
  const { addEntry } = usePlanStore()
  const { ids: favoriteIds, load: loadFavorites, toggle: toggleFavorite } = useFavoritesStore()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [togglingFav, setTogglingFav] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setQuery('')
    setError('')

    const loadItems =
      mode === 'favorites'
        ? window.api.favoritesGet().then(setItems)
        : window.api.quickAddGetRecent({}).then(setItems)

    Promise.all([loadFavorites(), loadItems])
      .catch(() => setError('Could not load foods. Switch tabs to retry.'))
      .finally(() => setLoading(false))
  }, [mode, loadFavorites])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter(i => i.foodDescription.toLowerCase().includes(q)) : items
  }, [items, query])

  async function handleAdd(item: HistoryItem) {
    const key = itemKey(item)
    if (adding) return
    setAdding(key)
    setError('')
    try {
      const food = await window.api.foodDetail({ fdcId: item.fdcId })
      if (food) {
        await addEntry(food, item.servingUnit as ServingUnit, item.servingAmount)
        setAdded(prev => new Set(prev).add(key))
        setTimeout(() => setAdded(prev => { const n = new Set(prev); n.delete(key); return n }), 2000)
      }
    } catch {
      setError("Couldn't add that food. Please try again.")
    } finally {
      setAdding(null)
    }
  }

  async function handleToggleFavorite(item: HistoryItem) {
    if (togglingFav !== null) return
    setTogglingFav(item.fdcId)
    try {
      const isFavorite = await toggleFavorite({
        fdcId: item.fdcId,
        foodDescription: item.foodDescription,
        servingUnit: item.servingUnit,
        servingAmount: item.servingAmount,
        grams: item.grams
      })
      // Remove from the favorites list if we're in favorites mode and just unstarred
      if (mode === 'favorites' && !isFavorite) {
        setItems(prev => prev.filter(i => i.fdcId !== item.fdcId))
      }
    } finally {
      setTogglingFav(null)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-2 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  const emptyMsg = EMPTY_MSG[mode]

  return (
    <div className="flex flex-col">
      {/* Filter input */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-gray-800/60 border border-gray-700/60 text-gray-100 text-xs rounded-lg pl-7 pr-3 py-1.5 placeholder-gray-600 focus:outline-none focus:border-emerald-500/70"
          />
        </div>
      </div>

      {error && <p className="text-xs text-amber-400 px-4 py-1.5">{error}</p>}

      {/* List */}
      <div className="overflow-y-auto max-h-56">
        {filtered.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-xs text-gray-600">
              {query ? 'No matching foods.' : emptyMsg.primary}
            </p>
            {!query && (
              <p className="text-xs text-gray-500 mt-0.5">{emptyMsg.secondary}</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {filtered.map(item => {
              const key = itemKey(item)
              const cal = item.caloriesPer100g != null
                ? Math.round((item.grams / 100) * item.caloriesPer100g)
                : null
              const label = SERVING_UNIT_LABELS[item.servingUnit as ServingUnit] ?? item.servingUnit
              const wasAdded = added.has(key)
              const isAdding = adding === key
              const isFav = favoriteIds.has(item.fdcId)
              const isTogglingFav = togglingFav === item.fdcId

              return (
                <div key={key} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800/40 transition-colors">
                  {/* Food info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200 truncate">{item.foodDescription}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-gray-500">
                        {fmt(item.servingAmount)} {label} · {fmt(item.grams, 0)}g
                      </span>
                      {cal != null && (
                        <span className="flex items-center gap-0.5 text-xs text-gray-500">
                          <Flame size={9} className="text-orange-400" />
                          {fmt(cal, 0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Use count (not shown in favorites mode) */}
                  {mode !== 'favorites' && item.useCount > 1 && (
                    <span className="text-xs text-gray-500 shrink-0">{item.useCount}×</span>
                  )}

                  {/* Star / favorite toggle */}
                  <button
                    onClick={() => handleToggleFavorite(item)}
                    disabled={isTogglingFav}
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isFav
                        ? 'text-amber-400 hover:text-amber-300'
                        : 'text-gray-600 hover:text-amber-400'
                    }`}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star size={13} fill={isFav ? 'currentColor' : 'none'} />
                  </button>

                  {/* Add to log */}
                  <button
                    onClick={() => handleAdd(item)}
                    disabled={!!adding}
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      wasAdded
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : isAdding
                          ? 'bg-gray-800 text-gray-600'
                          : 'bg-gray-800 hover:bg-emerald-600 text-gray-400 hover:text-white'
                    } disabled:cursor-not-allowed`}
                    title={wasAdded ? 'Added!' : 'Add to log'}
                    aria-label={wasAdded ? 'Added' : 'Add to log'}
                  >
                    {wasAdded ? <Check size={13} /> : <Plus size={13} />}
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
