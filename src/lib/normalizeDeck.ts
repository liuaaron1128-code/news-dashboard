// Defensive normalization: turn possibly-imperfect LLM output into a valid Deck.
// Assigns stable slide ids, drops slides that can't be rendered, and clamps sizes.
// Never throws — returns a best-effort Deck so the pipeline degrades gracefully.

import {
  Deck,
  Slide,
  SlideLayout,
  ThemeName,
  DeckMeta,
} from '@/types/deck'

const LAYOUTS: SlideLayout[] = [
  'cover', 'agenda', 'section', 'bullets', 'two-column',
  'kpi-grid', 'chart', 'quote', 'timeline', 'closing',
]

const THEMES: ThemeName[] = ['executive', 'briefing', 'minimal']

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Returns a valid Slide or null if it can't be salvaged.
function normalizeSlide(raw: unknown, i: number): Slide | null {
  if (!isObj(raw)) return null
  const layout = raw.layout as SlideLayout
  if (!LAYOUTS.includes(layout)) return null
  const id = str(raw.id) || `s${i + 1}`
  const notes = str(raw.notes) || undefined

  switch (layout) {
    case 'cover':
      if (!str(raw.title)) return null
      return { id, layout, eyebrow: str(raw.eyebrow) || undefined, title: str(raw.title), subtitle: str(raw.subtitle) || undefined, notes }
    case 'agenda': {
      const items = strArr(raw.items).slice(0, 8)
      if (!items.length) return null
      return { id, layout, title: str(raw.title, '議程'), items, notes }
    }
    case 'section':
      if (!str(raw.title)) return null
      return { id, layout, index: str(raw.index) || undefined, title: str(raw.title), subtitle: str(raw.subtitle) || undefined, notes }
    case 'bullets': {
      const pts = Array.isArray(raw.points) ? raw.points : []
      const points = pts
        .map((p) => (isObj(p) ? { text: str(p.text), emphasis: p.emphasis === true, sub: strArr(p.sub) } : { text: str(p) }))
        .filter((p) => p.text)
        .slice(0, 6)
      if (!points.length) return null
      return { id, layout, title: str(raw.title, '重點'), points, takeaway: str(raw.takeaway) || undefined, notes }
    }
    case 'two-column': {
      const l = isObj(raw.left) ? raw.left : {}
      const r = isObj(raw.right) ? raw.right : {}
      const left = { heading: str(l.heading), points: strArr(l.points).slice(0, 6) }
      const right = { heading: str(r.heading), points: strArr(r.points).slice(0, 6) }
      if (!left.points.length && !right.points.length) return null
      return { id, layout, title: str(raw.title, '對比'), left, right, notes }
    }
    case 'kpi-grid': {
      const arr = Array.isArray(raw.kpis) ? raw.kpis : []
      const kpis = arr
        .filter(isObj)
        .map((k) => ({
          label: str(k.label),
          value: str(k.value),
          delta: str(k.delta) || undefined,
          positive: typeof k.positive === 'boolean' ? k.positive : null,
        }))
        .filter((k) => k.label && k.value)
        .slice(0, 4)
      if (!kpis.length) return null
      return { id, layout, title: str(raw.title, '核心指標'), kpis, notes }
    }
    case 'chart': {
      const c = isObj(raw.chart) ? raw.chart : {}
      const categories = strArr(c.categories)
      const seriesRaw = Array.isArray(c.series) ? c.series : []
      const series = seriesRaw
        .filter(isObj)
        .map((s) => ({
          name: str(s.name, '數列'),
          data: Array.isArray(s.data) ? s.data.filter((n) => typeof n === 'number') : [],
        }))
        .filter((s) => s.data.length)
        .slice(0, 3)
      if (!categories.length || !series.length) return null
      const type = c.type === 'line' || c.type === 'pie' ? c.type : 'bar'
      return { id, layout, title: str(raw.title, '趨勢'), chart: { type, categories, series }, caption: str(raw.caption) || undefined, notes }
    }
    case 'quote': {
      const quote = str(raw.quote)
      if (!quote) return null
      return { id, layout, quote, attribution: str(raw.attribution) || undefined, notes }
    }
    case 'timeline': {
      const evRaw = Array.isArray(raw.events) ? raw.events : []
      const events = evRaw
        .filter(isObj)
        .map((e) => ({ date: str(e.date), title: str(e.title), detail: str(e.detail) || undefined }))
        .filter((e) => e.title)
        .slice(0, 6)
      if (!events.length) return null
      return { id, layout, title: str(raw.title, '時間軸'), events, notes }
    }
    case 'closing':
      return { id, layout, title: str(raw.title, '謝謝'), subtitle: str(raw.subtitle) || undefined, contact: str(raw.contact) || undefined, notes }
    default:
      return null
  }
}

export function normalizeDeck(raw: unknown, fallbackTheme: ThemeName = 'executive'): Deck {
  const obj = isObj(raw) ? raw : {}
  const metaRaw = isObj(obj.meta) ? obj.meta : {}
  const theme = THEMES.includes(metaRaw.theme as ThemeName) ? (metaRaw.theme as ThemeName) : fallbackTheme

  const slidesRaw = Array.isArray(obj.slides) ? obj.slides : []
  const slides = slidesRaw
    .map((s, i) => normalizeSlide(s, i))
    .filter((s): s is Slide => s !== null)
    .slice(0, 20)

  const meta: DeckMeta = {
    title: str(metaRaw.title, '未命名簡報'),
    subtitle: str(metaRaw.subtitle) || undefined,
    author: str(metaRaw.author) || '董事長 AI 助理',
    date: str(metaRaw.date) || undefined,
    theme,
    templateId: str(metaRaw.templateId) || 'executive',
  }

  return { meta, slides }
}
