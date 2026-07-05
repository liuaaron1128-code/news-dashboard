// Builds src/data/business.json — business & entrepreneurship content for the
// daily briefing tab. Every item shares ONE structure (標題/摘要/影響/行動建議);
// `kind` only tags the block: 創業動態 / 創業故事 / 商業模式 / 產業動態.
//
// Sources (all free):
//   - Business/startup RSS: TechCrunch Startups & Venture, Entrepreneur, HBR,
//     數位時代, INSIDE, TechNews
//   - Hacker News (Algolia): recent front page, recent Show HN (date-filtered —
//     NOT all-time top), recent funding stories
//
// Pipeline (GitHub Models, built-in GITHUB_TOKEN, gpt-4o with mini fallback):
//   stage 1  select 6-8 real startup/business dynamics + pick the day's founder
//            story subject + business-model breakdown company + per-industry refs
//   stage 2  write dynamics in batches of 4 at full depth
//   stage 3  write the curated blocks (founder story / case study / industry
//            reads) grounded in the day's actual material
//
// Depth contract (enforced by prompt): summary 2-3 concrete sentences with the
// material's numbers in bold; impact 2-3 sentences tied to THIS reader's
// business or portfolio; action 2 concrete executable sentences — generic
// filler like「密切關注」「提升效率」alone is banned. Never invent numbers.
//
// Degrades gracefully: any stage failure keeps the previous items. No npm deps.

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
const MODEL_PRIMARY = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o'
const MODEL_FALLBACK = 'openai/gpt-4o-mini'
const TOKEN = process.env.GITHUB_TOKEN

const readJson = (p, fb) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fb
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
const str = (v) => (v == null ? '' : String(v))

// ---- RSS (business/startup focused) ----
const FEEDS = [
  { url: 'https://techcrunch.com/category/startups/feed/', source: 'TechCrunch Startups' },
  { url: 'https://techcrunch.com/category/venture/feed/', source: 'TechCrunch Venture' },
  { url: 'https://www.entrepreneur.com/latest.rss', source: 'Entrepreneur' },
  { url: 'https://feeds.hbr.org/harvardbusiness', source: 'HBR' },
  { url: 'https://www.bnext.com.tw/rss', source: '數位時代' },
  { url: 'https://www.inside.com.tw/feed/rss', source: 'INSIDE' },
  { url: 'https://technews.tw/feed/', source: 'TechNews' },
]

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
}

function parseRss(xml, source, max = 6) {
  const items = []
  const clean = (s) => decodeEntities((s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  for (const b of xml.split(/<item[\s>]/i).slice(1, max + 1)) {
    const t = b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)
    const d = b.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
    const l = b.match(/<link>(?:<!\[CDATA\[)?\s*(https?:[^<\]\s]+)/i)
    if (!t) continue
    const title = clean(t[1])
    if (title) items.push({ source, title, summary: clean(d && d[1]).slice(0, 260), url: l ? l[1].trim() : undefined })
  }
  return items
}

async function hn(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json())?.hits || []
}

async function fetchMaterial() {
  const out = []
  // RSS feeds in parallel
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const res = await fetch(f.url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseRss(await res.text(), f.source, 6)
    }),
  )
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      out.push(...r.value)
      console.log(`RSS ${FEEDS[i].source}: ${r.value.length}`)
    } else console.warn(`RSS ${FEEDS[i].source} failed: ${r.reason?.message || r.reason}`)
  })
  // Hacker News — all buckets DATE-FILTERED so we never surface decade-old posts
  const hnBuckets = [
    { url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=15', label: 'HN front' },
    { url: 'https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=points%3E30&hitsPerPage=15', label: 'HN Show' },
    { url: 'https://hn.algolia.com/api/v1/search_by_date?query=raises&tags=story&numericFilters=points%3E10&hitsPerPage=15', label: 'HN funding' },
  ]
  for (const b of hnBuckets) {
    try {
      const hits = await hn(b.url)
      const items = hits
        .filter((h) => h.title && h.url)
        .slice(0, 8)
        .map((h) => ({ source: 'Hacker News', title: decodeEntities(h.title), summary: '', url: h.url }))
      out.push(...items)
      console.log(`${b.label}: ${items.length}`)
    } catch (e) {
      console.warn(`${b.label} failed: ${e.message}`)
    }
  }
  // Dedupe by normalised title
  const seen = new Set()
  return out.filter((h) => {
    const k = h.title.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 60)
}

// ---- GitHub Models chat with model fallback ----
async function chat(messages, { maxTokens = 4000, temperature = 0.4 } = {}) {
  const models = [...new Set([MODEL_PRIMARY, MODEL_FALLBACK])]
  let lastErr
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
          body: JSON.stringify({ model, temperature, max_tokens: maxTokens, response_format: { type: 'json_object' }, messages }),
          signal: AbortSignal.timeout(120000),
        })
        if (!res.ok) {
          const body = (await res.text()).slice(0, 200)
          const retryable = res.status === 429 || res.status >= 500
          const err = new Error(`HTTP ${res.status}: ${body}`)
          if (!retryable) {
            lastErr = err
            break
          }
          throw err
        }
        const json = await res.json()
        const content = json?.choices?.[0]?.message?.content
        if (!content) throw new Error('no content')
        return { data: JSON.parse(content), model }
      } catch (e) {
        lastErr = e
        await sleep(4000)
      }
    }
    console.warn(`model ${model} failed: ${lastErr?.message}`)
  }
  throw lastErr
}

const AUDIENCE =
  '讀者是一位台灣 AI 顧問公司董事長（Microsoft 核心夥伴：Azure OpenAI/Copilot/Power Platform，客戶為金融、醫療、製造業）' +
  '兼個人投資人（台股/全球/美股基金、加密貨幣、房地產）。你是他的商業與創業情報顧問。' +
  '寫作鐵律：每一句都要有資訊量。禁止空話——「密切關注」「提升效率」「保持競爭力」「靈活調整」這類詞單獨出現即為不合格；' +
  '要寫就寫「關注什麼指標、到什麼水位、然後做什麼」。嚴禁編造材料中沒有的數字。'

const DEPTH =
  '每則條目的深度要求：' +
  '\n- title：精練、資訊點前置（誰、做了什麼、多少錢/多大規模）。' +
  '\n- summary：2-3 句，必含材料中的具體事實（金額、輪次、人名、產品、時間），關鍵數字用 **粗體**；材料沒有數字就寫具體的定性事實。' +
  '\n- impact：2-3 句，回答「這對這位讀者為什麼重要」——對他的 AI 顧問業務（Microsoft 生態、金融/醫療/製造客戶）或投資佈局的具體意涵、機會或威脅。' +
  '\n- action：2 句，具體可執行的下一步（例如「本週讓團隊評估 X 能否納入 Copilot 導入提案」「若 Y 跌破 Z 則減碼」），不是抽象建議。'

// stage 1 — select
async function select(material, industries) {
  const system =
    AUDIENCE +
    '\n任務：從商業/創業新聞材料中做今日選題。輸出 JSON 物件：' +
    '\n{"dynamics":[{"refs":[材料編號,...],"angle":"為何重要，一句話"}],' +
    '"founder":{"refs":[...],"subject":"創辦人或公司名","angle":"故事切角"},' +
    '"caseStudy":{"refs":[...],"company":"公司名","angle":"商業模式上值得拆解的點"},' +
    '"industries":[{"industry":"產業名","refs":[...]}]}' +
    '\n規則：dynamics 選 6-8 個對這位讀者最有商業價值的真實動態（募資、產品發布、策略轉向、倒閉、併購、市場結構變化優先；' +
    '純工程技巧、與商業無關的趣聞不選）。founder 選材料中有敘事素材的公司/創辦人。' +
    'caseStudy 選材料中出現、商業模式值得拆解的公司（收入結構或護城河有戲的那種，不是人資新聞）。' +
    'industries 對每個指定產業找出材料中相關的條目編號（可為空陣列）。'
  const user =
    `【指定產業】${JSON.stringify(industries)}\n\n【材料清單】\n` +
    material.map((h, i) => `${i}. [${h.source}] ${h.title}${h.summary ? ' — ' + h.summary.slice(0, 100) : ''}`).join('\n')
  const { data, model } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 1200, temperature: 0.3 },
  )
  console.log(`select (${model}): ${(data.dynamics || []).length} dynamics`)
  return data
}

// stage 2 — write dynamics in batches
async function writeDynamics(picks, material) {
  const items = []
  for (let i = 0; i < picks.length; i += 4) {
    const batch = picks.slice(i, i + 4)
    const system =
      AUDIENCE +
      '\n任務：把每個故事寫成「創業/商業動態」條目。' +
      DEPTH +
      '\n嚴格只輸出一個 JSON 物件：{"items":[{"title":"...","summary":"...","impact":"...","action":"..."}]}（順序對應輸入）。'
    const user =
      '【要撰寫的故事與素材】\n' +
      JSON.stringify(
        batch.map((p, j) => ({ story: j + 1, angle: p.angle, materials: p.refs.filter((r) => material[r]).map((r) => material[r]) })),
        null,
        1,
      )
    try {
      const { data, model } = await chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        { maxTokens: 3000, temperature: 0.4 },
      )
      const written = Array.isArray(data.items) ? data.items : []
      console.log(`dynamics batch (${model}): ${written.length}/${batch.length}`)
      written.forEach((w, j) => {
        const p = batch[j]
        const first = p && p.refs.map((r) => material[r]).find(Boolean)
        items.push({ ...w, url: first?.url, source: first?.source })
      })
    } catch (e) {
      console.warn(`dynamics batch failed: ${e.message}`)
    }
    await sleep(1500)
  }
  return items
}

// stage 3 — curated blocks grounded in the day's material
async function writeCurated(sel, material, industries) {
  const refsOf = (o) => (o && Array.isArray(o.refs) ? o.refs.filter((r) => material[r]).map((r) => material[r]) : [])
  const system =
    AUDIENCE +
    '\n任務：撰寫三個深度區塊，全部必須以提供的當日真實材料為根據（可輔以該公司廣為人知的公開事實，如創辦年份、知名轉折，但精確財務數字只能用材料中有的）。' +
    DEPTH +
    '\n1. founderStory（創業故事/創辦人心法）：以指定的公司/創辦人為主角，summary 改為 150-250 字的敘事——具體的人、事件、轉折與決策，看完要能學到一個可遷移的心法；不寫「創業者面臨挑戰與機遇」這種通論。' +
    '\n2. caseStudy（商業模式拆解）：拆解指定公司——它靠什麼收錢、護城河是什麼、目前最大的模式風險；summary 150-250 字。' +
    '\n3. industryInsights：對每個指定產業，根據其相關材料寫當日動態；某產業當日無相關材料時，誠實寫「本日無重大公開動態」並給一個當前該追蹤的具體指標，不要瞎編。' +
    '\n嚴格只輸出一個 JSON 物件：{"founderStory":{"title","summary","impact","action"},"caseStudy":{"company","title","summary","impact","action"},"industryInsights":[{"industry","title","summary","impact","action"}]}'
  const user =
    `【創業故事主角】${sel.founder?.subject || '（自選材料中最有故事性的公司）'}｜切角：${sel.founder?.angle || ''}\n素材：` +
    JSON.stringify(refsOf(sel.founder)) +
    `\n\n【商業模式拆解對象】${sel.caseStudy?.company || '（自選）'}｜切角：${sel.caseStudy?.angle || ''}\n素材：` +
    JSON.stringify(refsOf(sel.caseStudy)) +
    '\n\n【產業與其素材】\n' +
    JSON.stringify(
      industries.map((ind) => {
        const m = (sel.industries || []).find((x) => x.industry === ind)
        return { industry: ind, materials: refsOf(m) }
      }),
      null,
      1,
    )
  const { data, model } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 3500, temperature: 0.5 },
  )
  console.log(`curated (${model}): founder=${!!data.founderStory} case=${!!data.caseStudy} industries=${(data.industryInsights || []).length}`)
  return data
}

const leaf = (v) => ({ title: str(v?.title), summary: str(v?.summary), impact: str(v?.impact), action: str(v?.action) })
const solid = (it) => it.title && it.summary.length >= 30 && it.impact.length >= 20 && it.action.length >= 15

async function main() {
  const prev = readJson(OUT, { items: [] })
  const config = readJson(join(DATA, 'business_config.json'), { industries: [] })
  const industries = config.industries || []

  if (!TOKEN) {
    console.warn('GITHUB_TOKEN not set — keeping previous business.json.')
    return
  }

  const material = await fetchMaterial()
  console.log(`material total: ${material.length}`)
  if (material.length < 8) {
    console.warn('Too little material — keeping previous business.json.')
    return
  }

  let sel
  try {
    sel = await select(material, industries)
  } catch (e) {
    console.error(`select failed (keeping previous): ${e.message}`)
    return
  }
  const picks = (Array.isArray(sel.dynamics) ? sel.dynamics : []).filter((p) => Array.isArray(p.refs) && p.refs.some((r) => material[r])).slice(0, 8)

  const items = []

  // Curated blocks first (founder story, case study, industry reads)
  try {
    const cur = await writeCurated(sel, material, industries)
    const f = leaf(cur.founderStory)
    if (solid(f)) items.push({ id: 'founder', kind: '創業故事', ...f })
    const c = leaf(cur.caseStudy)
    const company = str(cur.caseStudy?.company)
    if (solid(c)) items.push({ id: 'case', kind: '商業模式', ...c, title: company && !c.title.includes(company) ? `${company}：${c.title}` : c.title })
    ;(Array.isArray(cur.industryInsights) ? cur.industryInsights : []).forEach((ins, i) => {
      const l = leaf(ins)
      const ind = str(ins.industry)
      if (solid(l)) items.push({ id: `industry-${i}`, kind: '產業動態', ...l, title: ind && !l.title.includes(ind) ? `${ind}：${l.title}` : l.title })
    })
  } catch (e) {
    console.warn(`curated failed: ${e.message}`)
  }

  // Real dynamics
  const dyn = await writeDynamics(picks, material)
  dyn.forEach((d, i) => {
    const l = leaf(d)
    if (solid(l)) items.push({ id: `dyn-${i}`, kind: '創業動態', ...l, url: d.url, source: d.source })
  })

  if (items.length < 5) {
    console.warn(`Only ${items.length} solid items — keeping previous business.json.`)
    if ((prev.items || []).length) return
  }

  const out = { asOf: today(), source: '商業媒體 RSS + Hacker News + GitHub Models', items, placeholder: false }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote business.json: ${items.length} items (${items.filter((i) => i.kind === '創業動態').length} dynamics) from ${material.length} materials.`)
}

main()
