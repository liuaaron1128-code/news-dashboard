// AI-adoption prospect radar: a concrete, sales-ready list of Taiwanese
// companies for the AI consulting business. Two tracks merged into one list:
//   seed  — knowledge-curated concrete companies (上市櫃/知名企業/醫院集團)
//   news  — companies surfaced by daily media signals (accumulated over time)
// Built by scripts/fetch-leads.mjs.

export type SignalType = '轉型意圖' | '擴張' | '痛點' | '政府補助/標案'

export interface LeadSignal {
  date: string
  type: SignalType
  text: string
  source?: string
  url?: string
}

export interface LeadProduct {
  name: string // e.g. "M365 Copilot"
  use: string // 用在該公司的哪個場景
}

export interface Lead {
  id: string
  company: string
  industry: string
  isCoreIndustry: boolean // 金融/醫療/製造 — existing client verticals
  brief: string // 公司一句話簡介（做什麼、規模量級）
  whyNow: string // 推薦原因：為什麼這家現在可能需要 AI
  products: LeadProduct[] // 可能對應的 Microsoft 產品與場景
  approach: string[] // 推薦進行方式：對口、首次接觸、Demo/POC 步驟
  website?: string // 官網（AI 判讀，接觸前請驗證）
  origin: 'seed' | 'news'
  score: number // 0-100
  scoreReason: string
  signals: LeadSignal[] // 新聞訊號（可為空）
  firstSeen: string
  lastSeen: string
}

export interface LeadsData {
  version?: number
  asOf: string
  source: string
  leads: Lead[]
  placeholder?: boolean
}
