'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, Loader2, FileText, ArrowLeft } from 'lucide-react'
import DeckViewer from '@/components/deck/DeckViewer'
import { Deck, ThemeName } from '@/types/deck'

// Input UI: paste raw material -> AI orchestration (POST /api/generate) -> live
// preview with the same DeckViewer used for saved decks.

const THEMES: { value: ThemeName; label: string }[] = [
  { value: 'medus', label: '杏碩 Medus' },
  { value: 'executive', label: '主管簡報' },
  { value: 'minimal', label: '極簡' },
]

const SAMPLE_INPUT = `2026 上半年，公司高階產品需求持續走強，帶動整體毛利率上升到 38%。
季營收達 48.2 億美元，年增 12%。
主要對手在中階市場發動價格戰，短期壓縮我方訂單能見度。
新台幣升值對出口報價形成逆風。
下半年三大優先事項：高階擴產、深化通路、維持現金紀律。
全年營收成長目標設定為 15%。`

export default function GeneratePage() {
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [theme, setTheme] = useState<ThemeName>('medus')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deck, setDeck] = useState<Deck | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [generationId, setGenerationId] = useState(0)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, title: title || undefined, theme }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失敗')
      setDeck(data.deck)
      setProvider(data.provider)
      setGenerationId((n) => n + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const providerLabel: Record<string, string> = {
    anthropic: 'Claude 生成',
    'github-models': 'GitHub Models 生成',
    local: '離線範本生成（未設定 API 金鑰）',
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-slate-400 hover:text-slate-600">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-slate-900">📊 AI 簡報生成器</h1>
              <p className="text-[11px] text-slate-400">貼上資料，依既有風格自動編排</p>
            </div>
          </div>
          <Link href="/deck/medus" className="text-xs font-semibold text-blue-600 hover:underline">
            看杏碩範例 →
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Input card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-slate-500" />
            <span className="text-sm font-bold text-slate-800">原始資料</span>
            <button
              type="button"
              onClick={() => setText(SAMPLE_INPUT)}
              className="ml-auto text-xs text-blue-500 font-medium hover:underline"
            >
              填入範例文字
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="貼上會議記錄、報告、數據摘要或任何主題的資料，AI 會自動分頁、選版面、寫標題與重點…"
            rows={8}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-300 resize-y leading-relaxed"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="簡報標題（可留空，讓 AI 決定）"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-300"
            />
            <div className="flex gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTheme(t.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    theme === t.value
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={loading || text.trim().length < 10}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold text-sm py-3 rounded-xl shadow-sm hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? '正在編排…' : '生成簡報'}
          </button>
          {error && <div className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">{error}</div>}
        </div>

        {/* Preview */}
        {deck && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">預覽</span>
              {provider && (
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                  {providerLabel[provider] || provider} · {deck.slides.length} 頁
                </span>
              )}
            </div>
            <DeckViewer key={generationId} deck={deck} />
          </div>
        )}
      </div>
    </div>
  )
}
