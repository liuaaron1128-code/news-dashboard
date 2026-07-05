// AI-adoption prospect radar: companies showing signals that they may need AI
// consulting. Accumulated daily by scripts/fetch-leads.mjs (dedup by company,
// signals appended over time, rescored on update).

export type SignalType = '轉型意圖' | '擴張' | '痛點' | '政府補助/標案'

export interface LeadSignal {
  date: string // YYYY-MM-DD (day the signal was captured)
  type: SignalType
  text: string // one sentence: what happened & why it implies AI opportunity
  source?: string
  url?: string
}

export interface Lead {
  id: string
  company: string
  industry: string // 金融 / 醫療 / 製造 / 零售電商 / 物流 / 政府公部門 / ...
  isCoreIndustry: boolean // 金融/醫療/製造 — existing client verticals
  score: number // 0-100 priority
  scoreReason: string
  pitch: string // how to approach: Azure OpenAI / Copilot / Power Platform angle
  signals: LeadSignal[] // newest first
  firstSeen: string
  lastSeen: string
}

export interface LeadsData {
  asOf: string
  source: string
  leads: Lead[]
  placeholder?: boolean
}
