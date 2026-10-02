import { useEffect, useState } from 'react'
import { Check, X, Utensils, Dumbbell, Scale, Plus } from 'lucide-react'
import type { FoodSearchResult, MealType } from '../../lib/types'
import type { LogProposal, ProposedExercise, ProposedFood, ProposedWeight } from '../../../../shared/logProposal'
import { useChatStore } from '../../store/useChatStore'
import { usePlanStore } from '../../store/usePlanStore'
import { todayIso } from '../../lib/formatters'
import { Spinner } from '../ui/Spinner'

/**
 * Confirm card for entries the AI offered to log. The model only proposes by
 * name; foods are matched here against the local database, and nothing is
 * written until the user taps Add on a row. Always targets today.
 */

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const LB_PER_KG = 2.20462

const inputCls =
  'bg-gray-900 border border-gray-700 text-gray-100 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-emerald-500'

type RowState = 'added' | 'dismissed' | undefined

interface RowProps {
  state: RowState
  onSettle: (state: 'added' | 'dismissed') => void
}

/** If today's log is on screen, reload it so the new entry appears. */
async function refreshTodayIfLoaded(what: 'entries' | 'exercise'): Promise<void> {
  const store = usePlanStore.getState()
  if (store.date !== todayIso()) return
  if (what === 'entries') await store.loadDay(store.date)
  else await store.refreshBurned()
}

function RowShell({
  icon,
  state,
  busy,
  error,
  canAdd,
  onAdd,
  onDismiss,
  children
}: {
  icon: React.ReactNode
  state: RowState
  busy: boolean
  error: string | null
  canAdd: boolean
  onAdd: () => void
  onDismiss: () => void
  children: React.ReactNode
}) {
  const settled = state !== undefined
  return (
    <div className={`flex items-start gap-2 py-2 border-t border-gray-700/60 first:border-0 ${state === 'dismissed' ? 'opacity-40' : ''}`}>
      <div className="mt-1 text-gray-500 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {children}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-1 mt-0.5">
        {state === 'added' ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check size={12} /> Added</span>
        ) : state === 'dismissed' ? (
          <span className="text-xs text-gray-500">Skipped</span>
        ) : (
          <>
            <button
              onClick={onAdd}
              disabled={busy || !canAdd || settled}
              className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md px-2 py-1"
            >
              {busy ? <Spinner size={11} /> : <Plus size={11} />} Add
            </button>
            <button
              onClick={onDismiss}
              disabled={busy}
              aria-label="Skip"
              className="p-1 text-gray-500 hover:text-gray-300 rounded-md"
            >
              <X size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function FoodRow({ item, state, onSettle }: RowProps & { item: ProposedFood }) {
  const [results, setResults] = useState<FoodSearchResult[] | null>(null)
  const [fdcId, setFdcId] = useState<number | null>(null)
  const [grams, setGrams] = useState(String(item.grams))
  const [meal, setMeal] = useState<MealType>(item.meal)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state) return // already settled; no need to search again
    window.api
      .foodSearch({ query: item.name, limit: 6 })
      .then(r => {
        setResults(r)
        setFdcId(r[0]?.fdcId ?? null)
      })
      .catch(() => setResults([]))
  }, [item.name, state])

  const selected = results?.find(r => r.fdcId === fdcId) ?? null
  const g = parseFloat(grams)
  const kcal = selected?.caloriesPer100g != null && g > 0 ? Math.round((selected.caloriesPer100g * g) / 100) : null

  async function add(): Promise<void> {
    if (fdcId == null || !(g > 0)) return
    setBusy(true)
    setError(null)
    try {
      const plan = await window.api.planGetOrCreate({ date: todayIso() })
      await window.api.planAddEntry({ planId: plan.id, fdcId, servingUnit: 'g', servingAmount: g, grams: g, meal })
      onSettle('added')
      await refreshTodayIfLoaded('entries')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <RowShell
      icon={<Utensils size={13} />}
      state={state}
      busy={busy}
      error={error}
      canAdd={fdcId != null && g > 0}
      onAdd={add}
      onDismiss={() => onSettle('dismissed')}
    >
      <p className="text-xs text-gray-400">
        <span className="text-gray-200">{item.name}</span>
        {kcal != null && <span className="ml-1.5 text-gray-500">· {kcal} kcal</span>}
      </p>
      {!state && (
        results === null ? (
          <Spinner size={12} />
        ) : results.length === 0 ? (
          <p className="text-xs text-amber-400">No match in the food database — add it from the Add tab.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={fdcId ?? ''}
              onChange={e => setFdcId(Number(e.target.value))}
              className={`${inputCls} max-w-[260px]`}
              title={selected?.description}
            >
              {results.map(r => (
                <option key={r.fdcId} value={r.fdcId}>
                  {r.description.length > 60 ? `${r.description.slice(0, 57)}…` : r.description}
                  {r.brandOwner ? ` (${r.brandOwner})` : ''}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={grams}
              onChange={e => setGrams(e.target.value)}
              className={`${inputCls} w-16`}
              aria-label="Grams"
            />
            <span className="text-xs text-gray-500">g</span>
            <select value={meal} onChange={e => setMeal(e.target.value as MealType)} className={inputCls} aria-label="Meal">
              {MEALS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )
      )}
    </RowShell>
  )
}

function ExerciseRow({ item, state, onSettle }: RowProps & { item: ProposedExercise }) {
  const [name, setName] = useState(item.activity)
  const [minutes, setMinutes] = useState(String(item.durationMin))
  const [kcal, setKcal] = useState(String(item.caloriesBurned))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cal = parseFloat(kcal)

  async function add(): Promise<void> {
    if (!name.trim() || !(cal > 0)) return
    setBusy(true)
    setError(null)
    try {
      const mins = parseFloat(minutes)
      await window.api.exerciseAdd({
        date: todayIso(),
        name: name.trim(),
        caloriesBurned: cal,
        durationMin: mins > 0 ? mins : undefined
      })
      onSettle('added')
      await refreshTodayIfLoaded('exercise')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <RowShell
      icon={<Dumbbell size={13} />}
      state={state}
      busy={busy}
      error={error}
      canAdd={!!name.trim() && cal > 0}
      onAdd={add}
      onDismiss={() => onSettle('dismissed')}
    >
      {state ? (
        <p className="text-xs text-gray-200">{name} · {minutes} min · {kcal} kcal</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <input value={name} onChange={e => setName(e.target.value)} className={`${inputCls} w-36`} aria-label="Activity" />
          <input type="number" min={1} value={minutes} onChange={e => setMinutes(e.target.value)} className={`${inputCls} w-14`} aria-label="Minutes" />
          <span className="text-xs text-gray-500">min</span>
          <input type="number" min={1} value={kcal} onChange={e => setKcal(e.target.value)} className={`${inputCls} w-16`} aria-label="Calories burned" />
          <span className="text-xs text-gray-500">kcal burned</span>
        </div>
      )}
      <p className="text-[11px] text-gray-500">Raises today&apos;s calorie and carb/fat targets by the calories burned.</p>
    </RowShell>
  )
}

function WeightRow({ item, state, onSettle }: RowProps & { item: ProposedWeight }) {
  const [value, setValue] = useState(String(item.value))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const v = parseFloat(value)

  async function add(): Promise<void> {
    if (!(v > 0)) return
    setBusy(true)
    setError(null)
    try {
      const weightKg = item.unit === 'lb' ? v / LB_PER_KG : v
      await window.api.weightSet({ date: todayIso(), weightKg: Math.round(weightKg * 10) / 10 })
      onSettle('added')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <RowShell
      icon={<Scale size={13} />}
      state={state}
      busy={busy}
      error={error}
      canAdd={v > 0}
      onAdd={add}
      onDismiss={() => onSettle('dismissed')}
    >
      {state ? (
        <p className="text-xs text-gray-200">Weight {value} {item.unit}</p>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Weight</span>
          <input type="number" min={1} step={0.1} value={value} onChange={e => setValue(e.target.value)} className={`${inputCls} w-20`} aria-label="Weight" />
          <span className="text-xs text-gray-500">{item.unit}</span>
        </div>
      )}
    </RowShell>
  )
}

export function LogProposalCard({
  messageId,
  proposal,
  settledRows
}: {
  messageId: string
  proposal: LogProposal
  settledRows?: Record<string, 'added' | 'dismissed'>
}) {
  const settleRow = useChatStore(s => s.settleRow)
  const rowProps = (key: string): RowProps => ({
    state: settledRows?.[key],
    onSettle: st => settleRow(messageId, key, st)
  })

  return (
    <div className="mt-2 max-w-[85%] rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-1.5">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 pt-1">Add to today&apos;s log?</p>
      {proposal.foods.map((f, i) => <FoodRow key={`f${i}`} item={f} {...rowProps(`f${i}`)} />)}
      {proposal.exercises.map((e, i) => <ExerciseRow key={`e${i}`} item={e} {...rowProps(`e${i}`)} />)}
      {proposal.weight && <WeightRow item={proposal.weight} {...rowProps('w')} />}
    </div>
  )
}
