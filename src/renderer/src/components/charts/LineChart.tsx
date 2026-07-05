interface LinePoint {
  label: string
  value: number | null
}

interface Props {
  data: LinePoint[]
  height?: number
  color?: string
  /** Optional horizontal reference line (e.g. a target). */
  target?: number
  unit?: string
  /** Force the y-axis to start at 0 (good for counts; off for weight). */
  zeroBased?: boolean
}

const W = 320

export function LineChart({ data, height = 120, color = '#34d399', target, unit = '', zeroBased = false }: Props) {
  const H = height
  const padX = 6
  const padY = 10
  const pts = data.map((d, i) => ({ ...d, i }))
  const values = pts.map((p) => p.value).filter((v): v is number => v != null)
  const candidates = target != null ? [...values, target] : values
  if (values.length === 0) {
    return <div className="text-xs text-gray-600 py-8 text-center">No data in this range yet.</div>
  }
  let min = Math.min(...candidates)
  let max = Math.max(...candidates)
  if (zeroBased) min = Math.min(0, min)
  if (max === min) max = min + 1
  const range = max - min

  const x = (i: number): number => padX + (pts.length <= 1 ? 0 : (i / (pts.length - 1)) * (W - 2 * padX))
  const y = (v: number): number => padY + (1 - (v - min) / range) * (H - 2 * padY)

  // Build path segments, breaking on null gaps.
  const segments: string[] = []
  let cur: string[] = []
  for (const p of pts) {
    if (p.value == null) {
      if (cur.length) { segments.push(cur.join(' ')); cur = [] }
    } else {
      cur.push(`${cur.length === 0 ? 'M' : 'L'} ${x(p.i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    }
  }
  if (cur.length) segments.push(cur.join(' '))

  const last = pts.filter((p) => p.value != null).at(-1)
  const first = pts.find((p) => p.value != null)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {target != null && (
          <line x1={padX} x2={W - padX} y1={y(target)} y2={y(target)} stroke="#6b7280" strokeDasharray="4 4" strokeWidth="1" opacity="0.6" />
        )}
        {segments.map((d, idx) => (
          <path key={idx} d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
        {last && last.value != null && <circle cx={x(last.i)} cy={y(last.value)} r="3" fill={color} />}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-1">
        <span>{first?.label}</span>
        {last && last.value != null && (
          <span className="text-gray-400">
            {Math.round(last.value).toLocaleString()}{unit}
          </span>
        )}
        <span>{last?.label}</span>
      </div>
    </div>
  )
}
