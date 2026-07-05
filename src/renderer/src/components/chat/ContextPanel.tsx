import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Eye } from 'lucide-react'
import type { CoachContext } from '../../../../shared/aiContext'

interface Props {
  date: string
  mode: string
  style: string
  budgetMode: boolean
  easyPrepMode: boolean
}

/**
 * "What the AI can see" — fetches the exact CoachContext the main process
 * builds for a real chat call (same gather path), so the personalization is
 * visible and verifiable instead of a black box.
 */
export function ContextPanel({ date, mode, style, budgetMode, easyPrepMode }: Props) {
  const [open, setOpen] = useState(false)
  const [ctx, setCtx] = useState<CoachContext | null>(null)

  useEffect(() => {
    if (!open) return
    window.api
      .aiGetContext({ date, mode, style, budgetMode, easyPrepMode })
      .then(setCtx)
      .catch(() => setCtx(null))
  }, [open, date, mode, style, budgetMode, easyPrepMode])

  const rows: Array<[string, string]> = []
  if (ctx) {
    rows.push([
      'Profile',
      ctx.profile.age != null
        ? `${ctx.profile.age}y ${ctx.profile.sex ?? ''} · ${ctx.profile.heightCm} cm · ${ctx.profile.weightKg} kg · ${ctx.profile.activityLevel ?? ''}`
        : 'not set — targets unknown'
    ])
    rows.push([
      'Goal',
      ctx.goal.tdee != null
        ? `${ctx.goal.mode} · TDEE ${ctx.goal.tdee} kcal · target ${ctx.goal.calorieTarget} kcal (${(ctx.goal.surplusOrDeficit ?? 0) >= 0 ? '+' : ''}${ctx.goal.surplusOrDeficit} kcal)`
        : `${ctx.goal.mode} · targets unknown (no profile)`
    ])
    if (ctx.diet.type)
      rows.push(['Diet', `${ctx.diet.type} · P ${ctx.diet.proteinG}g / C ${ctx.diet.carbsG}g / F ${ctx.diet.fatG}g`])
    rows.push([
      'Today',
      `${ctx.today.kcalConsumed} kcal eaten · ${ctx.today.kcalBurnedExercise} kcal burned · ` +
        (ctx.today.kcalRemaining != null ? `${ctx.today.kcalRemaining} kcal remaining` : 'remaining unknown') +
        ` · ${ctx.today.loggedItems.length} item${ctx.today.loggedItems.length === 1 ? '' : 's'} logged`
    ])
    rows.push([
      'Top gaps',
      ctx.gaps.length ? ctx.gaps.slice(0, 3).map(g => `${g.nutrient} ${g.pctOfTarget}%`).join(', ') : 'none flagged'
    ])
    if (ctx.overLimits.length)
      rows.push(['Over limits', ctx.overLimits.map(o => `${o.nutrient} ${o.pctOfLimit}%`).join(', ')])
    const restr = [...ctx.restrictions.allergens, ...ctx.restrictions.avoidFoods]
    rows.push(['Restrictions', restr.length ? restr.join(', ') : 'none'])
    const prefs = [ctx.budgetMode && 'budget', ctx.easyPrepMode && 'easy-prep'].filter(Boolean)
    rows.push(['Preferences', prefs.length ? prefs.join(' + ') : 'none'])
  }

  return (
    <div className="border-b border-gray-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Eye size={12} />
        What the AI can see
      </button>
      {open && (
        <div className="px-4 pb-2.5">
          {ctx ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-gray-600">{label}</dt>
                  <dd className="text-gray-400">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-gray-600">Loading…</p>
          )}
          <p className="text-[10px] text-gray-700 mt-1.5">
            This exact snapshot (plus your recent messages) is sent with your next question. Nothing else leaves your
            machine.
          </p>
        </div>
      )}
    </div>
  )
}
