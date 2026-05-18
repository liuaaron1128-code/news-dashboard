'use client'

import { useState } from 'react'
import { BubbleSnapshot, BubbleIndicator } from '@/types/bubble'
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Shield } from 'lucide-react'

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

export default function BubbleMonitor({ data }: { data: BubbleSnapshot }) {
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
