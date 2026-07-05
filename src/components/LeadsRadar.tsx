'use client'

import { useMemo, useState } from 'react'
import { Radar, ChevronDown, ChevronUp, ExternalLink, Flame } from 'lucide-react'
import leadsData from '@/data/leads.json'
import { LeadsData, Lead, SignalType } from '@/types/leads'

const data = leadsData as LeadsData

const SIGNAL_STYLE: Record<SignalType, string> = {
  轉型意圖: 'bg-emerald-100 text-emerald-700',
  擴張: 'bg-blue-100 text-blue-700',
  痛點: 'bg-red-100 text-red-700',
  '政府補助/標案': 'bg-purple-100 text-purple-700',
}

const SIGNAL_TYPES: (SignalType | '全部')[] = ['全部', '轉型意圖', '擴張', '痛點', '政府補助/標案']

function scoreTier(score: number) {
  if (score >= 70) return { label: '高優先', cls: 'bg-red-100 text-red-700', bar: '#dc2626' }
  if (score >= 45) return { label: '中優先', cls: 'bg-amber-100 text-amber-700', bar: '#d97706' }
  return { label: '觀察中', cls: 'bg-slate-100 text-slate-500', bar: '#94a3b8' }
}

function LeadCard({ lead }: { lead: Lead }) {
  const [expanded, setExpanded] = useState(false)
  const tier = scoreTier(lead.score)
  const latest = lead.signals[0]

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-3 border border-slate-200">
      <div className="px-4 pt-3.5 pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tier.cls}`}>
                {lead.score >= 70 && <Flame size={10} className="inline -mt-0.5 mr-0.5" />}
                {lead.score} · {tier.label}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${lead.isCoreIndustry ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                {lead.industry}{lead.isCoreIndustry ? ' ★' : ''}
              </span>
            </div>
            <h3 className="text-slate-900 font-bold text-[15px] leading-snug">{lead.company}</h3>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-slate-400">最新訊號</div>
            <div className="text-[11px] font-semibold text-slate-600">{lead.lastSeen.slice(5)}</div>
          </div>
        </div>

        {latest && (
          <div className="mt-2 flex items-start gap-1.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${SIGNAL_STYLE[latest.type]}`}>{latest.type}</span>
            <p className={`text-slate-600 text-[12.5px] leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>{latest.text}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-slate-400">{lead.signals.length} 個訊號 · 首見 {lead.firstSeen.slice(5)}</span>
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${expanded ? 'text-slate-400' : 'text-blue-500'}`}>
            {expanded ? (<><ChevronUp size={13} /> 收合</>) : (<>切入建議 <ChevronDown size={13} /></>)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/50">
          {lead.pitch && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5">
              <div className="text-xs font-bold text-emerald-600 mb-1.5">🎯 切入建議</div>
              <p className="text-slate-700 text-sm leading-relaxed">{lead.pitch}</p>
            </div>
          )}
          {lead.scoreReason && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">評分理由</div>
              <p className="text-slate-600 text-[12.5px] leading-relaxed">{lead.scoreReason}</p>
            </div>
          )}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">訊號紀錄</div>
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
        </div>
      )}
    </div>
  )
}

export default function LeadsRadar() {
  const [industry, setIndustry] = useState<string>('全部')
  const [signalType, setSignalType] = useState<SignalType | '全部'>('全部')

  const industries = useMemo(() => {
    const set = new Set<string>(data.leads.map((l) => l.industry))
    return ['全部', ...Array.from(set)]
  }, [])

  const filtered = useMemo(() => {
    return data.leads.filter((l) => {
      if (industry !== '全部' && l.industry !== industry) return false
      if (signalType !== '全部' && !l.signals.some((s) => s.type === signalType)) return false
      return true
    })
  }, [industry, signalType])

  const hot = data.leads.filter((l) => l.score >= 70).length

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
          每日自動掃描台灣商業新聞中的 AI 導入訊號 · {data.leads.length} 家累積 · {hot} 家高優先 · ★＝現有客群產業
        </p>
      </div>

      {data.placeholder ? (
        <div className="text-center text-slate-400 py-14 bg-white rounded-xl border border-slate-200 text-sm leading-relaxed">
          名單建立中——每日 04:00 自動掃描
          <br />
          （轉型意圖 / 擴張 / 痛點 / 政府補助標案 四類訊號）
        </div>
      ) : (
        <>
          {/* Industry filter */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-2">
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
          {/* Signal type filter */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mb-4">
            {SIGNAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setSignalType(t)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  signalType === t ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 mb-3">{filtered.length} / {data.leads.length} 家 · 依優先級排序</div>

          {filtered.length === 0 ? (
            <div className="text-center text-slate-400 py-12 bg-white rounded-xl border border-slate-200 text-sm">
              沒有符合條件的企業
            </div>
          ) : (
            filtered.map((lead) => <LeadCard key={lead.id} lead={lead} />)
          )}
        </>
      )}

      <div className="text-center text-slate-400 text-[11px] mt-4">
        來源：{data.source} · 訊號與評分為 AI 自動判讀，接觸前請先查證
      </div>
    </div>
  )
}
