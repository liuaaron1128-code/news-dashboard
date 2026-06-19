'use client'

import { useState } from 'react'
import { Briefcase, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import businessData from '@/data/business.json'
import { BusinessDigest as BusinessDigestType, BusinessItem, BusinessKind } from '@/types/business'

const data = businessData as BusinessDigestType

const KIND_STYLE: Record<BusinessKind, { border: string; badge: string }> = {
  創業動態: { border: 'border-l-cyan-500', badge: 'bg-cyan-100 text-cyan-700' },
  創業故事: { border: 'border-l-amber-400', badge: 'bg-amber-100 text-amber-700' },
  商業模式: { border: 'border-l-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
  產業動態: { border: 'border-l-teal-500', badge: 'bg-teal-100 text-teal-700' },
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{children}</div>
}

function BusinessCard({ item }: { item: BusinessItem }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = KIND_STYLE[item.kind] || KIND_STYLE['創業動態']
  const hasDetail = !!(item.summary || item.impact || item.action)

  return (
    <div className={`bg-white rounded-xl overflow-hidden shadow-sm mb-3 border border-slate-200 border-l-4 ${cfg.border}`}>
      <div className="px-4 pt-3.5 pb-3 cursor-pointer" onClick={() => hasDetail && setExpanded(!expanded)}>
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{item.kind}</span>
          {item.source && <span className="text-[11px] text-slate-400">{item.source}</span>}
        </div>

        <h3 className="text-slate-900 font-bold text-[15px] leading-snug mb-2">{item.title}</h3>

        {!expanded && item.summary && (
          <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">{item.summary}</p>
        )}

        <div className="flex items-center justify-between mt-2.5">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-blue-500 flex items-center gap-1"
            >
              原文 <ExternalLink size={11} />
            </a>
          ) : (
            <span />
          )}
          {hasDetail && (
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${expanded ? 'text-slate-400' : 'text-blue-500'}`}>
              {expanded ? (<><ChevronUp size={13} /> 收合</>) : (<>展開分析 <ChevronDown size={13} /></>)}
            </span>
          )}
        </div>
      </div>

      {expanded && hasDetail && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/50">
          {item.summary && (
            <div>
              <SectionLabel>摘要</SectionLabel>
              <p className="text-slate-800 text-sm leading-relaxed font-medium">{item.summary}</p>
            </div>
          )}
          {item.impact && (
            <div>
              <SectionLabel>影響</SectionLabel>
              <p className="text-slate-800 text-sm leading-relaxed">{item.impact}</p>
            </div>
          )}
          {item.action && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5">
              <div className="text-xs font-bold text-emerald-600 mb-1.5">📌 行動建議</div>
              <p className="text-slate-700 text-sm leading-relaxed">{item.action}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BusinessDigest() {
  const items = data.items || []

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase size={16} className="text-slate-700" />
        <h2 className="text-base font-bold text-slate-900">商業・創業</h2>
        <span className="text-[10px] text-slate-400 ml-auto">{data.asOf} · {data.source}</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center text-slate-400 py-10 bg-white rounded-xl border border-slate-200 text-sm">
          商業/創業內容於每日由 Hacker News + GitHub Models 自動更新。
        </div>
      ) : (
        items.map((item) => <BusinessCard key={item.id} item={item} />)
      )}

      {data.placeholder && items.length > 0 && (
        <div className="text-[10px] text-slate-400 mt-1">部分內容尚待每日自動補齊（摘要/影響/行動建議）。</div>
      )}
    </div>
  )
}
