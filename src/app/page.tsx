'use client'

import { useState, useMemo } from 'react'
import { Search, Calendar, ChevronLeft, ChevronRight, Newspaper, BarChart2 } from 'lucide-react'
import briefingsData from '@/data/briefings.json'
import bubbleData from '@/data/bubble.json'
import { DailyBriefing, Grade, Category, NewsItem } from '@/types/news'
import { BubbleSnapshot } from '@/types/bubble'
import MarketSnapshot from '@/components/MarketSnapshot'
import NewsCard from '@/components/NewsCard'
import BubbleMonitor from '@/components/BubbleMonitor'

const briefings = briefingsData as DailyBriefing[]
const bubbles = bubbleData as BubbleSnapshot[]

const GRADES: { label: string; value: Grade | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '🔴 必看', value: '🔴' },
  { label: '🟠 追蹤', value: '🟠' },
  { label: '🟡 信號', value: '🟡' },
]

const CATEGORIES: (Category | 'all')[] = [
  'all', '宏觀政策', '地緣政治', '市場動態', 'AI科技',
  '台灣政策', '加密貨幣', '房地產', '客戶產業'
]

type Tab = 'news' | 'bubble'

export default function Home() {
  const [tab, setTab] = useState<Tab>('news')
  const [selectedDateIdx, setSelectedDateIdx] = useState(0)
  const [grade, setGrade] = useState<Grade | 'all'>('all')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [search, setSearch] = useState('')

  const current = briefings[selectedDateIdx]
  const latestBubble = bubbles[0]

  const filtered: NewsItem[] = useMemo(() => {
    return current.news.filter((item) => {
      if (grade !== 'all' && item.grade !== grade) return false
      if (category !== 'all' && item.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          item.title.toLowerCase().includes(q) ||
          item.what?.toLowerCase().includes(q) ||
          item.meaning?.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [current, grade, category, search])

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900">📊 每日情報中心</h1>
              <p className="text-xs text-slate-400">董事長 AI 情報助理</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div className="font-medium text-slate-600">{current.date}</div>
              <div>{current.weekday}</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 pb-0">
            <button
              onClick={() => setTab('news')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                tab === 'news'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Newspaper size={15} />
              每日簡報
            </button>
            <button
              onClick={() => setTab('bubble')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                tab === 'bubble'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart2 size={15} />
              泡沫監測
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {latestBubble.overallRisk}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">
        {tab === 'news' && (
          <>
            {/* Date Selector */}
            <div className="flex items-center gap-2 mb-4 bg-white rounded-xl border border-slate-200 shadow-sm p-2.5">
              <button
                onClick={() => setSelectedDateIdx(Math.min(briefings.length - 1, selectedDateIdx + 1))}
                disabled={selectedDateIdx >= briefings.length - 1}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 transition p-1"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 flex gap-2 overflow-x-auto">
                {briefings.map((b, idx) => (
                  <button
                    key={b.date}
                    onClick={() => setSelectedDateIdx(idx)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      idx === selectedDateIdx
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <Calendar size={12} />
                    {b.date.slice(5)} {b.weekday}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSelectedDateIdx(Math.max(0, selectedDateIdx - 1))}
                disabled={selectedDateIdx <= 0}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 transition p-1"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Market Snapshot */}
            <MarketSnapshot data={current.marketSnapshot} />

            {/* Core Judgment */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🧠</span>
                <span className="text-sm font-bold text-slate-700">今日核心判斷</span>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed">{current.coreJudgment}</p>
            </div>

            {/* Filters */}
            <div className="space-y-2.5 mb-4">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜尋關鍵字..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400 shadow-sm"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {GRADES.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGrade(g.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      grade === g.value
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      category === c
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {c === 'all' ? '所有分類' : c}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            <div className="text-slate-400 text-xs mb-3">
              顯示 {filtered.length} / {current.news.length} 則 · 來源 {current.sourceCount} 個
            </div>

            {/* News */}
            <div>
              {filtered.length === 0 ? (
                <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-200">
                  沒有符合條件的新聞
                </div>
              ) : (
                filtered.map((item) => <NewsCard key={item.id} item={item} />)
              )}
            </div>

            {/* Weekly Events */}
            {current.weeklyEvents.length > 0 && (
              <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h2 className="text-sm font-bold text-slate-700 mb-3">📅 本週關鍵觀察點</h2>
                <div className="space-y-3">
                  {current.weeklyEvents.map((ev, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-blue-600 font-semibold text-xs flex-shrink-0 w-20 pt-0.5">{ev.date}</span>
                      <div>
                        <div className="text-sm font-medium text-slate-800">{ev.event}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{ev.meaning}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'bubble' && (
          <BubbleMonitor data={latestBubble} />
        )}

        <div className="text-center text-slate-400 text-xs mt-8 pb-6">
          每日 07:00 自動更新 · AI 情報顧問生成
        </div>
      </div>
    </div>
  )
}
