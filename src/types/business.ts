// Business & entrepreneurship content shown inside the daily briefing tab.
// Every item — whether a real Hacker News story, a founder story, a business
// model breakdown, or an industry read — uses the SAME structure as a news
// item: 標題 / 摘要 / 影響 / 行動建議. The `kind` only tags where it came from;
// it never changes the shape.

export type BusinessKind = '創業動態' | '創業故事' | '商業模式' | '產業動態'

export interface BusinessItem {
  id: string
  kind: BusinessKind
  title: string // 標題
  summary: string // 摘要（發生了什麼）
  impact: string // 影響（為什麼重要）
  action: string // 行動建議
  url?: string // 原文連結（真實動態才有）
  source?: string // 來源
}

export interface BusinessDigest {
  asOf: string
  source: string
  items: BusinessItem[]
  placeholder?: boolean
}

export interface BusinessConfig {
  industries: string[]
  note?: string
}
