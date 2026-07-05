'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { Deck } from '@/types/deck'
import SlideView from './SlideView'

// Interactive web-slide viewer: a 16:9 stage, keyboard/nav paging, and a dot
// navigator. Same component drives both the sample deck page and live previews.

export default function DeckViewer({ deck }: { deck: Deck }) {
  const [i, setI] = useState(0)
  const count = deck.slides.length

  const go = useCallback(
    (n: number) => setI(Math.max(0, Math.min(count - 1, n))),
    [count],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(i + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, go])

  if (count === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-12 text-center text-slate-400">
        這份簡報還沒有任何頁面
      </div>
    )
  }

  const slide = deck.slides[i]

  return (
    <div>
      {/* Stage */}
      <div className="relative w-full aspect-[16/9] bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
        <div className="absolute inset-0 p-6 sm:p-10 md:p-14">
          <SlideView slide={slide} index={i} />
        </div>
        <div className="absolute bottom-3 right-4 text-[10px] text-slate-300 font-medium">
          {deck.meta.title}
        </div>
      </div>

      {/* Nav */}
      <div className="mt-3.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="投影片導覽">
          {deck.slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={idx === i}
              aria-label={`第 ${idx + 1} 頁`}
              onClick={() => go(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-transform ${
                idx === i ? 'bg-blue-600 scale-125' : 'bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(i - 1)}
            disabled={i === 0}
            className="flex items-center gap-1 text-sm font-semibold px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-700 shadow-sm"
          >
            <ChevronLeft size={15} /> 上一頁
          </button>
          <span className="text-xs font-bold text-slate-400 tabular-nums min-w-[46px] text-center">
            {i + 1} / {count}
          </span>
          <button
            type="button"
            onClick={() => go(i + 1)}
            disabled={i === count - 1}
            className="flex items-center gap-1 text-sm font-semibold px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-700 shadow-sm"
          >
            下一頁 <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Print button (PDF export via the browser print dialog) */}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600"
        >
          <Download size={13} /> 列印 / 匯出 PDF
        </button>
      </div>
    </div>
  )
}
