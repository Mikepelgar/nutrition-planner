import { Star } from 'lucide-react'
import type { FoodSearchResult } from '../../lib/types'

interface Props {
  food: FoodSearchResult
  onClick: (fdcId: number) => void
  disabled?: boolean
  isFavorite: boolean
  onToggleFavorite: (food: FoodSearchResult) => void
}

export function FoodResultItem({ food, onClick, disabled, isFavorite, onToggleFavorite }: Props) {
  const isUsda = food.dataType !== 'branded_food'

  return (
    <div
      className={`flex items-start gap-1 px-4 py-2.5 hover:bg-gray-700/50 border-b border-gray-700/40 last:border-0 transition-colors ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <button
        onClick={() => onClick(food.fdcId)}
        disabled={disabled}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-sm text-gray-100 leading-snug line-clamp-2">{food.description}</p>
        <div className="mt-1 flex items-center gap-1.5">
          {isUsda ? (
            <span className="inline-flex items-center text-[10px] font-semibold tracking-wide bg-emerald-950 text-emerald-500 border border-emerald-900 px-1.5 py-0.5 rounded">
              USDA
            </span>
          ) : food.brandOwner ? (
            <span className="text-xs text-gray-500 truncate">{food.brandOwner}</span>
          ) : null}
        </div>
      </button>
      <button
        onClick={e => {
          e.stopPropagation()
          onToggleFavorite(food)
        }}
        className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
          isFavorite ? 'text-amber-400 hover:text-amber-300' : 'text-gray-600 hover:text-amber-400'
        }`}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star size={13} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
