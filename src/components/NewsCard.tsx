'use client'

import { useState } from 'react'
import { NewsItem } from '@/types/news'
import { ChevronDown, ChevronUp } from 'lucide-react'

const gradeConfig: Record<string, { leftBorder: string; badge: string; badgeText: string }> = {
  '🔴': { leftBorder: 'border-l-red-500', badge: 'bg-red-100 text-red-700', badgeText: '' },
  '🟠': { leftBorder: 'border-l-orange-400', badge: 'bg-orange-100 text-orange-700', badgeText: '' },
  '🟡': { leftBorder: 'border-l-amber-400', badge: 'bg-amber-100 text-amber-700', badgeText: '' },
}

const gradeLabel: Record<string, string> = {
  '🔴': '今日必看',
  '🟠': '重要追蹤',
  '🟡': '早期信號',
}

const categoryColors: Record<string, string> = {
  '宏觀政策': 'bg-blue-100 text-blue-700',
  '地緣政治': 'bg-purple-100 text-purple-700',
  '市場動態': 'bg-green-100 text-green-700',
  'AI科技': 'bg-cyan-100 text-cyan-700',
  '台灣政策': 'bg-teal-100 text-teal-700',
  '加密貨幣': 'bg-orange-100 text-orange-700',
  '房地產': 'bg-pink-100 text-pink-700',
  '客戶產業': 'bg-indigo-100 text-indigo-700',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{children}</div>
}

export default function NewsCard({ item }: { item: NewsItem }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = gradeConfig[item.grade]
  const showPerspectives = item.grade === '🔴' || item.grade === '🟠' ||
    (item.grade === '🟡' && ((item.business && item.business !== '—') || (item.investment && item.investment !== '—')))

  return (
    <div className={`bg-white rounded-xl overflow-hidden shadow-sm mb-3 border border-slate-200 border-l-4 ${cfg.leftBorder}`}>
      {/* Card Header — always visible */}
      <div className="px-4 pt-3.5 pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {item.grade} {gradeLabel[item.grade]}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${categoryColors[item.category] || 'bg-slate-100 text-slate-600'}`}>
                {item.category}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-slate-900 font-bold text-[15px] leading-snug mb-2">{item.title}</h3>

            {/* Preview of "what" when collapsed */}
            {!expanded && item.what && (
              <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">{item.what}</p>
            )}

            {/* Footer row */}
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[11px] text-slate-400 truncate max-w-[60%]">
                {item.sources.slice(0, 2).join('、')}{item.sources.length > 2 ? ' 等' : ''}
              </span>
              <span className={`text-xs font-semibold flex items-center gap-0.5 ${expanded ? 'text-slate-400' : 'text-blue-500'}`}>
                {expanded ? (<><ChevronUp size={13} /> 收合</>) : (<>展開分析 <ChevronDown size={13} /></>)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/50">
          {item.background && (
            <div>
              <SectionLabel>背景脈絡</SectionLabel>
              <p className="text-slate-600 text-sm leading-relaxed">{item.background}</p>
            </div>
          )}

          {item.what && (
            <div>
              <SectionLabel>發生了什麼</SectionLabel>
              <p className="text-slate-800 text-sm leading-relaxed font-medium">{item.what}</p>
            </div>
          )}

          {item.meaning && (
            <div>
              <SectionLabel>真正的意義</SectionLabel>
              <p className="text-slate-800 text-sm leading-relaxed">{item.meaning}</p>
            </div>
          )}

          {showPerspectives && (
            <div className="grid grid-cols-1 gap-2.5">
              {item.business && item.business !== '—' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
                  <div className="text-xs font-bold text-blue-600 mb-1.5">🏢 業務視角</div>
                  <p className="text-slate-700 text-sm leading-relaxed">{item.business}</p>
                </div>
              )}
              {item.investment && item.investment !== '—' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5">
                  <div className="text-xs font-bold text-emerald-600 mb-1.5">📈 投資視角</div>
                  <p className="text-slate-700 text-sm leading-relaxed">{item.investment}</p>
                </div>
              )}
            </div>
          )}

          {item.triggers && item.triggers.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5">
              <div className="text-xs font-bold text-amber-700 mb-2">⚡ 觸發條件</div>
              <ul className="space-y-1.5">
                {item.triggers.map((t, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">→</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.watchpoints && item.watchpoints.length > 0 && (
            <div>
              <SectionLabel>持續觀察</SectionLabel>
              <ul className="space-y-1.5">
                {item.watchpoints.map((w, i) => (
                  <li key={i} className="text-sm text-slate-600 flex gap-2">
                    <span className="text-blue-400 flex-shrink-0 mt-0.5">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">來源：{item.sources.join('、')}</p>
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-slate-400 flex items-center gap-0.5"
            >
              <ChevronUp size={13} /> 收合
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
