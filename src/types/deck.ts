// Deck Spec — the single source of truth for a generated presentation.
// AI produces this JSON; the web renderer (and future PDF/PPTX exporters) consume it.
// See docs/presentation-generator-design.md.

export type ThemeName = 'executive' | 'briefing' | 'minimal'

export type SlideLayout =
  | 'cover'
  | 'agenda'
  | 'section'
  | 'bullets'
  | 'two-column'
  | 'kpi-grid'
  | 'chart'
  | 'quote'
  | 'timeline'
  | 'closing'

export interface DeckMeta {
  title: string
  subtitle?: string
  author?: string
  date?: string
  theme: ThemeName
  templateId: string
}

interface BaseSlide {
  id: string
  layout: SlideLayout
  notes?: string
}

export interface CoverSlide extends BaseSlide {
  layout: 'cover'
  eyebrow?: string
  title: string
  subtitle?: string
}

export interface AgendaSlide extends BaseSlide {
  layout: 'agenda'
  title: string
  items: string[]
}

export interface SectionSlide extends BaseSlide {
  layout: 'section'
  index?: string
  title: string
  subtitle?: string
}

export interface BulletPoint {
  text: string
  emphasis?: boolean
  sub?: string[]
}

export interface BulletsSlide extends BaseSlide {
  layout: 'bullets'
  title: string
  points: BulletPoint[]
  takeaway?: string
}

export interface TwoColumnSlide extends BaseSlide {
  layout: 'two-column'
  title: string
  left: { heading: string; points: string[] }
  right: { heading: string; points: string[] }
}

export interface Kpi {
  label: string
  value: string
  delta?: string
  positive?: boolean | null
}

export interface KpiGridSlide extends BaseSlide {
  layout: 'kpi-grid'
  title: string
  kpis: Kpi[]
}

export interface ChartSlide extends BaseSlide {
  layout: 'chart'
  title: string
  chart: {
    type: 'bar' | 'line' | 'pie'
    categories: string[]
    series: { name: string; data: number[] }[]
  }
  caption?: string
}

export interface QuoteSlide extends BaseSlide {
  layout: 'quote'
  quote: string
  attribution?: string
}

export interface TimelineSlide extends BaseSlide {
  layout: 'timeline'
  title: string
  events: { date: string; title: string; detail?: string }[]
}

export interface ClosingSlide extends BaseSlide {
  layout: 'closing'
  title: string
  subtitle?: string
  contact?: string
}

export type Slide =
  | CoverSlide
  | AgendaSlide
  | SectionSlide
  | BulletsSlide
  | TwoColumnSlide
  | KpiGridSlide
  | ChartSlide
  | QuoteSlide
  | TimelineSlide
  | ClosingSlide

export interface Deck {
  meta: DeckMeta
  slides: Slide[]
}
