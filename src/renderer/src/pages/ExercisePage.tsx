import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Flame, Trash2, Dumbbell } from 'lucide-react'
import { useProfileStore } from '../store/useProfileStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { fmt, fmtDate, shiftDate, todayIso } from '../lib/formatters'
import type { Exercise } from '../lib/types'

// Approximate MET values for common activities. kcal = MET × kg × hours.
const ACTIVITIES: Array<{ name: string; met: number }> = [
  { name: 'Walking (brisk)', met: 4.3 },
  { name: 'Running', met: 9.8 },
  { name: 'Cycling', met: 7.5 },
  { name: 'Weight training', met: 5.0 },
  { name: 'Swimming', met: 7.0 },
  { name: 'HIIT', met: 8.0 },
  { name: 'Elliptical', met: 5.0 },
  { name: 'Hiking', met: 6.0 },
  { name: 'Rowing', met: 7.0 },
  { name: 'Yoga', met: 2.5 }
]
const ACTIVITY_OPTIONS = [...ACTIVITIES.map((a) => ({ value: a.name, label: a.name })), { value: '__custom', label: 'Custom…' }]

export function ExercisePage() {
  const { profile } = useProfileStore()
  const weightKg = profile?.weightKg ?? 70
  const [date, setDate] = useState(todayIso())
  const [items, setItems] = useState<Exercise[]>([])
  const [activity, setActivity] = useState(ACTIVITIES[0].name)
  const [customName, setCustomName] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [calories, setCalories] = useState('')

  function reload(d: string) {
    window.api.exerciseGetForDate({ date: d }).then(setItems)
  }
  useEffect(() => { reload(date) }, [date])

  // Auto-estimate calories from MET × weight × duration whenever the activity or
  // duration changes (still editable before adding).
  useEffect(() => {
    if (activity === '__custom') return
    const met = ACTIVITIES.find((a) => a.name === activity)?.met ?? 5
    const mins = parseFloat(minutes) || 0
    setCalories(String(Math.round(met * weightKg * (mins / 60))))
  }, [activity, minutes, weightKg])

  const isToday = date === todayIso()
  const totalBurned = items.reduce((s, e) => s + e.caloriesBurned, 0)

  async function handleAdd() {
    const name = activity === '__custom' ? customName.trim() : activity
    const cal = parseFloat(calories) || 0
    if (!name || cal <= 0) return
    await window.api.exerciseAdd({
      date,
      name,
      caloriesBurned: cal,
      durationMin: minutes ? parseFloat(minutes) : undefined
    })
    setCustomName('')
    reload(date)
  }

  async function handleDelete(id: number) {
    await window.api.exerciseDelete({ id })
    reload(date)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Date nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => setDate(shiftDate(date, -1))} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200" aria-label="Previous day">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <h1 className="text-sm font-semibold text-gray-200">{fmtDate(date)}</h1>
            {!isToday && (
              <button onClick={() => setDate(todayIso())} className="text-xs text-emerald-500 hover:text-emerald-400">Back to today</button>
            )}
          </div>
          <button onClick={() => setDate(shiftDate(date, 1))} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200" aria-label="Next day">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Summary */}
        <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-3">
          <Flame size={20} className="text-orange-400" />
          <div>
            <div className="text-2xl font-bold text-gray-100">{fmt(totalBurned, 0)} <span className="text-sm font-normal text-gray-500">kcal burned</span></div>
            <div className="text-xs text-gray-500">Added to your calorie budget for the day.</div>
          </div>
        </div>

        {/* Add form */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-gray-400 flex items-center gap-1.5"><Dumbbell size={14} /> Log exercise</h2>
          <Select label="Activity" value={activity} onChange={(e) => setActivity(e.target.value)} options={ACTIVITY_OPTIONS} />
          {activity === '__custom' && (
            <Input label="Name" value={customName} placeholder="e.g. Basketball" onChange={(e) => setCustomName(e.target.value)} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Duration (min)" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <Input label="Calories burned" type="number" min={0} value={calories} onChange={(e) => setCalories(e.target.value)} />
          </div>
          <Button onClick={handleAdd} className="w-full">Add</Button>
        </div>

        {/* List */}
        <div className="bg-gray-900 rounded-xl p-2">
          {items.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No exercise logged for this day.</p>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {items.map((e) => (
                <div key={e.id} className="flex items-center gap-2 px-2 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{e.name}</p>
                    <p className="text-xs text-gray-500">
                      {e.durationMin ? `${fmt(e.durationMin, 0)} min · ` : ''}{fmt(e.caloriesBurned, 0)} kcal
                    </p>
                  </div>
                  <button onClick={() => handleDelete(e.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400" aria-label={`Delete ${e.name}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
