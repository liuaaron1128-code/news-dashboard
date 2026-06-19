'use client'

import { useState, useMemo } from 'react'
import { Eye, SlidersHorizontal, NotebookPen, TrendingUp, TrendingDown } from 'lucide-react'
import watchlistData from '@/data/watchlist.json'
import decisionsData from '@/data/decisions.json'
import { WatchlistData, Decision } from '@/types/watchlist'

const watchlist = watchlistData as WatchlistData
const decisions = decisionsData as Decision[]
const items = watchlist.items || []
const totalWeight = items.reduce((s, it) => s + (it.weight ?? 0), 0) || 1

const ACTION_STYLE: Record<Decision['action'], { label: string; cls: string }> = {
  buy: { label: '買進', cls: 'bg-red-100 text-red-700' },
  sell: { label: '賣出', cls: 'bg-green-100 text-green-700' },
  hold: { label: '續抱', cls: 'bg-slate-100 text-slate-600' },
  watch: { label: '觀察', cls: 'bg-blue-100 text-blue-700' },
}

function pctColor(n: number) {
  return n >= 0 ? 'text-red-500' : 'text-green-600'
}

export default function DecisionPanel() {
  // What-if controls. rateHikes in "碼" (1 碼 = 0.25%); marketMove in %.
  const [rateHikes, setRateHikes] = useState(0)
  const [marketMove, setMarketMove] = useState(0)

  const rateChangePct = rateHikes * 0.25

  const sim = useMemo(() => {
    return items.map((it) => {
      const beta = it.beta ?? 1
      const duration = it.duration ?? 0
      const equityImpact = beta * marketMove
      const rateImpact = -duration * rateChangePct
      const total = equityImpact + rateImpact
      return { it, total }
    })
  }, [marketMove, rateChangePct])

  const portfolioImpact = useMemo(
    () => sim.reduce((s, { it, total }) => s + ((it.weight ?? 0) / totalWeight) * total, 0),
    [sim],
  )

  return (
    <div className="pb-8 space-y-5">
      <div className="pt-1">
        <h1 className="text-lg font-bold text-slate-900">決策中心</h1>
        <p className="text-[12px] text-slate-500">觀察清單、情境模擬與判斷紀錄 · 非投資建議</p>
      </div>

      {/* Watchlist */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Eye size={14} className="text-slate-500" />
          <span className="text-sm font-bold text-slate-800">觀察清單</span>
        </div>
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-[14px] font-bold text-slate-900">{it.name}</span>
                  <span className="text-[11px] text-slate-400 ml-2">{it.symbol}</span>
                </div>
                {it.price != null && (
                  <span className="text-[13px] font-bold text-slate-700">
                    {it.price.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-slate-500 leading-relaxed">{it.thesis}</p>
              <div className="flex gap-3 mt-2">
                {it.ytd != null && (
                  <span className={`text-[11px] font-semibold ${pctColor(it.ytd)}`}>YTD {it.ytd >= 0 ? '+' : ''}{it.ytd}%</span>
                )}
                {it.return1y != null && (
                  <span className={`text-[11px] font-semibold ${pctColor(it.return1y)}`}>1年 {it.return1y >= 0 ? '+' : ''}{it.return1y}%</span>
                )}
                {it.weight != null && (
                  <span className="text-[11px] text-slate-400">配置 {Math.round((it.weight / totalWeight) * 100)}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What-if simulator */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <SlidersHorizontal size={14} className="text-slate-500" />
          <span className="text-sm font-bold text-slate-800">情境模擬（What-if）</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-4">
          {/* Rate slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12.5px] font-semibold text-slate-700">升/降息</span>
              <span className="text-[12.5px] font-bold text-slate-900">
                {rateHikes > 0 ? '+' : ''}{rateHikes} 碼（{rateChangePct > 0 ? '+' : ''}{rateChangePct.toFixed(2)}%）
              </span>
            </div>
            <input
              type="range" min={-8} max={8} step={1} value={rateHikes}
              onChange={(e) => setRateHikes(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
          {/* Market slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12.5px] font-semibold text-slate-700">大盤漲/跌</span>
              <span className="text-[12.5px] font-bold text-slate-900">{marketMove > 0 ? '+' : ''}{marketMove}%</span>
            </div>
            <input
              type="range" min={-30} max={30} step={1} value={marketMove}
              onChange={(e) => setMarketMove(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Portfolio result */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-slate-700">估計組合衝擊</span>
            <span className={`text-xl font-bold flex items-center gap-1 ${pctColor(portfolioImpact)}`}>
              {portfolioImpact >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {portfolioImpact >= 0 ? '+' : ''}{portfolioImpact.toFixed(1)}%
            </span>
          </div>

          {/* Per-holding */}
          <div className="space-y-1.5">
            {sim.map(({ it, total }) => (
              <div key={it.id} className="flex items-center justify-between text-[12px]">
                <span className="text-slate-600">{it.name}</span>
                <span className={`font-semibold ${pctColor(total)}`}>{total >= 0 ? '+' : ''}{total.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            粗估：股票衝擊 ≈ beta × 大盤變動；利率衝擊 ≈ −久期 × 利率變動。僅供方向性參考，未計入相關性與非線性。
          </p>
        </div>
      </div>

      {/* Decision log */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <NotebookPen size={14} className="text-slate-500" />
          <span className="text-sm font-bold text-slate-800">判斷紀錄</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
          {decisions.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-slate-400">尚無紀錄</div>
          )}
          {decisions.map((d, i) => {
            const a = ACTION_STYLE[d.action]
            return (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-800">{d.name || d.symbol}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.cls}`}>{a.label}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{d.date}</span>
                </div>
                <p className="text-[12px] text-slate-600 leading-relaxed">{d.rationale}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
