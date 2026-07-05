'use client'

import { useMemo, useState } from 'react'
import { Radar, ChevronDown, ChevronUp, ExternalLink, Flame, Globe, Search, Newspaper } from 'lucide-react'
import leadsData from '@/data/leads.json'
import { LeadsData, Lead, SignalType } from '@/types/leads'

const data = leadsData as unknown as LeadsData

const SIGNAL_STYLE: Record<SignalType, string> = {
  轉型意圖: 'bg-emerald-100 text-emerald-700',
  擴張: 'bg-blue-100 text-blue-700',
  痛點: 'bg-red-100 text-red-700',
  '政府補助/標案': 'bg-purple-100 text-purple-700',
}

function scoreTier(score: number) {
  if (score >= 75) return { label: '高優先', cls: 'bg-red-100 text-red-700' }
  if (score >= 55) return { label: '中優先', cls: 'bg-amber-100 text-amber-700' }
  return { label: '觀察中', cls: 'bg-slate-100 text-slate-500' }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{children}</div>
}

function LeadCard({ lead }: { lead: Lead }) {
  const [expanded, setExpanded] = useState(false)
  const tier = scoreTier(lead.score)
  const q = encodeURIComponent(lead.company)

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-3 border border-slate-200">
      <div className="px-4 pt-3.5 pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tier.cls}`}>
            {lead.score >= 75 && <Flame size={10} className="inline -mt-0.5 mr-0.5" />}
            {lead.score} · {tier.label}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${lead.isCoreIndustry ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
            {lead.industry}{lead.isCoreIndustry ? ' ★' : ''}
          </span>
          {lead.signals.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700 flex items-center gap-0.5">
              <Newspaper size={10} /> 新聞訊號 {lead.signals.length}
            </span>
          )}
        </div>

        <h3 className="text-slate-900 font-bold text-[15px] leading-snug">{lead.company}</h3>
        {lead.brief && <p className="text-slate-500 text-[12px] mt-0.5 leading-relaxed">{lead.brief}</p>}

        {!expanded && lead.whyNow && (
          <p className="text-slate-600 text-[12.5px] mt-2 leading-relaxed line-clamp-2">{lead.whyNow}</p>
        )}

        {/* Product chips (always visible) */}
        {lead.products.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {lead.products.map((p, i) => (
              <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {p.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end mt-2">
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${expanded ? 'text-slate-400' : 'text-blue-500'}`}>
            {expanded ? (<><ChevronUp size={13} /> 收合</>) : (<>完整檔案 <ChevronDown size={13} /></>)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/50">
          {lead.whyNow && (
            <div>
              <SectionLabel>推薦原因</SectionLabel>
              <p className="text-slate-800 text-sm leading-relaxed">{lead.whyNow}</p>
            </div>
          )}

          {lead.products.length > 0 && (
            <div>
              <SectionLabel>可能對應的產品</SectionLabel>
              <div className="space-y-1.5">
                {lead.products.map((p, i) => (
                  <div key={i} className="flex gap-2 text-[12.5px]">
                    <span className="font-bold text-blue-700 flex-shrink-0">{p.name}</span>
                    <span className="text-slate-600 leading-relaxed">{p.use}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lead.approach.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5">
              <div className="text-xs font-bold text-emerald-600 mb-2">🎯 推薦進行方式</div>
              <ol className="space-y-1.5">
                {lead.approach.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                    <span className="font-bold text-emerald-600 flex-shrink-0">{i + 1}.</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <SectionLabel>聯絡方式</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[12px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
                >
                  <Globe size={12} /> 官網
                </a>
              )}
              <a
                href={`https://www.google.com/search?q=${q}+聯絡方式+代表號`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
              >
                <Search size={12} /> 查聯絡電話
              </a>
              <a
                href={`https://www.104.com.tw/company/search/?keyword=${q}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
              >
                <Search size={12} /> 104 公司頁（看徵才動向）
              </a>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">官網為 AI 判讀，電話與窗口請以官網為準。</p>
          </div>

          {lead.scoreReason && (
            <div>
              <SectionLabel>評分理由</SectionLabel>
              <p className="text-slate-600 text-[12.5px] leading-relaxed">{lead.scoreReason}</p>
            </div>
          )}

          {lead.signals.length > 0 && (
            <div>
              <SectionLabel>新聞訊號紀錄</SectionLabel>
              <div className="space-y-2">
                {lead.signals.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-slate-400 w-10 flex-shrink-0 pt-0.5">{s.date.slice(5)}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${SIGNAL_STYLE[s.type]}`}>{s.type}</span>
                    <div className="min-w-0">
                      <p className="text-[12px] text-slate-600 leading-relaxed">{s.text}</p>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-blue-500 inline-flex items-center gap-0.5 mt-0.5"
                        >
                          {s.source || '原文'} <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function LeadsRadar() {
  const [industry, setIndustry] = useState<string>('全部')

  const industries = useMemo(() => {
    const counts = new Map<string, number>()
    data.leads.forEach((l) => counts.set(l.industry, (counts.get(l.industry) || 0) + 1))
    return ['全部', ...Array.from(counts.keys()).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0))]
  }, [])

  const filtered = useMemo(
    () => data.leads.filter((l) => industry === '全部' || l.industry === industry),
    [industry],
  )

  const hot = data.leads.filter((l) => l.score >= 75).length
  const withSignals = data.leads.filter((l) => l.signals.length > 0).length

  return (
    <div className="pb-8">
      <div className="pt-1 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Radar size={18} className="text-cyan-600" /> 潛在客戶雷達
          </h1>
          <span className="text-[11px] text-slate-400">{data.asOf} 更新</span>
        </div>
        <p className="text-[12px] text-slate-500">
          {data.leads.length} 家 · {hot} 家高優先 · {withSignals} 家有新聞訊號 · ★＝現有客群產業 · 每日自動更新
        </p>
      </div>

      {data.placeholder || data.leads.length === 0 ? (
        <div className="text-center text-slate-400 py-14 bg-white rounded-xl border border-slate-200 text-sm leading-relaxed">
          名單建立中——每日 04:00 自動生成與更新
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-4">
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setIndustry(ind)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  industry === ind ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {ind}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 mb-3">{filtered.length} / {data.leads.length} 家 · 依優先級排序</div>

          {filtered.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </>
      )}

      <div className="text-center text-slate-400 text-[11px] mt-4">
        來源：{data.source} · 名單由 AI 生成，接觸前請查證公司現況
      </div>
    </div>
  )
}
