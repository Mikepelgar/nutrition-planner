import type { FoodSearchResult } from '../../lib/types'

interface Props {
  food: FoodSearchResult
  onClick: (fdcId: number) => void
  disabled?: boolean
}

export function FoodResultItem({ food, onClick, disabled }: Props) {
  const isUsda = food.dataType !== 'branded_food'

  return (
    <button
      onClick={() => onClick(food.fdcId)}
      disabled={disabled}
      className="w-full text-left px-4 py-2.5 hover:bg-gray-700/50 border-b border-gray-700/40 last:border-0 transition-colors disabled:opacity-50"
    >
      <div className="flex items-start gap-3">
        <p className="text-sm text-gray-100 leading-snug flex-1 min-w-0 line-clamp-2">
          {food.description}
        </p>
      </div>
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
  )
}
