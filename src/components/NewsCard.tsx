'use client'

import { useState } from 'react'
import { NewsItem } from '@/types/news'
import { ChevronDown, ChevronUp } from 'lucide-react'

const gradeConfig: Record<string, { border: string; badge: string; badgeText: string }> = {
  '🔴': { border: 'border-red-300 bg-red-50', badge: 'bg-red-100 border-red-300', badgeText: 'text-red-700' },
  '🟠': { border: 'border-orange-300 bg-orange-50', badge: 'bg-orange-100 border-orange-300', badgeText: 'text-orange-700' },
  '🟡': { border: 'border-amber-300 bg-amber-50', badge: 'bg-amber-100 border-amber-300', badgeText: 'text-amber-700' },
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

export default function NewsCard({ item }: { item: NewsItem }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = gradeConfig[item.grade]
  const isDetailed = item.grade === '🔴' || item.grade === '🟠'

  return (
    <div className={`border rounded-xl overflow-hidden shadow-sm mb-3 transition-all ${cfg.border}`}>
      <div
        className="px-4 py-3 cursor-pointer flex items-start justify-between gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.badge} ${cfg.badgeText}`}>
              {item.grade} {gradeLabel[item.grade]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[item.category] || 'bg-slate-100 text-slate-600'}`}>
              {item.category}
            </span>
          </div>
          <h3 className="text-slate-900 font-semibold text-sm leading-snug">{item.title}</h3>
          {!expanded && (
            <p className="text-slate-400 text-xs mt-1">來源：{item.sources.join('、')}</p>
          )}
        </div>
        <button className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-white/60 bg-white px-4 py-4 space-y-4">
          {item.background && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">背景脈絡</div>
              <p className="text-slate-600 text-sm leading-relaxed">{item.background}</p>
            </div>
          )}

          {item.what && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">發生了什麼</div>
              <p className="text-slate-800 text-sm leading-relaxed">{item.what}</p>
            </div>
          )}

          {item.meaning && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">真正的意義</div>
              <p className="text-slate-800 text-sm leading-relaxed">{item.meaning}</p>
            </div>
          )}

          {isDetailed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="text-xs font-bold text-blue-600 mb-1.5">🏢 業務視角</div>
                <p className="text-slate-700 text-xs leading-relaxed">{item.business || '—'}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="text-xs font-bold text-green-600 mb-1.5">📈 投資視角</div>
                <p className="text-slate-700 text-xs leading-relaxed">{item.investment || '—'}</p>
              </div>
            </div>
          )}

          {item.grade === '🟡' && (item.business !== '—' || item.investment !== '—') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {item.business && item.business !== '—' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-blue-600 mb-1.5">🏢 業務視角</div>
                  <p className="text-slate-700 text-xs leading-relaxed">{item.business}</p>
                </div>
              )}
              {item.investment && item.investment !== '—' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-green-600 mb-1.5">📈 投資視角</div>
                  <p className="text-slate-700 text-xs leading-relaxed">{item.investment}</p>
                </div>
              )}
            </div>
          )}

          {item.triggers && item.triggers.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-xs font-bold text-amber-700 mb-2">→ 觸發條件</div>
              <ul className="space-y-1">
                {item.triggers.map((t, i) => (
                  <li key={i} className="text-xs text-slate-700 flex gap-2">
                    <span className="text-amber-500 flex-shrink-0">•</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.watchpoints && item.watchpoints.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">觀察點</div>
              <ul className="space-y-1">
                {item.watchpoints.map((w, i) => (
                  <li key={i} className="text-xs text-slate-600 flex gap-2">
                    <span className="text-blue-400 flex-shrink-0">•</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-slate-400 text-xs border-t border-slate-100 pt-2">來源：{item.sources.join('、')}</p>
        </div>
      )}
    </div>
  )
}
