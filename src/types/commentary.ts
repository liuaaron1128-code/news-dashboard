// AI-generated daily commentary, produced by scripts/generate-commentary.mjs
// (Claude API) from that day's news + bubble + market-signal data.

export interface DailyCommentary {
  date: string
  generatedAt?: string
  model?: string
  headline: string // one-line summary
  topConcern: string // the single thing to watch today
  bullets: string[] // 3–4 plain-language reads
  crossSignals: string[] // divergences / confirmations across datasets
  confidence: 'high' | 'medium' | 'low'
  placeholder?: boolean // true until first real generation
}
