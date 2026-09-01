// The day's read, shown at the top of the news tab.
// Written by the daily Claude routine; see docs/daily-email-briefing-routine.md.

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
