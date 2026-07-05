import { useState, useRef, useEffect } from 'react'
import { Search, X, Barcode } from 'lucide-react'
import type { FoodDetail, FoodSearchResult, ServingUnit } from '../../lib/types'
import { useFoodSearch } from '../../hooks/useFoodSearch'
import { usePlanStore } from '../../store/usePlanStore'
import { useFavoritesStore } from '../../store/useFavoritesStore'
import { ServingPicker } from './ServingPicker'
import { FoodResultItem } from './FoodResultItem'
import { Spinner } from '../ui/Spinner'

export function FoodSearch() {
  const { query, setQuery, results, loading } = useFoodSearch()
  const [selectedFood, setSelectedFood] = useState<FoodDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [barcodeMode, setBarcodeMode] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeError, setBarcodeError] = useState('')
  const { addEntry } = usePlanStore()
  const { ids: favoriteIds, load: loadFavorites, toggle: toggleFavorite } = useFavoritesStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadFavorites() }, [loadFavorites])

  async function handleBarcode() {
    const upc = barcodeInput.trim()
    if (!upc) return
    const detail = await window.api.foodByBarcode({ upc })
    if (detail) {
      setSelectedFood(detail)
      setBarcodeMode(false)
      setBarcodeInput('')
      setBarcodeError('')
    } else {
      setBarcodeError('No food found for this barcode. Try searching by name instead.')
    }
  }

  // Starred from search there's no serving context yet — store a neutral
  // 100 g default; the Faves tab opens a ServingPicker before logging anyway.
  function handleToggleFavorite(food: FoodSearchResult) {
    toggleFavorite({
      fdcId: food.fdcId,
      foodDescription: food.description,
      servingUnit: 'g',
      servingAmount: 100,
      grams: 100
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setQuery('')
        setSelectedFood(null)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setQuery])

  async function selectFood(fdcId: number) {
    setLoadingDetail(true)
    try {
      const detail = await window.api.foodDetail({ fdcId })
      setSelectedFood(detail)
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleAdd(servingUnit: ServingUnit, servingAmount: number) {
    if (!selectedFood) return
    await addEntry(selectedFood, servingUnit, servingAmount)
    setSelectedFood(null)
    setQuery('')
  }

  const wholeFoods = results.filter(r => r.dataType !== 'branded_food')
  const brandedFoods = results.filter(r => r.dataType === 'branded_food')
  const hasResults = results.length > 0
  const showDropdown = !selectedFood && query.length >= 2 && !loading

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedFood(null) }}
          placeholder="Search foods… (Ctrl+F)"
          className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-xl pl-9 pr-9 py-2.5 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
        />
        {(query || loading) && (
          <button
            onClick={() => { setQuery(''); setSelectedFood(null) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            {loading ? <Spinner size={14} /> : <X size={14} />}
          </button>
        )}
      </div>

      {/* Barcode lookup */}
      <div className="mt-2">
        {!barcodeMode ? (
          <button
            onClick={() => { setBarcodeMode(true); setBarcodeError('') }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-400 transition-colors"
          >
            <Barcode size={13} /> Enter a barcode
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <input
              autoFocus type="text" inputMode="numeric" value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleBarcode(); if (e.key === 'Escape') setBarcodeMode(false) }}
              placeholder="UPC / barcode number"
              className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
            />
            <button onClick={handleBarcode} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg transition-colors">Look up</button>
            <button onClick={() => { setBarcodeMode(false); setBarcodeInput(''); setBarcodeError('') }} className="text-xs text-gray-500 hover:text-gray-300">✕</button>
          </div>
        )}
        {barcodeError && <p className="text-xs text-amber-400 mt-1">{barcodeError}</p>}
      </div>

      {/* Serving picker */}
      {selectedFood && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <ServingPicker
            food={selectedFood}
            onAdd={handleAdd}
            onCancel={() => setSelectedFood(null)}
          />
        </div>
      )}

      {/* Results dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
          {!hasResults ? (
            <p className="text-sm text-gray-500 px-4 py-3">No foods found for "{query}"</p>
          ) : (
            <>
              {/* Whole Foods section */}
              {wholeFoods.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 bg-gray-800 border-b border-gray-700/60 sticky top-0 z-10">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                      Whole Foods
                    </span>
                  </div>
                  {wholeFoods.map(food => (
                    <FoodResultItem
                      key={food.fdcId}
                      food={food}
                      onClick={selectFood}
                      disabled={loadingDetail}
                      isFavorite={favoriteIds.has(food.fdcId)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              )}

              {/* Branded Products section */}
              {brandedFoods.length > 0 && (
                <div>
                  <div className={`px-4 py-1.5 bg-gray-800 border-b border-gray-700/60 sticky top-0 z-10${wholeFoods.length > 0 ? ' border-t border-gray-700' : ''}`}>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                      Branded Products
                    </span>
                  </div>
                  {brandedFoods.map(food => (
                    <FoodResultItem
                      key={food.fdcId}
                      food={food}
                      onClick={selectFood}
                      disabled={loadingDetail}
                      isFavorite={favoriteIds.has(food.fdcId)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
