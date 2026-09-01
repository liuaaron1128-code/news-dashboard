'use client'

import { useSyncExternalStore } from 'react'
import { Sparkles, AlertTriangle, CalendarClock, Clock } from 'lucide-react'
import commentaryData from '@/data/commentary.json'
import eventsData from '@/data/events.json'
import { DailyCommentary } from '@/types/commentary'
import { MacroEvent } from '@/types/extras'

const commentary = commentaryData as DailyCommentary
const events = eventsData as MacroEvent[]

const CONFIDENCE: Record<string, { label: string; cls: string }> = {
  high: { label: '信心高', cls: 'bg-emerald-100 text-emerald-700' },
  medium: { label: '信心中', cls: 'bg-amber-100 text-amber-700' },
  low: { label: '信心低', cls: 'bg-slate-100 text-slate-500' },
}

const IMPORTANCE: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-500',
}

// How many days before a commentary is treated as stale rather than today's read.
const STALE_AFTER_DAYS = 2

const daysApart = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

// The reader's calendar date is external state, so it is read through
// useSyncExternalStore: the server snapshot is null and the page prerenders
// without it, then the client fills it in on hydration. The date only matters
// for staleness and filtering, so the store never needs to notify of changes.
const subscribeToDate = () => () => {}
const getServerDate = () => null
const getLocalDate = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The day's read. Sits at the top of the news tab, on its own. */
export default function MorningCard() {
  const conf = CONFIDENCE[commentary.confidence] || CONFIDENCE.low
  const today = useSyncExternalStore(subscribeToDate, getLocalDate, getServerDate)

  const staleDays = today ? daysApart(commentary.date, today) : 0
  const isStale = staleDays > STALE_AFTER_DAYS

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={15} className="text-indigo-500" />
          <span className="text-sm font-bold text-slate-800">AI 每日解讀</span>
          <span className="text-[11px] text-slate-400 font-medium">{commentary.date}</span>
        </div>
        {!isStale && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${conf.cls}`}>{conf.label}</span>
        )}
      </div>

      {isStale && (
        <div className="flex items-start gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-2 mb-3">
          <Clock size={13} className="text-slate-500 mt-0.5 flex-shrink-0" />
          <span className="text-[12px] text-slate-600 leading-relaxed">
            這則解讀是 <span className="font-bold">{staleDays} 天前</span>（{commentary.date}）產生的，
            並非今日觀點，請以下方各日新聞為準。
          </span>
        </div>
      )}

      <p className="text-[15px] font-bold text-slate-900 leading-snug mb-2.5">{commentary.headline}</p>

      {commentary.topConcern && (
        <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mb-3">
          <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <span className="text-[12px] text-amber-800 leading-relaxed">{commentary.topConcern}</span>
        </div>
      )}

      {commentary.bullets.length > 0 && (
        <ul className="space-y-2">
          {commentary.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] text-slate-700 leading-relaxed">
              <span className="text-indigo-400 flex-shrink-0">▍</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {commentary.crossSignals.length > 0 && (
        <div className="mt-3 pt-3 border-t border-indigo-100 space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">跨資料訊號</div>
          {commentary.crossSignals.map((c, i) => (
            <div key={i} className="text-[12px] text-slate-600 leading-relaxed">• {c}</div>
          ))}
        </div>
      )}

      {commentary.placeholder && (
        <div className="text-[10px] text-slate-400 mt-2">尚未生成即時解讀。</div>
      )}
    </div>
  )
}

/**
 * Upcoming macro events. Rendered near the foot of the news tab so the page
 * carries one calendar rather than one above the news and one below it.
 */
export function MacroCalendar() {
  const today = useSyncExternalStore(subscribeToDate, getLocalDate, getServerDate)

  // Past events are not a forward calendar; drop them once the date is known.
  const sorted = [...events].sort((a, b) => (a.date < b.date ? -1 : 1))
  const upcoming = (today ? sorted.filter((e) => e.date >= today) : sorted).slice(0, 5)

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <CalendarClock size={14} className="text-slate-500" />
        <span className="text-sm font-bold text-slate-800">總經行事曆</span>
      </div>
      {upcoming.length === 0 ? (
        <div className="text-[12px] text-slate-400">目前沒有排定的未來事件。</div>
      ) : (
      <div className="space-y-3">
        {upcoming.map((ev, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-[11px] font-bold text-slate-500 w-11 flex-shrink-0 pt-0.5">{ev.date.slice(5)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12.5px] font-semibold text-slate-800 leading-snug">{ev.title}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${IMPORTANCE[ev.importance]}`}>{ev.region}</span>
              </div>
              {ev.note && <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{ev.note}</div>}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}
