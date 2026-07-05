import { AlertTriangle } from 'lucide-react'
import type { NutrientProgressData } from '../../lib/types'
import { fmt } from '../../lib/formatters'

interface Props {
  data: NutrientProgressData
}

export function NutrientBar({ data }: Props) {
  const { name, unit, intake, rdi, ul, state, primaryBarPercent, displayPercent } = data

  const barColor =
    state === 'excess' ? 'bg-red-500' :
    state === 'over-rdi' ? 'bg-amber-400' :
    'bg-emerald-500'

  const percentColor =
    state === 'excess' ? 'text-red-400' :
    state === 'over-rdi' ? 'text-amber-400' :
    displayPercent >= 80 ? 'text-emerald-400' :
    'text-gray-500'

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {state === 'excess' && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
          <span className="text-xs text-gray-400 truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold tabular-nums ${percentColor}`}>{displayPercent}%</span>
          <span className="text-xs text-gray-600 tabular-nums">
            {fmt(intake, 1)}<span className="text-gray-700">/{fmt(rdi, 0)}{unit}</span>
          </span>
        </div>
      </div>

      {/* Progress bar track */}
      <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
        {/* RDI marker (at 100% of track) — subtle dashed line */}
        <div className="absolute inset-y-0 left-0 right-0 flex">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${primaryBarPercent}%` }}
          />
        </div>
        {/* Overflow indicator: fills beyond RDI when over-rdi */}
        {state === 'over-rdi' && (
          <div className="absolute inset-y-0 right-0 w-1/4 flex items-center">
            <div
              className="h-full rounded-full bg-amber-400/50 transition-all duration-300"
              style={{ width: `${Math.min(((intake - rdi) / (rdi * 0.5)) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {state === 'excess' && ul !== null && (
        <p className="text-xs text-red-400/70 mt-0.5">
          Exceeds upper limit of {fmt(ul, 0)}{unit}
        </p>
      )}
    </div>
  )
}
