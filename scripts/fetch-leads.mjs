// Builds src/data/leads.json — an accumulating radar of Taiwanese companies
// showing AI-adoption signals, i.e. prospects for an AI consulting firm
// (Microsoft partner: Azure OpenAI / Copilot / Power Platform).
//
// Signal types (user-confirmed): 轉型意圖 (announced digital/AI transformation,
// hiring AI talent, new digital unit) / 擴張 (funding, new plant, IPO, record
// revenue, hiring spree) / 痛點 (labor shortage, cost pressure, yield/efficiency
// problems, compliance pressure) / 政府補助/標案 (won government AI/smart-mfg
// subsidies or tenders). All industries, all sizes; priority via scoring.
//
// Pipeline (GitHub Models, built-in GITHUB_TOKEN, gpt-4o with mini fallback):
//   stage 1  extract company-level signals from ~60 Taiwan business headlines
//   merge    (in code) dedupe into the accumulated list by normalized name
//   stage 2  for new/updated leads only: industry, score (rubric), reason, pitch
//
// Accumulating: existing leads persist; re-appearing companies gain signals and
// get rescored. Capped at 100 leads (lowest score + oldest dropped). Any stage
// failure keeps the previous file. No npm deps.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')
const OUT = join(DATA, 'leads.json')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ENDPOINT =
  process.env.GITHUB_MODELS_ENDPOINT || 'https://models.github.ai/inference/chat/completions'
const MODEL_PRIMARY = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o'
const MODEL_FALLBACK = 'openai/gpt-4o-mini'
const TOKEN = process.env.GITHUB_TOKEN
const MAX_LEADS = 100
const CORE_INDUSTRIES = new Set(['金融', '醫療', '製造'])
const SIGNAL_TYPES = new Set(['轉型意圖', '擴張', '痛點', '政府補助/標案'])

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

// ---- Taiwan-business-heavy RSS ----
const FEEDS = [
  { url: 'https://feeds.feedburner.com/rsscna/finance', source: '中央社財經' },
  { url: 'https://feeds.feedburner.com/rsscna/technology', source: '中央社科技' },
  { url: 'https://feeds.feedburner.com/rsscna/politics', source: '中央社政治' },
  { url: 'https://technews.tw/feed/', source: 'TechNews' },
  { url: 'https://www.bnext.com.tw/rss', source: '數位時代' },
  { url: 'https://www.inside.com.tw/feed/rss', source: 'INSIDE' },
  { url: 'https://ctee.com.tw/feed', source: '工商時報' },
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

function parseRss(xml, source, max = 10) {
  const items = []
  const clean = (s) => decodeEntities((s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  for (const b of xml.split(/<item[\s>]/i).slice(1, max + 1)) {
    const t = b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)
    const d = b.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
    const l = b.match(/<link>(?:<!\[CDATA\[)?\s*(https?:[^<\]\s]+)/i)
    if (!t) continue
    const title = clean(t[1])
    if (title) items.push({ source, title, summary: clean(d && d[1]).slice(0, 220), url: l ? l[1].trim() : undefined })
  }
  return items
}

async function fetchMaterial() {
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const res = await fetch(f.url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseRss(await res.text(), f.source, 10)
    }),
  )
  const all = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      all.push(...r.value)
      console.log(`RSS ${FEEDS[i].source}: ${r.value.length}`)
    } else console.warn(`RSS ${FEEDS[i].source} failed: ${r.reason?.message || r.reason}`)
  })
  const seen = new Set()
  return all.filter((h) => {
    const k = h.title.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 60)
}

// ---- GitHub Models chat with model fallback ----
async function chat(messages, { maxTokens = 3000, temperature = 0.3 } = {}) {
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

// stage 1 — extract company-level signals
async function extractSignals(material) {
  const system =
    '你是一位替「台灣 AI 顧問公司」（Microsoft 夥伴：Azure OpenAI/Copilot/Power Platform）做業務開發的分析師。' +
    '任務：從新聞材料中，抽取「可能需要導入 AI 的潛在客戶企業」訊號。' +
    '\n訊號類型定義：' +
    '\n- 轉型意圖：公開宣布數位轉型、導入 AI/雲端/ERP、成立數位部門、大舉徵 AI 人才。' +
    '\n- 擴張：募資、新廠動工、上市上櫃、營收創高、大幅擴編——有預算、正在成長。' +
    '\n- 痛點：缺工、成本壓力、良率/效率問題、法遵壓力（金管會新規、ESG 揭露）——有明確可切入的痛。' +
    '\n- 政府補助/標案：獲得政府 AI/智慧製造/數位補助，或政府機關本身發出 AI 相關標案。' +
    '\n收錄規則：只收台灣企業/機構、或在台灣有實質營運的外商；政府機關與醫院可收；' +
    '**排除**主業就是提供 AI/軟體/雲端服務的同業（他們是競爭者不是客戶）；單純股價漲跌不是訊號；沒有具體公司名的產業通論不收。' +
    '\n嚴格只輸出一個 JSON 物件：{"signals":[{"company":"公司/機構名","type":"轉型意圖|擴張|痛點|政府補助/標案","text":"一句話：發生了什麼、為何代表 AI 導入機會（含材料中的具體數字）","ref":材料編號}]}' +
    '\n一則材料可產出多家公司的訊號；沒有合格訊號就輸出空陣列，不要硬湊。'
  const user =
    '【新聞材料】\n' +
    material.map((h, i) => `${i}. [${h.source}] ${h.title}${h.summary ? ' — ' + h.summary.slice(0, 120) : ''}`).join('\n')
  const { data, model } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 2500, temperature: 0.2 },
  )
  const signals = (Array.isArray(data.signals) ? data.signals : []).filter(
    (s) => s && s.company && SIGNAL_TYPES.has(s.type) && s.text && material[s.ref],
  )
  console.log(`extract (${model}): ${signals.length} signals`)
  return signals
}

// stage 2 — score & pitch for new/updated leads (batched)
async function scoreLeads(leadsToScore) {
  const system =
    '你是一位替「台灣 AI 顧問公司」（Microsoft 夥伴：Azure OpenAI/Copilot/Power Platform/Fabric，客戶以金融、醫療、製造為主）評估潛在客戶的顧問。' +
    '對每家公司輸出：' +
    '\n- industry：從「金融、醫療、製造、零售電商、物流、政府公部門、營建不動產、餐飲觀光、教育、能源、農業、其他」中選一個。' +
    '\n- score：0-90 的優先級分數。評分基準：訊號愈明確分數愈高（轉型意圖 > 政府補助/標案 ≈ 痛點 > 擴張）；多種訊號並存加分；' +
    '訊號愈新加分；預算能見度（募資金額、補助金額、公司規模）加分。' +
    '\n- scoreReason：1-2 句，說明為什麼是這個分數。' +
    '\n- pitch：2-3 句具體切入建議——用哪個 Microsoft 方案（Azure OpenAI/Copilot/Power Platform/Fabric）切它的哪個痛點或需求、第一步接觸點是什麼。禁止空話。' +
    '\n嚴格只輸出一個 JSON 物件：{"leads":[{"company":"與輸入相同的公司名","industry":"...","score":數字,"scoreReason":"...","pitch":"..."}]}'
  const user =
    '【待評估的公司與其累積訊號】\n' +
    JSON.stringify(
      leadsToScore.map((l) => ({ company: l.company, signals: l.signals.slice(0, 6).map((s) => ({ date: s.date, type: s.type, text: s.text })) })),
      null,
      1,
    )
  const { data, model } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 3000, temperature: 0.3 },
  )
  console.log(`score (${model}): ${(data.leads || []).length}/${leadsToScore.length}`)
  return Array.isArray(data.leads) ? data.leads : []
}

// ---- merge helpers ----
const normName = (n) =>
  str(n)
    .replace(/股份有限公司|有限公司|公司|集團/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
const slugify = (n) => normName(n).replace(/[^\p{L}\p{N}]+/gu, '-') || 'lead'

async function main() {
  const prev = readJson(OUT, { leads: [] })
  const existing = Array.isArray(prev.leads) ? prev.leads : []

  if (!TOKEN) {
    console.warn('GITHUB_TOKEN not set — keeping previous leads.json.')
    return
  }

  const material = await fetchMaterial()
  console.log(`material total: ${material.length}`)
  if (material.length < 8) {
    console.warn('Too little material — keeping previous leads.json.')
    return
  }

  let extracted
  try {
    extracted = await extractSignals(material)
  } catch (e) {
    console.error(`extract failed (keeping previous): ${e.message}`)
    return
  }

  // ---- merge into accumulated list (in code) ----
  const byNorm = new Map(existing.map((l) => [normName(l.company), l]))
  const touched = new Set()
  const date = today()

  for (const s of extracted) {
    const norm = normName(s.company)
    if (!norm) continue
    const src = material[s.ref]
    const signal = { date, type: s.type, text: str(s.text), source: src?.source, url: src?.url }
    let lead = byNorm.get(norm)
    if (!lead) {
      lead = {
        id: slugify(s.company),
        company: str(s.company),
        industry: '其他',
        isCoreIndustry: false,
        score: 0,
        scoreReason: '',
        pitch: '',
        signals: [],
        firstSeen: date,
        lastSeen: date,
      }
      byNorm.set(norm, lead)
    }
    // dedupe: same type + near-identical text, or exact text
    const dup = lead.signals.some(
      (x) => x.type === signal.type && (x.text === signal.text || x.text.slice(0, 18) === signal.text.slice(0, 18)),
    )
    if (!dup) {
      lead.signals.unshift(signal)
      lead.signals = lead.signals.slice(0, 12)
      lead.lastSeen = date
      touched.add(norm)
    }
  }

  const all = [...byNorm.values()]
  const toScore = all.filter((l) => touched.has(normName(l.company)))
  console.log(`leads: ${all.length} total, ${toScore.length} new/updated to score`)

  // ---- score & pitch in batches of 8 ----
  for (let i = 0; i < toScore.length; i += 8) {
    const batch = toScore.slice(i, i + 8)
    try {
      const scored = await scoreLeads(batch)
      for (const r of scored) {
        const lead = byNorm.get(normName(r.company))
        if (!lead) continue
        lead.industry = str(r.industry) || lead.industry || '其他'
        lead.isCoreIndustry = CORE_INDUSTRIES.has(lead.industry)
        const base = Math.max(0, Math.min(90, Number(r.score) || 0))
        lead.score = Math.min(100, base + (lead.isCoreIndustry ? 10 : 0))
        lead.scoreReason = str(r.scoreReason)
        lead.pitch = str(r.pitch)
      }
    } catch (e) {
      console.warn(`score batch failed: ${e.message}`)
    }
    await sleep(1500)
  }

  // keep only leads that have been scored at least once
  const finalLeads = all
    .filter((l) => l.score > 0 && l.signals.length > 0)
    .sort((a, b) => b.score - a.score || (a.lastSeen < b.lastSeen ? 1 : -1))
    .slice(0, MAX_LEADS)

  if (finalLeads.length === 0 && existing.length > 0) {
    console.warn('No scored leads this run — keeping previous leads.json.')
    return
  }

  const out = { asOf: date, source: '台灣商業媒體 RSS + GitHub Models', leads: finalLeads, placeholder: finalLeads.length === 0 }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote leads.json: ${finalLeads.length} leads (${extracted.length} signals extracted today).`)
}

main()
