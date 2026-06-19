// Additional data sources beyond the core market-signals feed.

// Taiwan institutional flows (三大法人) from the TWSE OpenAPI.
export interface TaiwanFlowItem {
  id: string
  label: string // e.g. 外資、投信、自營商
  netBuy: number | null // 億元 (positive = net buy)
}
export interface TaiwanFlows {
  asOf: string
  source: string
  date: string | null // trading date of the figures
  items: TaiwanFlowItem[]
  placeholder?: boolean
}

// Market sentiment (CNN Fear & Greed, best-effort).
export interface Sentiment {
  asOf: string
  source: string
  score: number | null // 0–100
  rating: string | null // e.g. "Fear", "Greed"
  previousClose: number | null
  weekAgo: number | null
  placeholder?: boolean
}

// Manually-curated macro calendar (FOMC / CPI / 法說 …).
export interface MacroEvent {
  date: string // YYYY-MM-DD
  title: string
  region: '美國' | '台灣' | '全球' | '歐元區' | '中國' | '日本'
  importance: 'high' | 'medium' | 'low'
  note?: string
}
