'use client'

import { useState } from 'react'
import { BubbleSnapshot, BubbleIndicator } from '@/types/bubble'
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Shield } from 'lucide-react'

const ZONE_BANDS = [
  { min: 0,  max: 30,  fill: '#dcfce7', label: '安全',  labelColor: '#16a34a' },
  { min: 30, max: 45,  fill: '#fef9c3', label: '中度',  labelColor: '#ca8a04' },
  { min: 45, max: 60,  fill: '#ffedd5', label: '警戒',  labelColor: '#ea580c' },
  { min: 60, max: 75,  fill: '#fee2e2', label: '危險',  labelColor: '#dc2626' },
  { min: 75, max: 100, fill: '#fecaca', label: '極端',  labelColor: '#991b1b' },
]

function scoreColor(score: number) {
  if (score >= 75) return '#ef4444'
  if (score >= 60) return '#f97316'
  if (score >= 45) return '#f59e0b'
  if (score >= 30) return '#eab308'
  return '#22c55e'
}

function RiskTrendChart({ history }: { history: BubbleSnapshot[] }) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) return null

  const W = 360, H = 160
  const PAD = { left: 28, right: 14, top: 16, bottom: 26 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom

  const yOf = (score: number) => PAD.top + cH - (score / 100) * cH
  const xOf = (i: number) =>
    sorted.length === 1 ? PAD.left + cW / 2 : PAD.left + (i / (sorted.length - 1)) * cW

  const pts = sorted.map((s, i) => ({
    x: xOf(i),
    y: yOf(s.overallRisk),
    score: s.overallRisk,
    date: s.date.slice(5),
  }))

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // X-axis: show first, last, and up to 3 evenly-spaced labels
  const labelIdxs = new Set<number>()
  labelIdxs.add(0)
  labelIdxs.add(sorted.length - 1)
  if (sorted.length > 4) {
    const step = Math.floor(sorted.length / 3)
    for (let i = step; i < sorted.length - 1; i += step) labelIdxs.add(i)
  }

  const latest = pts[pts.length - 1]
  const lineColor = scoreColor(latest.score)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-700">風險分趨勢</span>
        </div>
        <span className="text-xs text-slate-400">近 {sorted.length} 個交易日</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
        {/* Zone bands */}
        {ZONE_BANDS.map((z) => (
          <rect
            key={z.min}
            x={PAD.left} y={yOf(z.max)}
            width={cW} height={yOf(z.min) - yOf(z.max)}
            fill={z.fill}
          />
        ))}

        {/* Grid lines + Y labels */}
        {[0, 30, 45, 60, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={yOf(v)} x2={PAD.left + cW} y2={yOf(v)}
              stroke="#cbd5e1" strokeWidth={v === 0 ? 1 : 0.5} strokeDasharray={v === 0 ? '' : '3,3'} />
            <text x={PAD.left - 4} y={yOf(v)} fill="#94a3b8" fontSize="8.5"
              textAnchor="end" dominantBaseline="middle">{v}</text>
          </g>
        ))}

        {/* Trend line */}
        {pts.length > 1 && (
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Dots */}
        {pts.map((p, i) => {
          const isLatest = i === pts.length - 1
          return (
            <g key={i}>
              {isLatest && <circle cx={p.x} cy={p.y} r={9} fill={scoreColor(p.score)} opacity={0.15} />}
              <circle cx={p.x} cy={p.y} r={isLatest ? 5 : 3}
                fill={scoreColor(p.score)} stroke="white" strokeWidth="1.5" />
              {isLatest && (
                <text x={p.x} y={p.y - 13} fill={scoreColor(p.score)} fontSize="11"
                  fontWeight="bold" textAnchor="middle" dominantBaseline="auto">
                  {p.score}
                </text>
              )}
            </g>
          )
        })}

        {/* X-axis labels */}
        {pts.map((p, i) =>
          labelIdxs.has(i) ? (
            <text key={i} x={p.x} y={PAD.top + cH + 14} fill="#94a3b8"
              fontSize="8.5" textAnchor="middle">{p.date}</text>
          ) : null
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
        {ZONE_BANDS.map((z) => (
          <div key={z.min} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: z.fill, border: '1px solid #e2e8f0' }} />
            <span className="text-[10px]" style={{ color: z.labelColor }}>{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const DEFCON_CONFIG: Record<number, { label: string; bg: string; text: string; border: string }> = {
  1: { label: 'DEFCON 1 — EXTREME', bg: 'bg-red-700', text: 'text-white', border: 'border-red-700' },
  2: { label: 'DEFCON 2 — CRITICAL', bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' },
  3: { label: 'DEFCON 3 — HIGH ALERT', bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500' },
  4: { label: 'DEFCON 4 — MODERATE', bg: 'bg-amber-400', text: 'text-slate-900', border: 'border-amber-400' },
  5: { label: 'DEFCON 5 — SAFE', bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' },
}

const LEVEL_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  EXTREME: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  MODERATE: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  LOW: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  SAFE: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
}

const PRIORITY_CONFIG: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  medium: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
  low: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-orange-500' : score >= 30 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="w-full bg-slate-200 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
    </div>
  )
}

function IndicatorCard({ item }: { item: BubbleIndicator }) {
  const [expanded, setExpanded] = useState(false)
  const lvl = LEVEL_CONFIG[item.level]

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${lvl.bg} ${lvl.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${lvl.dot}`} />
                {item.level}
              </span>
              <span className="text-xs text-slate-500">{item.name}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-slate-900">{item.value}</span>
              <span className="text-sm text-slate-500">均值 {item.historicalAvg}</span>
              <span className={`text-sm font-semibold ${item.riskScore >= 50 ? 'text-red-600' : 'text-green-600'}`}>
                {item.currentVsAvg}
              </span>
            </div>
            <div className="mt-2">
              <RiskBar score={item.riskScore} />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>安全</span>
                <span className="font-medium text-slate-600">{item.riskScore}/100</span>
                <span>極危</span>
              </div>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-3">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">{item.fullName}</div>
            <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-amber-700 mb-1">⚡ 影響</div>
            <p className="text-sm text-amber-800">{item.implication}</p>
          </div>
          <div className="text-xs text-slate-400">參考基準：{item.benchmark}</div>
        </div>
      )}
    </div>
  )
}

export default function BubbleMonitor({ data, history }: { data: BubbleSnapshot; history: BubbleSnapshot[] }) {
  const defcon = DEFCON_CONFIG[data.defconLevel]

  return (
    <div className="space-y-5">
      {/* DEFCON Banner */}
      <div className={`${defcon.bg} rounded-2xl p-5 shadow-sm`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className={`text-xs font-bold uppercase tracking-widest ${defcon.text} opacity-80 mb-1`}>
              股市泡沫監測系統
            </div>
            <div className={`text-2xl font-black ${defcon.text}`}>{defcon.label}</div>
            <div className={`text-sm ${defcon.text} opacity-90 mt-0.5`}>{data.date} 更新</div>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-black ${defcon.text}`}>{data.overallRisk}</div>
            <div className={`text-sm ${defcon.text} opacity-80`}>/ 100 風險分</div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-orange-500" />
          <span className="text-sm font-semibold text-slate-700">今日研判</span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
      </div>

      {/* Risk Trend Chart */}
      <RiskTrendChart history={history} />

      {/* Indicators Grid */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">六大監測指標</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.indicators.map((item) => (
            <IndicatorCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Historical Comparison */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-700">歷史泡沫對比</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left pb-2 font-medium">時期</th>
                <th className="text-right pb-2 font-medium">CAPE</th>
                <th className="text-right pb-2 font-medium">Buffett</th>
                <th className="text-right pb-2 font-medium">結果</th>
              </tr>
            </thead>
            <tbody>
              {data.historicalComparisons.map((row, i) => (
                <tr key={i} className={`border-b border-slate-50 ${row.period === '現在' ? 'font-semibold text-orange-600' : 'text-slate-700'}`}>
                  <td className="py-2">{row.period}</td>
                  <td className="text-right py-2">{row.cape}x</td>
                  <td className="text-right py-2">{row.buffett}%</td>
                  <td className={`text-right py-2 font-medium ${row.result.includes('-') ? 'text-red-600' : row.result === '?' ? 'text-orange-500' : 'text-green-600'}`}>
                    {row.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Recommendations */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-blue-500" />
          <span className="text-sm font-semibold text-slate-700">行動建議</span>
        </div>
        <div className="space-y-2">
          {data.actionRecommendations.map((rec, i) => {
            const cfg = PRIORITY_CONFIG[rec.level]
            return (
              <div key={i} className={`border rounded-xl p-4 ${cfg.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white border ${cfg.text}`}>
                    {rec.priority}
                  </span>
                  <span className={`text-sm font-semibold ${cfg.text}`}>{rec.action}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{rec.detail}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-center text-slate-400 text-xs pb-2">
        每日 07:00 自動更新 · 資料來源：FRED、Multpl、CNN Fear&Greed
      </div>
    </div>
  )
}
