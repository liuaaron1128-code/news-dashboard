'use client'

import { useState, useMemo } from 'react'
import { Search, Calendar, ChevronLeft, ChevronRight, Newspaper, BarChart2, SlidersHorizontal, X } from 'lucide-react'
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

const CATEGORIES: { label: string; value: Category | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '🌐 宏觀政策', value: '宏觀政策' },
  { label: '🗺 地緣政治', value: '地緣政治' },
  { label: '📊 市場動態', value: '市場動態' },
  { label: '🤖 AI科技', value: 'AI科技' },
  { label: '🇹🇼 台灣政策', value: '台灣政策' },
  { label: '₿ 加密貨幣', value: '加密貨幣' },
  { label: '🏠 房地產', value: '房地產' },
  { label: '🏭 客戶產業', value: '客戶產業' },
]

type Tab = 'news' | 'bubble'

export default function Home() {
  const [tab, setTab] = useState<Tab>('news')
  const [selectedDateIdx, setSelectedDateIdx] = useState(0)
  const [grade, setGrade] = useState<Grade | 'all'>('all')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

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

  const isFiltered = grade !== 'all' || category !== 'all' || search !== ''

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <h1 className="text-base font-bold text-slate-900">📊 每日情報中心</h1>
              <p className="text-[11px] text-slate-400">董事長 AI 情報助理</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-700">{current.date}</div>
              <div className="text-[11px] text-slate-400">{current.weekday}</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1">
            <button
              onClick={() => setTab('news')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                tab === 'news'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500'
              }`}
            >
              <Newspaper size={14} />
              每日簡報
            </button>
            <button
              onClick={() => setTab('bubble')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                tab === 'bubble'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500'
              }`}
            >
              <BarChart2 size={14} />
              泡沫監測
              <span className="bg-orange-100 text-orange-700 text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                {latestBubble.overallRisk}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {tab === 'news' && (
          <>
            {/* Date Selector */}
            <div className="flex items-center gap-2 mb-4 bg-white rounded-xl border border-slate-200 shadow-sm p-2">
              <button
                onClick={() => setSelectedDateIdx(Math.min(briefings.length - 1, selectedDateIdx + 1))}
                disabled={selectedDateIdx >= briefings.length - 1}
                className="text-slate-400 disabled:opacity-30 p-1.5 flex-shrink-0"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
                {briefings.map((b, idx) => (
                  <button
                    key={b.date}
                    onClick={() => setSelectedDateIdx(idx)}
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      idx === selectedDateIdx
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <Calendar size={11} />
                    {b.date.slice(5)} {b.weekday}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSelectedDateIdx(Math.max(0, selectedDateIdx - 1))}
                disabled={selectedDateIdx <= 0}
                className="text-slate-400 disabled:opacity-30 p-1.5 flex-shrink-0"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Market Snapshot */}
            <MarketSnapshot data={current.marketSnapshot} />

            {/* Core Judgment */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-base">🧠</span>
                <span className="text-sm font-bold text-slate-800">今日核心判斷</span>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed">{current.coreJudgment}</p>
            </div>

            {/* Filters */}
            <div className="mb-4 space-y-2">
              {/* Search row */}
              <div className="flex items-center gap-2">
                {showSearch ? (
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="搜尋標題、內容..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-white border border-blue-300 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none shadow-sm"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {GRADES.map((g) => (
                      <button
                        key={g.value}
                        onClick={() => setGrade(g.value)}
                        className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                          grade === g.value
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setShowSearch(!showSearch); setSearch('') }}
                  className={`flex-shrink-0 p-2.5 rounded-xl border transition ${showSearch ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                  <Search size={15} />
                </button>
              </div>

              {/* Category filter - horizontal scroll */}
              {!showSearch && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        category === c.value
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Count + clear filters */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-slate-400">
                {filtered.length} / {current.news.length} 則 · {current.sourceCount} 個來源
              </div>
              {isFiltered && (
                <button
                  onClick={() => { setGrade('all'); setCategory('all'); setSearch('') }}
                  className="text-xs text-blue-500 font-medium flex items-center gap-1"
                >
                  <X size={11} /> 清除篩選
                </button>
              )}
            </div>

            {/* News List */}
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
              <div className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h2 className="text-sm font-bold text-slate-800 mb-3">📅 本週關鍵觀察點</h2>
                <div className="space-y-3">
                  {current.weeklyEvents.map((ev, i) => (
                    <div key={i} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                      <span className="text-blue-600 font-bold text-xs flex-shrink-0 w-16 pt-0.5">{ev.date}</span>
                      <div>
                        <div className="text-sm font-semibold text-slate-800 leading-snug">{ev.event}</div>
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed">{ev.meaning}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'bubble' && (
          <BubbleMonitor data={latestBubble} history={bubbles} />
        )}

        <div className="text-center text-slate-400 text-[11px] mt-8 pb-6">
          每日 07:00 自動更新 · AI 情報顧問生成
        </div>
      </div>
    </div>
  )
}
