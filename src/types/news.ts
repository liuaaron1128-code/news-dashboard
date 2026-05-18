export type Grade = '🔴' | '🟠' | '🟡'

export type Category =
  | '宏觀政策'
  | '地緣政治'
  | '市場動態'
  | 'AI科技'
  | '台灣政策'
  | '加密貨幣'
  | '房地產'
  | '客戶產業'

export interface MarketSnapshot {
  label: string
  value: string
  change: string
  positive: boolean | null
}

export interface NewsItem {
  id: string
  grade: Grade
  category: Category
  title: string
  background?: string
  what: string
  meaning: string
  business: string
  investment: string
  triggers?: string[]
  watchpoints?: string[]
  sources: string[]
}

export interface DailyBriefing {
  date: string
  weekday: string
  coreJudgment: string
  marketSnapshot: MarketSnapshot[]
  news: NewsItem[]
  weeklyEvents: { date: string; event: string; meaning: string }[]
  sourceCount: number
}
