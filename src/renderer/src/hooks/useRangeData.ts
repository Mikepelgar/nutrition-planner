import { useState, useEffect } from 'react'
import { todayIso, shiftDate } from '../lib/formatters'

type DailyLog = Awaited<ReturnType<typeof window.api.logGetDailyLogs>>[number]
type Weight = Awaited<ReturnType<typeof window.api.weightGetRange>>[number]
type Water = Awaited<ReturnType<typeof window.api.waterGetRange>>[number]

/** Loads a trailing date-window of daily logs, weigh-ins, and water totals. */
export function useRangeData(days: number) {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [weights, setWeights] = useState<Weight[]>([])
  const [waters, setWaters] = useState<Water[]>([])
  const [loading, setLoading] = useState(true)
  const end = todayIso()
  const start = shiftDate(end, -(days - 1))

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      window.api.logGetDailyLogs({ startDate: start, endDate: end }),
      window.api.weightGetRange({ startDate: start, endDate: end }),
      window.api.waterGetRange({ startDate: start, endDate: end })
    ])
      .then(([l, w, wa]) => {
        if (!active) return
        setLogs(l)
        setWeights(w)
        setWaters(wa)
      })
      .catch(() => { /* charts fall back to their empty states */ })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  return { logs, weights, waters, loading, start, end }
}
