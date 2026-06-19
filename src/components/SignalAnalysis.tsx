'use client'

import { Gauge, TrendingUp, TrendingDown, Minus, Radar } from 'lucide-react'
import historyData from '@/data/signals_history.json'
import sentimentData from '@/data/sentiment.json'
import flowsData from '@/data/taiwan_flows.json'
import bubbleData from '@/data/bubble.json'
import { SignalHistoryPoint } from '@/types/history'
import { Sentiment, TaiwanFlows } from '@/types/extras'
import { BubbleSnapshot } from '@/types/bubble'
import { series, anomaly, detectDivergences, SeriesKey } from '@/lib/analysis'
import Sparkline from './Sparkline'

const history = historyData as SignalHistoryPoint[]
const sentiment = sentimentData as Sentiment
const flows = flowsData as TaiwanFlows
const bubble = (bubbleData as BubbleSnapshot[])[0]

const TRENDS: { key: SeriesKey; label: string; unit: string; digits: number }[] = [
  { key: 'us10y', label: '美國 10Y 殖利率', unit: '%', digits: 2 },
  { key: 'curve10y2y', label: '殖利率曲線 10Y−2Y', unit: '%', digits: 2 },
  { key: 'vix', label: 'VIX 波動率', unit: '', digits: 1 },
  { key: 'spx', label: 'S&P 500', unit: '', digits: 0 },
  { key: 'gold', label: '黃金', unit: '', digits: 0 },
  { key: 'btc', label: '比特幣', unit: '', digits: 0 },
]

const ANOMALY_STYLE = {
  high: 'bg-red-100 text-red-700',
  low: 'bg-blue-100 text-blue-700',
  normal: 'bg-slate-100 text-slate-500',
}

const DIV_STYLE = {
  high: { bg: '#FEF2F2', border: '#FECACA', dot: '#dc2626' },
  medium: { bg: '#FFFBEB', border: '#FDE68A', dot: '#d97706' },
  low: { bg: '#EFF6FF', border: '#BFDBFE', dot: '#2563eb' },
}

function sentimentColor(score: number | null): string {
  if (score == null) return '#94a3b8'
  if (score >= 75) return '#dc2626'
  if (score >= 55) return '#f59e0b'
  if (score >= 45) return '#64748b'
  if (score >= 25) return '#3b82f6'
  return '#2563eb'
}

export default function SignalAnalysis() {
  const latestPoint = history.length ? history[history.length - 1] : null
  const bubbleRisk = bubble?.bubbleRiskScore ?? bubble?.overallRisk
  const divergences = detectDivergences({
    latestPoint,
    bubbleRisk,
    sentimentScore: sentiment.score,
  })

  const hasTrendData = history.some((p) => TRENDS.some((t) => p[t.key] != null))

  return (
    <div className="mb-5 space-y-4">
      {/* Auto-detected divergences */}
      {divergences.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Radar size={14} className="text-slate-500" />
            <span className="text-sm font-bold text-slate-800">自動偵測訊號</span>
          </div>
          <div className="space-y-2">
            {divergences.map((d) => {
              const s = DIV_STYLE[d.level]
              return (
                <div key={d.id} className="rounded-xl p-3 border flex items-start gap-2" style={{ background: s.bg, borderColor: s.border }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                  <span className="text-[12.5px] text-slate-700 leading-relaxed">{d.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sentiment + Taiwan flows */}
      <div className="grid grid-cols-1 gap-3">
        {/* Fear & Greed */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Gauge size={14} className="text-slate-500" />
            <span className="text-sm font-bold text-slate-800">市場情緒（Fear &amp; Greed）</span>
          </div>
          {sentiment.score == null ? (
            <div className="text-[12px] text-slate-400">等待每日更新後顯示。</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold leading-none" style={{ color: sentimentColor(sentiment.score) }}>
                  {sentiment.score}
                </div>
                <div className="text-[11px] font-semibold mt-1" style={{ color: sentimentColor(sentiment.score) }}>
                  {sentiment.rating}
                </div>
              </div>
              <div className="flex-1">
                <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 via-slate-300 to-red-500 relative">
                  <div
                    className="absolute -top-1 w-1 h-4 bg-slate-800 rounded"
                    style={{ left: `calc(${Math.min(100, Math.max(0, sentiment.score))}% - 2px)` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                  <span>極度恐懼</span>
                  <span>極度貪婪</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  前日 {sentiment.previousClose ?? '—'} · 一週前 {sentiment.weekAgo ?? '—'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Taiwan institutional flows */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-bold text-slate-800">🇹🇼 三大法人買賣超</span>
            <span className="text-[10px] text-slate-400">{flows.date || '待更新'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {flows.items.map((it) => {
              const v = it.netBuy
              const color = v == null ? 'text-slate-400' : v >= 0 ? 'text-red-500' : 'text-green-600'
              return (
                <div key={it.id} className="text-center bg-slate-50 rounded-lg py-2">
                  <div className="text-[11px] text-slate-500 mb-1">{it.label}</div>
                  <div className={`text-[15px] font-bold flex items-center justify-center gap-0.5 ${color}`}>
                    {v != null && (v >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
                    {v == null ? '—' : `${v >= 0 ? '+' : ''}${v}`}
                  </div>
                  <div className="text-[9px] text-slate-400">億元</div>
                </div>
              )
            })}
          </div>
          <div className="text-[10px] text-slate-400 mt-2">紅＝買超、綠＝賣超（台股慣例）</div>
        </div>
      </div>

      {/* Trend charts with z-score */}
      {hasTrendData && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-sm font-bold text-slate-800">關鍵指標走勢</span>
            <span className="text-[11px] text-slate-400">近 {history.length} 個交易日 · σ＝偏離常態程度</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
            {TRENDS.map((t) => {
              const vals = series(history, t.key)
              if (vals.length < 2) return null
              const a = anomaly(vals)
              const cur = vals[vals.length - 1]
              return (
                <div key={t.key} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-800">{t.label}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[15px] font-bold text-slate-900">
                        {cur.toLocaleString('zh-TW', { maximumFractionDigits: t.digits })}{t.unit}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ANOMALY_STYLE[a.level]}`}>
                        {a.label}
                      </span>
                    </div>
                  </div>
                  <Sparkline values={vals} color={a.level === 'high' ? '#dc2626' : a.level === 'low' ? '#2563eb' : '#475569'} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!hasTrendData && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
          <Minus size={14} className="text-slate-400" />
          <span className="text-[12px] text-slate-500 leading-relaxed">
            走勢圖會在每日自動抓取累積數日歷史後顯示。
          </span>
        </div>
      )}
    </div>
  )
}
