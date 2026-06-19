'use client'

import { TrendingUp, TrendingDown, RefreshCw, Info } from 'lucide-react'
import signalsData from '@/data/market_signals.json'
import { MarketSignals as MarketSignalsType, SignalLevel } from '@/types/market'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signals = (signalsData as any) as MarketSignalsType

function fmtPct(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function fmtNum(n: number | null) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('zh-TW', { maximumFractionDigits: n < 50 ? 4 : 0 })
}

function retColor(n: number | null) {
  if (n === null || n === undefined) return 'text-slate-400'
  return n >= 0 ? 'text-green-600' : 'text-red-500'
}

const LEVEL_STYLE: Record<SignalLevel, { bg: string; border: string; text: string; badge: string }> = {
  high: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', badge: 'bg-red-100 text-red-700' },
  low: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', badge: 'bg-blue-100 text-blue-700' },
  neutral: { bg: '#F8FAFC', border: '#E2E8F0', text: '#475569', badge: 'bg-slate-100 text-slate-600' },
}

function ReturnCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
      <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
      <div className={`text-[12px] font-bold ${retColor(value)}`}>{fmtPct(value)}</div>
    </div>
  )
}

export default function MarketSignals() {
  return (
    <div className="pb-8">
      {/* Header */}
      <div className="pt-1 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-slate-900">全球市場訊號</h1>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <RefreshCw size={11} />
            {signals.asOf}
          </div>
        </div>
        <p className="text-[12px] text-slate-500">
          年化報酬與殖利率指標 · 資料來源 {signals.source}
        </p>
      </div>

      {signals.placeholder && (
        <div className="mb-4 rounded-xl p-3 border bg-amber-50 border-amber-200 flex items-start gap-2">
          <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-[12px] text-amber-800 leading-relaxed">
            目前顯示為初始化資料，等待每日自動更新（04:00）首次抓取後將替換為即時數據。
          </div>
        </div>
      )}

      {/* Headline signals */}
      {signals.headline.length > 0 && (
        <div className="space-y-2.5 mb-5">
          {signals.headline.map((h) => {
            const s = LEVEL_STYLE[h.tagLevel] || LEVEL_STYLE.neutral
            return (
              <div key={h.id} className="rounded-2xl p-4 border" style={{ background: s.bg, borderColor: s.border }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{h.icon}</span>
                    <span className="text-[13px] font-bold text-slate-800">{h.title}</span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{h.tag}</span>
                </div>
                <div className="text-2xl font-bold mb-1" style={{ color: s.text }}>{h.value}</div>
                <p className="text-[12px] text-slate-600 leading-relaxed">{h.detail}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Bond yields */}
      {signals.bondYields.length > 0 && (
        <div className="mb-5">
          <div className="text-sm font-bold text-slate-800 mb-1">無風險年化報酬（公債殖利率）</div>
          <p className="text-[11px] text-slate-400 mb-3">殖利率即持有到期的年化報酬，是評估其他資產的基準線。</p>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
            {signals.bondYields.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">{b.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {b.region}
                    {b.percentile5y !== null && ` · 近 5 年第 ${b.percentile5y} 百分位`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {b.changeBps !== null && (
                    <span className={`text-[11px] font-semibold ${b.changeBps >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {b.changeBps >= 0 ? '+' : ''}{b.changeBps} bps
                    </span>
                  )}
                  <span className="text-[16px] font-bold text-slate-900 w-16 text-right">{b.yield.toFixed(2)}%</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 w-12 text-center">
                    {b.signal}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equity annualized returns */}
      {signals.equityReturns.length > 0 && (
        <div className="mb-5">
          <div className="text-sm font-bold text-slate-800 mb-1">全球股市年化報酬（CAGR）</div>
          <p className="text-[11px] text-slate-400 mb-3">各國大盤指數的年化報酬，可與上方殖利率對比評估相對吸引力。</p>
          <div className="space-y-2.5">
            {signals.equityReturns.map((e) => (
              <div key={e.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-[13px] font-bold text-slate-900">{e.name}</span>
                    <span className="text-[11px] text-slate-400 ml-2">{e.region} · {fmtNum(e.price)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <ReturnCell label="YTD" value={e.ytd} />
                  <ReturnCell label="近 1 年" value={e.return1y} />
                  <ReturnCell label="3 年化" value={e.cagr3y} />
                  <ReturnCell label="5 年化" value={e.cagr5y} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other assets */}
      {signals.otherAssets.length > 0 && (
        <div className="mb-5">
          <div className="text-sm font-bold text-slate-800 mb-3">商品 · 匯率 · 加密</div>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
            {signals.otherAssets.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{o.icon}</span>
                  <div>
                    <div className="text-[13px] font-semibold text-slate-800">{o.name}</div>
                    <div className="text-[11px] text-slate-400">{fmtNum(o.price)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="text-[10px] text-slate-400">近 1 年</div>
                    <div className={`text-[12px] font-bold flex items-center gap-0.5 ${retColor(o.return1y)}`}>
                      {o.return1y !== null && (o.return1y >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
                      {fmtPct(o.return1y)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">5 年化</div>
                    <div className={`text-[12px] font-bold ${retColor(o.cagr5y)}`}>{fmtPct(o.cagr5y)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-slate-400 text-[11px] mt-4">
        每日 04:00 由 GitHub Actions 自動抓取 · 非投資建議
      </div>
    </div>
  )
}
