// Builds src/data/business.json — business & entrepreneurship content for the
// daily briefing tab. Every item shares ONE structure (標題/摘要/影響/行動建議),
// identical to a news item — only `kind` tags the source.
//
// Sources:
//   1. Real startup/tech items from Hacker News (Algolia API, free, no key)
//   2. Chinese 標題/摘要/影響/行動建議 for each story, plus AI-curated 創業故事 /
//      商業模式拆解 / 產業動態, all via GitHub Models (free, built-in GITHUB_TOKEN)
//
// Degrades gracefully: HN failure keeps previous items; missing/failed GitHub
// Models keeps the previous enriched items (never blanks them). Never fatal.
// No npm deps — Node 20+ global fetch.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')
const OUT = join(DATA, 'business.json')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ENDPOINT =
  process.env.GITHUB_MODELS_ENDPOINT || 'https://models.github.ai/inference/chat/completions'
const MODEL = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o-mini'
const TOKEN = process.env.GITHUB_TOKEN

const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}
const today = () => new Date().toISOString().slice(0, 10)
const str = (v) => (v == null ? '' : String(v))

// ---- Hacker News (Algolia) ----
async function hn(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json?.hits || []
}

async function fetchStories() {
  const buckets = [
    { url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=20', kind: 'top', take: 4 },
    { url: 'https://hn.algolia.com/api/v1/search?tags=show_hn&hitsPerPage=20', kind: 'show', take: 2 },
    { url: 'https://hn.algolia.com/api/v1/search_by_date?query=raises&tags=story&hitsPerPage=30', kind: 'funding', take: 2 },
  ]
  const seen = new Set()
  const out = []
  for (const b of buckets) {
    let hits = []
    try {
      hits = await hn(b.url)
    } catch (e) {
      console.warn(`HN ${b.kind} failed: ${e.message}`)
      continue
    }
    hits
      .filter((h) => h.title && h.url)
      .sort((a, b2) => (b2.points || 0) - (a.points || 0))
      .forEach((h) => {
        const key = (h.title || '').toLowerCase().trim()
        if (seen.has(h.objectID) || seen.has(key)) return
        if (out.filter((s) => s.bucket === b.kind).length >= b.take) return
        seen.add(h.objectID)
        seen.add(key)
        out.push({ id: String(h.objectID), title: h.title, url: h.url, points: h.points || 0, bucket: b.kind })
      })
  }
  return out.slice(0, 8)
}

// ---- GitHub Models (free) ----
// Every leaf has the same four fields: title / summary / impact / action.
async function enrich(stories, industries) {
  const system =
    '你是一位商業與創業分析師，為企業董事長撰寫繁體中文情報。內容白話、有觀點、可行動，避免空泛口號。\n' +
    '每一筆內容都必須有相同的四個欄位：title(標題)、summary(摘要：發生了什麼)、impact(影響：為什麼重要)、action(行動建議)。\n' +
    '嚴格只輸出「一個 JSON 物件」，不要 markdown、不要多餘文字，結構與型別完全如下：\n' +
    '{\n' +
    '  "stories": [ { "id": "對應輸入的 id 字串", "title": "中文標題", "summary": "...", "impact": "...", "action": "..." } ],\n' +
    '  "founderStory": { "title": "...", "summary": "...", "impact": "...", "action": "..." },\n' +
    '  "caseStudy": { "company": "公司名", "title": "...", "summary": "...", "impact": "...", "action": "..." },\n' +
    '  "industryInsights": [ { "industry": "產業名", "title": "...", "summary": "...", "impact": "...", "action": "..." } ]\n' +
    '}\n' +
    '"stories" 必須是陣列，對「輸入的每一則新聞」各一筆並帶回相同 id。' +
    '"industryInsights" 對「每一個指定產業」各一則。所有 summary/impact/action 都要有實質內容。'

  const user =
    '【需中文化並補上 摘要/影響/行動建議 的 Hacker News 新聞】\n' +
    JSON.stringify(stories.map((s) => ({ id: s.id, title: s.title, kind: s.bucket })), null, 2) +
    '\n\n【董事長關注的產業】\n' +
    JSON.stringify(industries) +
    '\n\n請依上述 JSON 結構產出今日商業/創業內容。'

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) throw new Error('no content')
  return JSON.parse(content)
}

const leaf = (v) => ({ title: str(v?.title), summary: str(v?.summary), impact: str(v?.impact), action: str(v?.action) })

async function main() {
  const prev = readJson(OUT, { items: [] })
  const config = readJson(join(DATA, 'business_config.json'), { industries: [] })
  const industries = config.industries || []

  let stories = []
  try {
    stories = await fetchStories()
    console.log(`HN: ${stories.length} stories`)
  } catch (e) {
    console.warn(`HN fetch failed: ${e.message}`)
  }

  let items = []
  let placeholder = true

  if (TOKEN && stories.length) {
    try {
      const ai = await enrich(stories, industries)
      const byId = new Map((Array.isArray(ai.stories) ? ai.stories : []).map((s) => [String(s.id), s]))

      // Curated items first (founder story, business model, industries), then real dynamics.
      if (ai.founderStory && typeof ai.founderStory === 'object') {
        items.push({ id: 'founder', kind: '創業故事', ...leaf(ai.founderStory) })
      }
      if (ai.caseStudy && typeof ai.caseStudy === 'object') {
        const c = leaf(ai.caseStudy)
        const company = str(ai.caseStudy.company)
        items.push({ id: 'case', kind: '商業模式', ...c, title: company && company !== '—' ? `${company}：${c.title}` : c.title })
      }
      ;(Array.isArray(ai.industryInsights) ? ai.industryInsights : []).forEach((ins, i) => {
        const l = leaf(ins)
        const ind = str(ins.industry)
        items.push({ id: `industry-${i}`, kind: '產業動態', ...l, title: ind ? `${ind}：${l.title}` : l.title })
      })
      stories.forEach((s) => {
        const e = byId.get(String(s.id))
        const l = e ? leaf(e) : { title: s.title, summary: '', impact: '', action: '' }
        items.push({ id: s.id, kind: '創業動態', ...l, title: l.title || s.title, url: s.url, source: 'Hacker News' })
      })

      placeholder = false
      console.log(`GitHub Models enrichment OK — ${items.length} items`)
    } catch (e) {
      console.warn(`enrichment failed (keeping previous items): ${e.message}`)
      items = prev.items || []
      placeholder = prev.placeholder ?? true
    }
  } else {
    // No token, or no stories: keep previous enriched items if any; otherwise
    // surface raw stories with empty analysis so the section isn't empty.
    if ((prev.items || []).length) {
      items = prev.items
      placeholder = prev.placeholder ?? true
    } else {
      items = stories.map((s) => ({ id: s.id, kind: '創業動態', title: s.title, summary: '', impact: '', action: '', url: s.url, source: 'Hacker News' }))
    }
    if (!TOKEN) console.warn('GITHUB_TOKEN not set — items not enriched.')
  }

  const out = { asOf: today(), source: 'Hacker News + GitHub Models', items, placeholder }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote business.json: ${items.length} items, placeholder=${placeholder}.`)
}

main()
