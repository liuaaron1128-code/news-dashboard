// Builds src/data/business.json — business & entrepreneurship content for the
// daily briefing tab. Combines:
//   1. Real startup/tech items from Hacker News (Algolia API, free, no key)
//   2. Chinese summaries + AI-curated founder story / business-model breakdown /
//      industry reads via GitHub Models (free, built-in GITHUB_TOKEN)
//
// Degrades gracefully at every step: HN failure keeps previous stories; missing
// GITHUB_TOKEN keeps English titles and the previous AI content. Never fatal.
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
      .slice(0, b.take * 3)
      .forEach((h) => {
        const key = (h.title || '').toLowerCase().trim()
        if (seen.has(h.objectID) || seen.has(key)) return
        if (out.filter((s) => s.kind === b.kind).length >= b.take) return
        seen.add(h.objectID)
        seen.add(key)
        out.push({ id: h.objectID, title: h.title, url: h.url, points: h.points || 0, kind: b.kind })
      })
  }
  return out.slice(0, 8)
}

// ---- GitHub Models (free) ----
async function enrich(stories, industries) {
  const schema = {
    stories: '[{ "id": "對應輸入的 id", "titleZh": "中文標題", "takeaway": "一句話商業重點" }]',
    founderStory:
      '{ "title": "標題", "body": "150-220字的創業故事或創辦人心法，可取材真實知名案例", "takeaways": ["重點1", "重點2"] }',
    caseStudy:
      '{ "company": "公司名", "title": "標題", "body": "150-220字的商業模式拆解", "points": ["關鍵1", "關鍵2", "關鍵3"] }',
    industryInsights:
      '[{ "industry": "產業名", "text": "80-140字該產業近期的商業動態與意涵" }]（每個指定產業一則）',
  }
  const system =
    '你是一位商業與創業分析師，為企業董事長撰寫繁體中文的商業情報。內容要白話、有觀點、可行動，避免空泛口號。' +
    '只輸出一個 JSON 物件，欄位與格式如下（值的說明在括號內，實際請填內容）：\n' +
    JSON.stringify(schema, null, 2) +
    '\nstories 陣列請依輸入的每則新聞各產一筆並帶回相同 id。不要輸出 JSON 以外的文字。'

  const user =
    '【需翻譯/摘要的 Hacker News 新聞】\n' +
    JSON.stringify(stories.map((s) => ({ id: s.id, title: s.title, kind: s.kind })), null, 2) +
    '\n\n【董事長關注的產業】\n' +
    JSON.stringify(industries) +
    '\n\n請產出今日商業/創業內容。'

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
      max_tokens: 2000,
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

async function main() {
  const prev = readJson(OUT, {})
  const config = readJson(join(DATA, 'business_config.json'), { industries: [] })
  const industries = config.industries || []

  let stories = []
  try {
    stories = await fetchStories()
    console.log(`HN: ${stories.length} stories`)
  } catch (e) {
    console.warn(`HN fetch failed: ${e.message}`)
    stories = prev.stories || []
  }

  let founderStory = prev.founderStory || null
  let caseStudy = prev.caseStudy || null
  let industryInsights = prev.industryInsights || []
  let placeholder = true

  if (TOKEN && stories.length) {
    try {
      const ai = await enrich(stories, industries)
      const byId = new Map((ai.stories || []).map((s) => [String(s.id), s]))
      stories = stories.map((s) => {
        const e = byId.get(String(s.id))
        return e ? { ...s, titleZh: e.titleZh, takeaway: e.takeaway } : s
      })
      if (ai.founderStory) founderStory = ai.founderStory
      if (ai.caseStudy) caseStudy = ai.caseStudy
      if (Array.isArray(ai.industryInsights)) industryInsights = ai.industryInsights
      placeholder = false
      console.log('GitHub Models enrichment OK')
    } catch (e) {
      console.warn(`enrichment failed (keeping previous AI content): ${e.message}`)
    }
  } else if (!TOKEN) {
    console.warn('GITHUB_TOKEN not set — stories kept with original titles, AI content unchanged.')
  }

  const out = {
    asOf: today(),
    source: 'Hacker News + GitHub Models',
    stories,
    founderStory,
    caseStudy,
    industryInsights,
    placeholder,
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote business.json: ${stories.length} stories, placeholder=${placeholder}.`)
}

main()
