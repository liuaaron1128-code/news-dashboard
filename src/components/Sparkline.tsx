'use client'

// Tiny dependency-free inline-SVG line chart for a numeric series.
export default function Sparkline({
  values,
  width = 120,
  height = 32,
  color = '#475569',
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  const pts = values.filter((v) => v != null && !Number.isNaN(v))
  if (pts.length < 2) {
    return <div className="text-[10px] text-slate-300">資料不足</div>
  }
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const pad = 2
  const stepX = (width - pad * 2) / (pts.length - 1)
  const coords = pts.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (height - pad * 2) * (1 - (v - min) / span)
    return [x, y] as const
  })
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lastX, lastY] = coords[coords.length - 1]
  const up = pts[pts.length - 1] >= pts[0]

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={up ? '#16a34a' : '#ef4444'} />
    </svg>
  )
}
