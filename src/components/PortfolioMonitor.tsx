'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, Calendar, RefreshCw } from 'lucide-react'
import portfolioData from '@/data/portfolio.json'
import analysisData from '@/data/portfolio_analysis.json'
import { Portfolio, PortfolioAnalysis, Fund, DCAContract } from '@/types/portfolio'

const portfolio = portfolioData as Portfolio
const analyses = analysisData as PortfolioAnalysis[]

function calcPayments(contract: DCAContract, today: Date): number {
  if (contract.status === 'paused') return contract.confirmedPayments ?? 0
  const start = new Date(contract.startDate)
  const day = contract.paymentDay
  let count = 0
  // Find first payment date
  let first = new Date(start.getFullYear(), start.getMonth(), day)
  if (first < start) first = new Date(start.getFullYear(), start.getMonth() + 1, day)
  let d = new Date(first)
  while (d <= today) {
    count++
    d = new Date(d.getFullYear(), d.getMonth() + 1, day)
  }
  return count
}

function calcFundInvested(fund: Fund, today: Date): { invested: number; payments: number } {
  let invested = 0
  let payments = 0
  for (const c of fund.contracts) {
    const p = calcPayments(c, today)
    payments += p
    invested += p * c.monthlyAmount
  }
  return { invested, payments }
}

function calcMonthlyDCA(fund: Fund): number {
  return fund.contracts.filter(c => c.status === 'active').reduce((s, c) => s + c.monthlyAmount, 0)
}

function getDCAThisMonth(fund: Fund, today: Date): DCAContract[] {
  const day = today.getDate()
  return fund.contracts.filter(c => c.status === 'active' && c.paymentDay === day)
}

function getUpcomingDCA(fund: Fund, today: Date, days = 7): (DCAContract & { daysUntil: number })[] {
  const result: (DCAContract & { daysUntil: number })[] = []
  for (const c of fund.contracts) {
    if (c.status !== 'active') continue
    const curDay = today.getDate()
    const payDay = c.paymentDay
    let daysUntil: number
    if (payDay > curDay) {
      daysUntil = payDay - curDay
    } else if (payDay === curDay) {
      daysUntil = 0
    } else {
      // Next month
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      daysUntil = daysInMonth - curDay + payDay
    }
    if (daysUntil > 0 && daysUntil <= days) result.push({ ...c, daysUntil })
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil)
}

function fmt(n: number) {
  return n.toLocaleString('zh-TW')
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    low:      { label: '低風險',  bg: '#D1FAE5', text: '#059669' },
    medium:   { label: '中風險',  bg: '#FEF3C7', text: '#D97706' },
    high:     { label: '高風險',  bg: '#FEE2E2', text: '#DC2626' },
    critical: { label: '極高風險', bg: '#FEE2E2', text: '#991B1B' },
  }
  const s = map[level] || map.medium
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

export default function PortfolioMonitor() {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const latest = analyses[0] as PortfolioAnalysis | undefined

  const computed = useMemo(() => {
    let totalInvested = 0
    let totalMonthly = 0
    const fundRows: Array<{
      fund: Fund
      invested: number
      payments: number
      monthly: number
      todayDCA: DCAContract[]
      upcoming: (DCAContract & { daysUntil: number })[]
      analysis: PortfolioAnalysis['funds'][0] | undefined
    }> = []

    for (const fund of portfolio.funds) {
      const { invested, payments } = calcFundInvested(fund, today)
      const monthly = calcMonthlyDCA(fund)
      const todayDCA = getDCAThisMonth(fund, today)
      const upcoming = getUpcomingDCA(fund, today)
      const analysis = latest?.funds.find(f => f.code === fund.code)
      totalInvested += invested
      totalMonthly += monthly
      fundRows.push({ fund, invested, payments, monthly, todayDCA, upcoming, analysis })
    }

    const todayPayments = fundRows.flatMap(r =>
      r.todayDCA.map(c => ({ fund: r.fund, contract: c }))
    )
    const upcomingAll = fundRows.flatMap(r =>
      r.upcoming.map(c => ({ fund: r.fund, contract: c }))
    ).sort((a, b) => a.contract.daysUntil - b.contract.daysUntil)

    return { totalInvested, totalMonthly, fundRows, todayPayments, upcomingAll }
  }, [latest])

  const estValue = latest?.summary.estimatedValue ?? null
  const returnAmt = estValue !== null ? estValue - computed.totalInvested : null
  const returnPct = returnAmt !== null && computed.totalInvested > 0
    ? (returnAmt / computed.totalInvested) * 100 : null

  const isDataFresh = latest?.date === todayStr

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-slate-900">投資組合監測</h1>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <RefreshCw size={11} />
            {latest ? (isDataFresh ? '今日已更新' : `上次 ${latest.date}`) : '尚未更新'}
          </div>
        </div>
        <p className="text-[12px] text-slate-500">每日自動分析 · 結合市場新聞與泡沫指數</p>
      </div>

      {/* Summary Card */}
      <div className="mx-4 mb-4 rounded-2xl p-4 text-white"
        style={{ background: 'linear-gradient(135deg, #1D3557 0%, #457B9D 100%)' }}>
        <div className="text-[11px] font-semibold opacity-70 mb-1">總投入金額</div>
        <div className="text-2xl font-bold mb-3">TWD {fmt(computed.totalInvested)}</div>
        <div className="flex gap-4">
          <div>
            <div className="text-[10px] opacity-60">估計市值</div>
            <div className="text-base font-bold">
              {estValue !== null ? `TWD ${fmt(estValue)}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] opacity-60">損益</div>
            <div className={`text-base font-bold flex items-center gap-0.5 ${returnAmt !== null ? (returnAmt >= 0 ? 'text-green-300' : 'text-red-300') : ''}`}>
              {returnAmt !== null ? (
                <>
                  {returnAmt >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {returnAmt >= 0 ? '+' : ''}{fmt(Math.round(returnAmt))}
                  {returnPct !== null && <span className="text-[11px] ml-1">({returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%)</span>}
                </>
              ) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] opacity-60">每月定扣</div>
            <div className="text-base font-bold">TWD {fmt(computed.totalMonthly)}</div>
          </div>
        </div>
      </div>

      {/* Today's DCA */}
      {computed.todayPayments.length > 0 && (
        <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-blue-600" />
            <span className="text-sm font-bold text-blue-800">今日定期定額</span>
          </div>
          {computed.todayPayments.map(({ fund, contract }) => (
            <div key={contract.id} className="flex items-center justify-between py-1.5 border-b border-blue-100 last:border-0">
              <div className="flex items-center gap-2">
                <span>{fund.icon}</span>
                <span className="text-sm font-medium text-slate-800">{fund.shortName}</span>
              </div>
              <span className="text-sm font-bold text-blue-700">+TWD {fmt(contract.monthlyAmount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming DCA (next 7 days) */}
      {computed.upcomingAll.length > 0 && (
        <div className="mx-4 mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-bold text-slate-800 mb-3">📅 近 7 日定期定額</div>
          <div className="space-y-2">
            {computed.upcomingAll.slice(0, 6).map(({ fund, contract }) => (
              <div key={contract.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{fund.icon}</span>
                  <div>
                    <div className="text-[13px] font-medium text-slate-800">{fund.shortName}</div>
                    <div className="text-[11px] text-slate-400">每月 {contract.paymentDay} 日</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold text-slate-700">TWD {fmt(contract.monthlyAmount)}</div>
                  <div className="text-[11px] text-slate-400">
                    {contract.daysUntil === 1 ? '明天' : `${contract.daysUntil} 天後`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {latest?.alerts && latest.alerts.length > 0 && (
        <div className="mx-4 mb-4 space-y-2">
          {latest.alerts.map((alert, i) => {
            const map = {
              danger:  { Icon: AlertTriangle, bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', icon: '#DC2626' },
              warning: { Icon: AlertTriangle, bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: '#D97706' },
              info:    { Icon: Info,          bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: '#3B82F6' },
            }
            const s = map[alert.level] || map.info
            const { Icon } = s
            return (
              <div key={i} className="rounded-xl p-3 border"
                style={{ background: s.bg, borderColor: s.border }}>
                <div className="flex items-start gap-2">
                  <Icon size={14} style={{ color: s.icon, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div className="text-[13px] font-bold" style={{ color: s.text }}>{alert.title}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: s.text, opacity: 0.8 }}>{alert.detail}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Fund breakdown */}
      <div className="mx-4 mb-4">
        <div className="text-sm font-bold text-slate-800 mb-3">各基金明細</div>
        <div className="space-y-3">
          {computed.fundRows.map(({ fund, invested, payments, monthly, analysis }) => {
            const estVal = analysis?.estimatedValue ?? null
            const retAmt = estVal !== null ? estVal - invested : null
            const retPct = retAmt !== null && invested > 0 ? (retAmt / invested) * 100 : null
            const isPaused = fund.contracts.every(c => c.status === 'paused')

            return (
              <div key={fund.code} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: fund.color + '18' }}>
                      {fund.icon}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-slate-900 leading-tight">{fund.shortName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {fund.code} · {fund.category}
                        {fund.isTISA && <span className="ml-1 bg-purple-100 text-purple-700 px-1 rounded text-[10px] font-bold">TISA</span>}
                        {fund.currency === 'USD' && <span className="ml-1 bg-blue-100 text-blue-700 px-1 rounded text-[10px] font-bold">USD</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isPaused && <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">暫停</span>}
                    {analysis && <RiskBadge level={analysis.riskLevel} />}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 mb-0.5">已投入</div>
                    <div className="text-[13px] font-bold text-slate-800">{fmt(invested)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 mb-0.5">估計市值</div>
                    <div className="text-[13px] font-bold text-slate-800">
                      {estVal !== null ? fmt(Math.round(estVal)) : '—'}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 mb-0.5">損益</div>
                    <div className={`text-[13px] font-bold ${retAmt === null ? 'text-slate-400' : retAmt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {retAmt !== null ? `${retAmt >= 0 ? '+' : ''}${retPct!.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                  <span>已扣款 {payments} 次 · 每月 {fmt(monthly)} 元</span>
                  {analysis?.nav && (
                    <span>NAV {analysis.nav.toFixed(2)} ({analysis.navDate})</span>
                  )}
                </div>

                {analysis?.riskNotes && (
                  <div className="text-[12px] text-slate-600 bg-slate-50 rounded-xl px-3 py-2 leading-relaxed">
                    {analysis.riskNotes}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Market Context + Recommendation */}
      {latest && (
        <>
          {latest.marketContext && (
            <div className="mx-4 mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🧠</span>
                <span className="text-sm font-bold text-slate-800">市場環境分析</span>
              </div>
              <p className="text-[13px] text-slate-700 leading-relaxed">{latest.marketContext}</p>
            </div>
          )}
          {latest.recommendation && (
            <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={15} className="text-blue-600" />
                <span className="text-sm font-bold text-blue-800">今日操作建議</span>
              </div>
              <p className="text-[13px] text-blue-900 leading-relaxed">{latest.recommendation}</p>
            </div>
          )}
        </>
      )}

      {!latest && (
        <div className="mx-4 text-center py-10 bg-white border border-slate-200 rounded-2xl">
          <div className="text-3xl mb-3">⏳</div>
          <div className="text-sm font-semibold text-slate-700 mb-1">分析尚未生成</div>
          <div className="text-[12px] text-slate-400">每日 06:00 自動更新 · 包含 NAV 查詢、風險評估、操作建議</div>
        </div>
      )}

      <div className="text-center text-slate-400 text-[11px] mt-4">
        每日 06:10 自動更新 · 結合新聞 + 泡沫指數分析
      </div>
    </div>
  )
}
