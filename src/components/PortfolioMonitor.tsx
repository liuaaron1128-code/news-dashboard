'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, Calendar, RefreshCw } from 'lucide-react'
import portfolioRaw from '@/data/portfolio.json'
import analysisData from '@/data/portfolio_analysis.json'
import { PortfolioAnalysis, DCAContract } from '@/types/portfolio'

interface Snapshot { invested: number; units: number | null; avgNAV: number | null }
interface FundData {
  code: string; name: string; shortName: string; currency: 'TWD' | 'USD'
  category: string; icon: string; color: string; isTISA: boolean
  snapshot: Snapshot; contracts: DCAContract[]
}
interface ETFData {
  code: string; name: string; shortName: string; exchange: string
  shares: number; avgCost: number | null; icon: string; color: string
}
interface PortfolioData { snapshotDate: string; etfs: ETFData[]; funds: FundData[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const portfolio = (portfolioRaw as any) as PortfolioData
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const analyses = (analysisData as any) as PortfolioAnalysis[]

function calcPaymentsSince(contract: DCAContract, since: Date, today: Date): number {
  if (contract.status === 'paused') return 0
  const day = contract.paymentDay
  let d = new Date(since.getFullYear(), since.getMonth(), day)
  if (d <= since) d = new Date(since.getFullYear(), since.getMonth() + 1, day)
  let count = 0
  while (d <= today) {
    count++
    d = new Date(d.getFullYear(), d.getMonth() + 1, day)
  }
  return count
}

function calcMonthlyDCA(fund: FundData): number {
  return fund.contracts.filter(c => c.status === 'active').reduce((s, c) => s + c.monthlyAmount, 0)
}

function getDCAToday(fund: FundData, today: Date): DCAContract[] {
  const day = today.getDate()
  return fund.contracts.filter(c => c.status === 'active' && c.paymentDay === day)
}

function getUpcomingDCA(fund: FundData, today: Date, days = 7): (DCAContract & { daysUntil: number })[] {
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
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      daysUntil = daysInMonth - curDay + payDay
    }
    if (daysUntil > 0 && daysUntil <= days) result.push({ ...c, daysUntil })
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil)
}

function fmt(n: number) { return n.toLocaleString('zh-TW') }
function fmtDec(n: number, d = 2) { return n.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d }) }

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    low:      { label: '低風險',   bg: '#D1FAE5', text: '#059669' },
    medium:   { label: '中風險',   bg: '#FEF3C7', text: '#D97706' },
    high:     { label: '高風險',   bg: '#FEE2E2', text: '#DC2626' },
    critical: { label: '極高風險', bg: '#FEE2E2', text: '#991B1B' },
  }
  const s = map[level] || map.medium
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.text }}>{s.label}</span>
  )
}

export default function PortfolioMonitor() {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const latest = analyses[0] as PortfolioAnalysis | undefined

  const computed = useMemo(() => {
    const now = new Date()
    const snapshotDate = new Date(portfolio.snapshotDate)
    let totalInvestedTWD = 0
    let totalMonthly = 0

    const fundRows = portfolio.funds.map(fund => {
      let addedSince = 0
      for (const c of fund.contracts) {
        const p = calcPaymentsSince(c, snapshotDate, now)
        addedSince += p * c.monthlyAmount
      }
      const invested = fund.snapshot.invested + addedSince
      const monthly = calcMonthlyDCA(fund)
      const todayDCA = getDCAToday(fund, now)
      const upcoming = getUpcomingDCA(fund, now)
      const analysis = latest?.funds.find(f => f.code === fund.code)

      if (fund.currency === 'TWD') totalInvestedTWD += invested
      totalMonthly += monthly
      return { fund, invested, addedSince, monthly, todayDCA, upcoming, analysis }
    })

    const etfRows = portfolio.etfs.map(etf => ({
      etf,
      analysis: latest?.funds.find(f => f.code === etf.code),
    }))

    const todayPayments = fundRows.flatMap(r => r.todayDCA.map(c => ({ fund: r.fund, contract: c })))
    const upcomingAll = fundRows
      .flatMap(r => r.upcoming.map(c => ({ fund: r.fund, contract: c })))
      .sort((a, b) => a.contract.daysUntil - b.contract.daysUntil)

    return { totalInvestedTWD, totalMonthly, fundRows, etfRows, todayPayments, upcomingAll }
  }, [latest])

  const totalInvested = latest?.summary.totalInvested ?? computed.totalInvestedTWD
  const estValue = latest?.summary.estimatedValue ?? null
  const returnAmt = estValue !== null ? estValue - totalInvested : null
  const returnPct = returnAmt !== null && totalInvested > 0 ? (returnAmt / totalInvested) * 100 : null
  const isDataFresh = latest?.date === todayStr

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-2 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-slate-900">投資組合監測</h1>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <RefreshCw size={11} />
            {latest ? (isDataFresh ? '今日已更新' : `上次 ${latest.date}`) : '尚未更新'}
          </div>
        </div>
        <p className="text-[12px] text-slate-500">
          快照日期 {portfolio.snapshotDate} · 每日 06:10 自動分析
        </p>
      </div>

      {/* Summary Card */}
      <div className="mx-4 mb-4 rounded-2xl p-4 text-white"
        style={{ background: 'linear-gradient(135deg, #1D3557 0%, #457B9D 100%)' }}>
        <div className="text-[11px] font-semibold opacity-70 mb-1">總投入金額（TWD）</div>
        <div className="text-2xl font-bold mb-3">$ {fmt(Math.round(totalInvested))}</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] opacity-60">估計市值</div>
            <div className="text-[15px] font-bold">
              {estValue !== null ? `$${fmt(Math.round(estValue))}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] opacity-60">損益</div>
            <div className={`text-[15px] font-bold flex items-center gap-0.5 ${
              returnAmt === null ? '' : returnAmt >= 0 ? 'text-green-300' : 'text-red-300'
            }`}>
              {returnAmt !== null ? (
                <>
                  {returnAmt >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {returnAmt >= 0 ? '+' : ''}{fmt(Math.round(returnAmt))}
                  {returnPct !== null && (
                    <span className="text-[11px] ml-1">({returnPct >= 0 ? '+' : ''}{fmtDec(returnPct, 1)}%)</span>
                  )}
                </>
              ) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] opacity-60">每月定扣</div>
            <div className="text-[15px] font-bold">${fmt(computed.totalMonthly)}</div>
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

      {/* Upcoming DCA */}
      {computed.upcomingAll.length > 0 && (
        <div className="mx-4 mb-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-bold text-slate-800 mb-3">📅 近 7 日定期定額</div>
          <div className="space-y-2">
            {computed.upcomingAll.slice(0, 8).map(({ fund, contract }) => (
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
            const styles = {
              danger:  { Icon: AlertTriangle, bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', icon: '#DC2626' },
              warning: { Icon: AlertTriangle, bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: '#D97706' },
              info:    { Icon: Info,          bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: '#3B82F6' },
            }
            const s = styles[alert.level] || styles.info
            const { Icon } = s
            return (
              <div key={i} className="rounded-xl p-3 border" style={{ background: s.bg, borderColor: s.border }}>
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

      {/* Fund & ETF Breakdown */}
      <div className="mx-4 mb-4">
        <div className="text-sm font-bold text-slate-800 mb-3">各資產明細</div>
        <div className="space-y-3">

          {/* ETF Cards */}
          {computed.etfRows.map(({ etf, analysis }) => {
            const price = analysis?.nav ?? null
            const estVal = price !== null ? etf.shares * price : null
            const cost = etf.avgCost !== null ? etf.shares * etf.avgCost : null
            const retAmt = estVal !== null && cost !== null ? estVal - cost : null
            const retPct = retAmt !== null && cost !== null && cost > 0 ? (retAmt / cost) * 100 : null
            return (
              <div key={etf.code} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: etf.color + '18' }}>
                      {etf.icon}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-slate-900 leading-tight">{etf.shortName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {etf.code} · {etf.exchange} ETF
                        <span className="ml-1 bg-amber-100 text-amber-700 px-1 rounded text-[10px] font-bold">股票</span>
                      </div>
                    </div>
                  </div>
                  {analysis && <RiskBadge level={analysis.riskLevel} />}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 mb-0.5">持有股數</div>
                    <div className="text-[13px] font-bold text-slate-800">{fmt(etf.shares)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 mb-0.5">現價 / 市值</div>
                    <div className="text-[13px] font-bold text-slate-800">
                      {price !== null ? `$${fmtDec(price, 2)}` : '—'}
                      {estVal !== null && <div className="text-[11px] text-slate-500">${fmt(Math.round(estVal))}</div>}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 mb-0.5">損益</div>
                    <div className={`text-[13px] font-bold ${
                      retAmt === null ? 'text-slate-400' : retAmt >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {retAmt !== null
                        ? `${retAmt >= 0 ? '+' : ''}${fmtDec(retPct!, 1)}%`
                        : price !== null ? '成本未知' : '—'}
                    </div>
                  </div>
                </div>

                {analysis?.riskNotes && (
                  <div className="text-[12px] text-slate-600 bg-slate-50 rounded-xl px-3 py-2 leading-relaxed">
                    {analysis.riskNotes}
                  </div>
                )}
              </div>
            )
          })}

          {/* Fund Cards */}
          {computed.fundRows.map(({ fund, invested, addedSince, monthly, analysis }) => {
            const estVal = analysis?.estimatedValue ?? null
            const retAmt = estVal !== null ? estVal - invested : null
            const retPct = retAmt !== null && invested > 0 ? (retAmt / invested) * 100 : null
            const isPaused = fund.contracts.length > 0 && fund.contracts.every(c => c.status === 'paused')
            const hasNoContracts = fund.contracts.length === 0

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
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {isPaused && <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">暫停</span>}
                    {hasNoContracts && <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">無DCA</span>}
                    {analysis && <RiskBadge level={analysis.riskLevel} />}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 mb-0.5">已投入</div>
                    <div className="text-[13px] font-bold text-slate-800">{fmt(invested)}</div>
                    {addedSince > 0 && (
                      <div className="text-[10px] text-blue-500">+{fmt(addedSince)} 新</div>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 mb-0.5">估計市值</div>
                    <div className="text-[13px] font-bold text-slate-800">
                      {estVal !== null ? fmt(Math.round(estVal)) : '—'}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 mb-0.5">損益</div>
                    <div className={`text-[13px] font-bold ${
                      retAmt === null ? 'text-slate-400' : retAmt >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {retAmt !== null ? `${retAmt >= 0 ? '+' : ''}${fmtDec(retPct!, 1)}%` : '—'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                  <span>
                    {fund.snapshot.units !== null
                      ? `${fmtDec(fund.snapshot.units, 1)} 單位`
                      : ''}
                    {monthly > 0 ? ` · 每月 ${fmt(monthly)} 元` : ''}
                  </span>
                  {analysis?.nav && (
                    <span>NAV {fmtDec(analysis.nav, 2)} ({analysis.navDate})</span>
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
          <div className="text-[12px] text-slate-400">每日 06:10 自動更新 · 包含 NAV 查詢、風險評估、操作建議</div>
        </div>
      )}

      <div className="text-center text-slate-400 text-[11px] mt-4">
        每日 06:10 自動更新 · 結合新聞 + 泡沫指數分析
      </div>
    </div>
  )
}
