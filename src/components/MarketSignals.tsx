'use client'

import { TrendingUp, TrendingDown, RefreshCw, Info } from 'lucide-react'
import signalsData from '@/data/market_signals.json'
import { MarketSignals as MarketSignalsType, SignalLevel, Metric } from '@/types/market'
import SignalAnalysis from './SignalAnalysis'

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

const TONE_STYLE: Record<string, { bg: string; border: string; text: string; chip: string; label: string }> = {
  'risk-on': { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', chip: 'bg-emerald-600', label: '🟢' },
  caution: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', chip: 'bg-amber-500', label: '🟡' },
  'risk-off': { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', chip: 'bg-red-600', label: '🔴' },
  neutral: { bg: '#F8FAFC', border: '#E2E8F0', text: '#334155', chip: 'bg-slate-500', label: '⚪️' },
}

const SIGNAL_BADGE: Record<SignalLevel, string> = {
  high: 'bg-red-100 text-red-700',
  low: 'bg-blue-100 text-blue-700',
  neutral: 'bg-slate-100 text-slate-600',
}

function MetricList({ items }: { items: Metric[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
      {items.map((m) => (
        <div key={m.id} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-slate-800 pr-2">{m.label}</div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[16px] font-bold text-slate-900">
                {m.value === null ? '—' : `${m.value}${m.unit}`}
              </span>
              {m.signal && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${SIGNAL_BADGE[m.signalLevel || 'neutral']}`}>
                  {m.signal}
                </span>
              )}
            </div>
          </div>
          {m.note && <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{m.note}</div>}
        </div>
      ))}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-sm font-bold text-slate-800 mb-1">{title}</div>
      {subtitle && <p className="text-[11px] text-slate-400 mb-3">{subtitle}</p>}
      {children}
    </div>
  )
}

function EquityList({ items }: { items: { id: string; region: string; name: string; price: number | null; ytd: number | null; return1y: number | null; cagr3y: number | null; cagr5y: number | null }[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((e) => (
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

      {/* Synthesis — the data turned into a read */}
      {signals.synthesis && (
        <div className="mb-5 rounded-2xl p-4 border" style={{ background: (TONE_STYLE[signals.synthesis.regime.tone] || TONE_STYLE.neutral).bg, borderColor: (TONE_STYLE[signals.synthesis.regime.tone] || TONE_STYLE.neutral).border }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🧭</span>
            <span className="text-sm font-bold text-slate-800">今日市場研判</span>
            <span className={`text-[11px] font-bold text-white px-2 py-0.5 rounded-full ml-auto ${(TONE_STYLE[signals.synthesis.regime.tone] || TONE_STYLE.neutral).chip}`}>
              {signals.synthesis.regime.label}
            </span>
          </div>
          <p className="text-[13px] font-medium leading-relaxed mb-3" style={{ color: (TONE_STYLE[signals.synthesis.regime.tone] || TONE_STYLE.neutral).text }}>
            {signals.synthesis.regime.summary}
          </p>
          <div className="space-y-2">
            {signals.synthesis.points.map((p) => (
              <div key={p.theme} className="bg-white/70 rounded-xl px-3 py-2">
                <div className="text-[12px] font-bold text-slate-700 mb-0.5">{p.theme}</div>
                <div className="text-[12px] text-slate-600 leading-relaxed">{p.text}</div>
              </div>
            ))}
          </div>

          {signals.synthesis.scenarios && signals.synthesis.scenarios.length > 0 && (
            <div className="mt-3">
              <div className="text-[12px] font-bold text-slate-700 mb-1.5">情境推演</div>
              <div className="space-y-2">
                {signals.synthesis.scenarios.map((s) => (
                  <div key={s.name} className="bg-white/70 rounded-xl px-3 py-2">
                    <div className="text-[12px] font-bold text-slate-700 mb-0.5">{s.name}</div>
                    <div className="text-[12px] text-slate-600 leading-relaxed">{s.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {signals.synthesis.positioning && signals.synthesis.positioning.length > 0 && (
            <div className="mt-3 bg-white/70 rounded-xl px-3 py-2">
              <div className="text-[12px] font-bold text-slate-700 mb-1">💡 配置意涵</div>
              <ul className="list-disc pl-4 space-y-1">
                {signals.synthesis.positioning.map((t, i) => (
                  <li key={i} className="text-[12px] text-slate-600 leading-relaxed">{t}</li>
                ))}
              </ul>
            </div>
          )}

          {signals.synthesis.watch && signals.synthesis.watch.length > 0 && (
            <div className="mt-3 bg-white/70 rounded-xl px-3 py-2">
              <div className="text-[12px] font-bold text-slate-700 mb-1">🔭 緊盯訊號</div>
              <ul className="list-disc pl-4 space-y-1">
                {signals.synthesis.watch.map((t, i) => (
                  <li key={i} className="text-[12px] text-slate-600 leading-relaxed">{t}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] text-slate-400 mt-3 text-right">
            {signals.synthesis.engine === 'ai' ? 'AI 深度研判' : '規則式研判'} · 非投資建議
          </div>
        </div>
      )}

      {/* Analysis: divergences, sentiment, Taiwan flows, trend charts */}
      <SignalAnalysis />

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

      {/* Relative value */}
      {signals.relativeValue.length > 0 && (
        <Section title="股債相對價值" subtitle="判斷現在該抱股還是抱債、利率高是否真的緊縮。">
          <MetricList items={signals.relativeValue} />
        </Section>
      )}

      {/* Risk indicators */}
      {signals.riskIndicators.length > 0 && (
        <Section title="風險 · 壓力指標" subtitle="市場情緒與信用壓力的領先訊號。">
          <MetricList items={signals.riskIndicators} />
        </Section>
      )}

      {/* Macro backdrop */}
      {signals.macro.length > 0 && (
        <Section title="總體經濟背景" subtitle="通膨、就業、成長與央行流動性——決定報酬環境的底盤。">
          <MetricList items={signals.macro} />
        </Section>
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

      {/* Global sovereign yields */}
      {signals.globalYields.length > 0 && (
        <Section title="全球公債殖利率（10Y）" subtitle="其他主要經濟體的無風險年化報酬。">
          <MetricList items={signals.globalYields} />
        </Section>
      )}

      {/* Policy rates */}
      {signals.policyRates.length > 0 && (
        <Section title="主要央行政策利率" subtitle="驅動全球利率與資產定價的源頭。">
          <MetricList items={signals.policyRates} />
        </Section>
      )}

      {/* Equity annualized returns */}
      {signals.equityReturns.length > 0 && (
        <Section title="全球股市年化報酬（CAGR）" subtitle="各國大盤指數的年化報酬，可與上方殖利率對比評估相對吸引力。">
          <EquityList items={signals.equityReturns} />
        </Section>
      )}

      {/* US sectors */}
      {signals.sectors.length > 0 && (
        <Section title="美股類股輪動（年化報酬）" subtitle="比較各產業的相對強弱，看資金流向哪裡。">
          <EquityList items={signals.sectors} />
        </Section>
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
