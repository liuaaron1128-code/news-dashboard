// Business & entrepreneurship content shown inside the daily briefing tab.
// Produced by scripts/fetch-business.mjs: real startup/tech items from Hacker
// News, plus AI-curated founder stories, business-model breakdowns and
// industry reads (GitHub Models — free, built-in token).

export interface BusinessStory {
  id: string
  title: string // original (usually English)
  titleZh?: string // Chinese title, if summarized
  takeaway?: string // one-line business takeaway in Chinese
  url: string
  points?: number
  kind?: 'launch' | 'show' | 'funding' | 'top'
}

export interface FounderStory {
  title: string
  body: string
  takeaways: string[]
}

export interface CaseStudy {
  company: string
  title: string
  body: string
  points: string[]
}

export interface IndustryInsight {
  industry: string
  text: string
}

export interface BusinessDigest {
  asOf: string
  source: string
  stories: BusinessStory[]
  founderStory?: FounderStory | null
  caseStudy?: CaseStudy | null
  industryInsights: IndustryInsight[]
  placeholder?: boolean
}

export interface BusinessConfig {
  industries: string[]
  note?: string
}
