import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { NutrientProgressData } from '../../lib/types'
import { NUTRIENT_GROUPS } from '../../lib/nutrientProgress'
import { NutrientBar } from './NutrientBar'

interface Props {
  nutrients: NutrientProgressData[]
}

export function NutrientPanel({ nutrients }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ Macros: true, Vitamins: true, Minerals: false, Electrolytes: true })
  const byId = new Map(nutrients.map(n => [n.nutrientId, n]))

  return (
    <div className="space-y-3">
      {NUTRIENT_GROUPS.map(group => {
        const groupNutrients = group.nutrientIds
          .map(id => byId.get(id))
          .filter((n): n is NutrientProgressData => n !== undefined && n.rdi > 0)

        if (groupNutrients.length === 0) return null

        const isOpen = open[group.label] ?? true
        const excessCount = groupNutrients.filter(n => n.state === 'excess').length
        const lowCount = groupNutrients.filter(n => n.displayPercent < 80).length

        return (
          <div key={group.label} className="bg-gray-900 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(s => ({ ...s, [group.label]: !s[group.label] }))}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                <span className="text-sm font-medium text-gray-300">{group.label}</span>
              </div>
              <div className="flex gap-1.5">
                {excessCount > 0 && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">{excessCount} over limit</span>
                )}
                {lowCount > 0 && (
                  <span className="text-xs bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-full">{lowCount} low</span>
                )}
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 space-y-2.5">
                {groupNutrients.map(n => <NutrientBar key={n.nutrientId} data={n} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
