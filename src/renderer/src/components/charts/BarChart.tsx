interface BarPoint {
  label: string
  value: number
  /** Override bar color (e.g. amber when over target). */
  color?: string
}

interface Props {
  data: BarPoint[]
  height?: number
  color?: string
  target?: number
}

const W = 320

export function BarChart({ data, height = 120, color = '#34d399', target }: Props) {
  const H = height
  const padY = 10
  if (data.length === 0) {
    return <div className="text-xs text-gray-600 py-8 text-center">No data in this range yet.</div>
  }
  const max = Math.max(target ?? 0, ...data.map((d) => d.value), 1)
  const slot = W / data.length
  const barW = Math.max(1, Math.min(slot * 0.7, 14))
  const y = (v: number): number => padY + (1 - v / max) * (H - 2 * padY)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {target != null && (
          <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="#6b7280" strokeDasharray="4 4" strokeWidth="1" opacity="0.6" />
        )}
        {data.map((d, i) => {
          const cx = i * slot + slot / 2
          const top = y(d.value)
          return (
            <rect
              key={i}
              x={cx - barW / 2}
              y={top}
              width={barW}
              height={Math.max(0, H - padY - top)}
              rx="1.5"
              fill={d.color ?? color}
              opacity="0.9"
            />
          )
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-1">
        <span>{data[0]?.label}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
    </div>
  )
}
