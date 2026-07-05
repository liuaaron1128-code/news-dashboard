// Builds src/data/leads.json — a concrete, sales-ready prospect list for the
// AI consulting business (Microsoft partner: Azure OpenAI / Copilot / Power
// Platform), shown in the 潛在客戶 tab.
//
// Two tracks merged into one accumulating list (LIST_VERSION resets old shapes):
//
//   SEED — knowledge-curated CONCRETE companies (上市櫃/知名企業/醫院集團;
//   research institutes and AI-vendor peers excluded). Each lead ships with the
//   full sales fields: 簡介 / 推薦原因 / 對應產品與場景 / 進行方式（對口、首次
//   接觸、POC）/ 官網. First run seeds ~32 across industries (金融/醫療/製造
//   priority per existing client base); later runs top up one batch per day
//   until the 60-seed target, avoiding duplicates.
//
//   NEWS — daily media scan (中央社財經/科技/政治, TechNews, 數位時代, INSIDE,
//   工商時報) extracts company-level signals (轉型意圖/擴張/痛點/政府補助標案),
//   appends them to existing leads (score boost) or creates new leads that then
//   get the same full sales profile.
//
// Model: GitHub Models gpt-4o (mini fallback), free via GITHUB_TOKEN. Websites
// are only emitted when the model is confident; the UI adds constructed lookup
// links (Google/104) so contact info never depends on hallucination. Any stage
// failure keeps the previous file. Capped at 100 leads. No npm deps.

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

const LIST_VERSION = 2
const MAX_LEADS = 100
const SEED_TARGET = 60
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
const normName = (n) =>
  str(n)
    .replace(/股份有限公司|有限公司|公司|集團|控股/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
const slugify = (n) => normName(n).replace(/[^\p{L}\p{N}]+/gu, '-') || 'lead'

// Model outputs often shorten names (廣達電腦 vs 廣達電腦股份有限公司(廣達)) —
// match by containment either way, preferring exact.
function fuzzyGet(byNorm, name) {
  const norm = normName(name)
  if (!norm) return undefined
  if (byNorm.has(norm)) return byNorm.get(norm)
  for (const [k, v] of byNorm) {
    if (k.includes(norm) || norm.includes(k)) return v
  }
  return undefined
}

// ---------- shared prompt fragments ----------
const IDENTITY =
  '你是一位替「台灣 AI 顧問公司」做業務開發的資深顧問。這家公司是 Microsoft 核心夥伴' +
  '（主力方案：Azure OpenAI Service、M365 Copilot、Copilot Studio、Power Platform、Power BI、Microsoft Fabric、Azure AI Search），' +
  '現有客戶以金融、醫療、製造業為主。'

const PROFILE_SPEC =
  '每家公司輸出以下欄位（全部繁體中文，具體、可執行、禁空話）：' +
  '\n- company：公司正式簡稱（例：國泰金控、長庚醫療體系、中鋼）。**只列你能確定真實存在的公司**——上市櫃公司請在 brief 開頭附股票代號（例：2330 台積電）；' +
  '未上市者必須是全國知名的醫院/集團/機構。名稱含糊、你不確定是否存在的公司，寧可不列。' +
  '\n- industry：從「金融、醫療、製造、零售電商、物流、政府公部門、營建不動產、餐飲觀光、教育、能源、農業、其他」選一。' +
  '\n- brief：一句話——這家公司做什麼、規模量級（員工數/營收/分店數等你確定的公開事實）。' +
  '\n- whyNow：推薦原因，2-3 句——為什麼「現在」可能需要 AI 導入：引用它已公開的數位轉型作為、產業痛點（缺工/法遵/良率）、或競爭壓力。必須具體到這家公司，不能是產業通論。' +
  '\n- products：2-3 個，[{"name":"方案名（限：Azure OpenAI Service/M365 Copilot/Copilot Studio/Power Platform/Power BI/Microsoft Fabric/Azure AI Search/Dynamics 365/Azure ML）","use":"用在這家公司的哪個具體場景"}]。' +
  '\n- approach：2-3 步的進行方式陣列——(1) 對口單位/職稱（例：數位長、資訊處、總管理處），(2) 首次接觸的具體方式（研討會邀請/補助案協作/免費健檢工作坊），(3) 建議 Demo/POC 的具體題目。' +
  '\n- website：官方網站網址，**只在你高度確定時填寫**，不確定就省略此欄位，嚴禁猜測。' +
  '\n- score：0-90 優先級（需求明確度、預算能見度、與現有客群的相近度）。' +
  '\n- scoreReason：1-2 句評分理由。'

const EXCLUSIONS =
  '排除：法人研究機構（工研院、金屬中心、資策會等）；主業是 AI/軟體/雲端/系統整合服務的同業；' +
  '微軟（Microsoft）本身與其分公司、Google/AWS/OpenAI 等雲端與 AI 原廠（他們是供應商或夥伴，不是客戶）；沒有實質台灣營運的外商。'

// ---------- GitHub Models ----------
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

// ---------- normalize a model-produced profile onto a lead ----------
const PRODUCT_NAMES = new Set([
  'Azure OpenAI Service',
  'M365 Copilot',
  'Copilot Studio',
  'Power Platform',
  'Power BI',
  'Microsoft Fabric',
  'Azure AI Search',
  'Dynamics 365',
  'Azure ML',
])

// Vendors/partners are suppliers, not prospects — never let them onto the list.
const BLOCKLIST = ['微軟', 'microsoft', 'google', '谷歌', 'aws', 'amazon', 'openai', 'nvidia', '輝達', 'meta', 'anthropic',
  // generic/fabricated names that slipped through earlier runs
  '台灣醫學中心', '健保醫療科技', '台灣醫療器材', '安克醫療科技']
const isBlocked = (norm) => BLOCKLIST.some((b) => norm.includes(b))

// Model may return approach steps as objects or with their own "(1)" prefixes.
function coerceStep(item) {
  let text
  if (typeof item === 'string') text = item
  else if (item && typeof item === 'object') text = Object.values(item).map(String).filter(Boolean).join('：')
  else text = str(item)
  return text.replace(/^\s*[\(（]?\d+[\)）.、:：]?\s*/, '').trim()
}

function applyProfile(lead, p) {
  lead.industry = str(p.industry) || lead.industry || '其他'
  lead.isCoreIndustry = CORE_INDUSTRIES.has(lead.industry)
  lead.brief = str(p.brief) || lead.brief
  lead.whyNow = str(p.whyNow) || lead.whyNow
  lead.products = (Array.isArray(p.products) ? p.products : [])
    .map((x) => ({ name: str(x.name), use: str(x.use) }))
    .filter((x) => PRODUCT_NAMES.has(x.name) && x.use)
    .slice(0, 3)
  lead.approach = (Array.isArray(p.approach) ? p.approach : []).map(coerceStep).filter(Boolean).slice(0, 4)
  const site = str(p.website)
  if (/^https?:\/\/[\w.-]+/.test(site)) lead.website = site
  const base = Math.max(0, Math.min(90, Number(p.score) || 0))
  lead.score = Math.min(100, base + (lead.isCoreIndustry ? 10 : 0))
  lead.scoreReason = str(p.scoreReason)
  return lead
}

const solid = (l) =>
  l.company &&
  !isBlocked(normName(l.company)) &&
  l.brief &&
  l.whyNow.length >= 30 &&
  l.products.length >= 1 &&
  l.approach.length >= 2 &&
  !l.approach.some((a) => a.includes('object Object')) &&
  l.score > 0

// ---------- SEED track ----------
const SEED_FOCI = [
  '金融業（銀行、保險、證券、金控——法遵、客服、理賠、KYC 是常見切點）',
  '醫療業（醫學中心與醫療集團、藥廠、醫材——病歷摘要、排程、行政自動化）',
  '製造業（電子與傳統製造、上市櫃中堅企業——良率、排程、知識管理、缺工）',
  '零售電商、物流、餐飲觀光、營建不動產等其他產業（客服、供應鏈、會員經營）',
]

async function seedBatch(focus, avoidNames, n = 8) {
  const system =
    IDENTITY +
    `\n任務：列出 ${n} 家「具體的」台灣潛在客戶公司——上市櫃或知名的實體企業/醫療集團，聚焦：${focus}。` +
    '\n只列真實存在、你能說出具體公開事實的公司。' +
    EXCLUSIONS +
    '\n' +
    PROFILE_SPEC +
    '\n嚴格只輸出一個 JSON 物件：{"leads":[{...}]}'
  const user = '已在名單中的公司（不要重複）：\n' + JSON.stringify(avoidNames.slice(0, 120))
  const { data, model } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 4000, temperature: 0.5 },
  )
  console.log(`seed (${model}) [${focus.slice(0, 6)}…]: ${(data.leads || []).length}`)
  return Array.isArray(data.leads) ? data.leads : []
}

// ---------- NEWS track ----------
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
    if (r.status === 'fulfilled') all.push(...r.value)
    else console.warn(`RSS ${FEEDS[i].source} failed: ${r.reason?.message || r.reason}`)
  })
  const seen = new Set()
  return all
    .filter((h) => {
      const k = h.title.toLowerCase().replace(/\s+/g, ' ').trim()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 60)
}

async function extractSignals(material) {
  const system =
    IDENTITY +
    '\n任務：從新聞材料中抽取「具體公司」的 AI 導入機會訊號。' +
    '\n訊號類型：轉型意圖（宣布數位轉型/導入 AI/成立數位部門/徵 AI 人才）、擴張（募資/新廠/上市櫃/營收創高）、' +
    '痛點（缺工/成本/良率/法遵壓力）、政府補助/標案（獲 AI 或智慧製造補助、政府 AI 標案）。' +
    '\n' +
    EXCLUSIONS +
    '純股價漲跌不是訊號；沒有具體公司名的產業通論不收。' +
    '\n嚴格只輸出一個 JSON 物件：{"signals":[{"company":"公司名","type":"轉型意圖|擴張|痛點|政府補助/標案","text":"一句話：發生了什麼、為何是機會（含具體數字）","ref":材料編號}]}' +
    '\n沒有合格訊號就輸出空陣列。'
  const user =
    '【新聞材料】\n' + material.map((h, i) => `${i}. [${h.source}] ${h.title}${h.summary ? ' — ' + h.summary.slice(0, 120) : ''}`).join('\n')
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

async function profileNewsLeads(leads) {
  const system =
    IDENTITY +
    '\n任務：為以下公司補齊（或修復）完整的業務開發檔案；部分公司附有新聞訊號，請整合進 whyNow。' +
     EXCLUSIONS +
    '\n' +
    PROFILE_SPEC +
    '\nwhyNow 必須把提供的新聞訊號整合進去。若某公司屬於排除對象，輸出 "skip": true。' +
    '\n嚴格只輸出一個 JSON 物件：{"leads":[{"company":"與輸入相同","skip":false,...}]}'
  const user =
    '【公司與其新聞訊號】\n' +
    JSON.stringify(
      leads.map((l) => ({ company: l.company, signals: l.signals.slice(0, 6).map((s) => ({ date: s.date, type: s.type, text: s.text })) })),
      null,
      1,
    )
  const { data, model } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 4000, temperature: 0.4 },
  )
  console.log(`profile-news (${model}): ${(data.leads || []).length}/${leads.length}`)
  return Array.isArray(data.leads) ? data.leads : []
}

// ---------- main ----------
async function main() {
  const prev = readJson(OUT, {})
  const existing = prev.version === LIST_VERSION && Array.isArray(prev.leads) ? prev.leads : []
  if (prev.version !== LIST_VERSION) console.log('list version changed — starting fresh')

  if (!TOKEN) {
    console.warn('GITHUB_TOKEN not set — keeping previous leads.json.')
    return
  }

  const date = today()
  const cleaned = existing.filter((l) => !isBlocked(normName(l.company)))
  if (cleaned.length !== existing.length) console.log(`dropped ${existing.length - cleaned.length} blocked vendor leads`)
  const byNorm = new Map(cleaned.map((l) => [normName(l.company), l]))
  // leads whose approach was corrupted by an earlier run need a re-profile
  const needsRepair = cleaned.filter((l) => (l.approach || []).some((a) => String(a).includes('object Object')) || (l.approach || []).length < 2)
  if (needsRepair.length) console.log(`${needsRepair.length} leads need profile repair`)

  // ---- SEED ----
  const seedCount = () => [...byNorm.values()].filter((l) => l.origin === 'seed').length
  const bucketOf = (l) => (l.industry === '金融' ? 0 : l.industry === '醫療' ? 1 : l.industry === '製造' ? 2 : 3)
  const bucketCounts = [0, 0, 0, 0]
  for (const l of byNorm.values()) bucketCounts[bucketOf(l)]++
  const thinnest = bucketCounts.indexOf(Math.min(...bucketCounts))
  const batchesToRun = existing.length === 0 ? SEED_FOCI : seedCount() < SEED_TARGET ? [SEED_FOCI[thinnest]] : []
  for (const focus of batchesToRun) {
    try {
      const raw = await seedBatch(focus, [...byNorm.values()].map((l) => l.company))
      for (const p of raw) {
        const norm = normName(p.company)
        if (!norm || byNorm.has(norm)) continue
        const lead = applyProfile(
          {
            id: slugify(p.company),
            company: str(p.company),
            industry: '其他',
            isCoreIndustry: false,
            brief: '',
            whyNow: '',
            products: [],
            approach: [],
            origin: 'seed',
            score: 0,
            scoreReason: '',
            signals: [],
            firstSeen: date,
            lastSeen: date,
          },
          p,
        )
        if (solid(lead)) byNorm.set(norm, lead)
      }
    } catch (e) {
      console.warn(`seed batch failed: ${e.message}`)
    }
    await sleep(1500)
  }

  // ---- NEWS ----
  try {
    const material = await fetchMaterial()
    console.log(`material total: ${material.length}`)
    if (material.length >= 8) {
      const extracted = await extractSignals(material)
      const touchedNew = []
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
            brief: '',
            whyNow: '',
            products: [],
            approach: [],
            origin: 'news',
            score: 0,
            scoreReason: '',
            signals: [],
            firstSeen: date,
            lastSeen: date,
          }
          byNorm.set(norm, lead)
          touchedNew.push(lead)
        }
        const dup = lead.signals.some(
          (x) => x.type === signal.type && (x.text === signal.text || x.text.slice(0, 18) === signal.text.slice(0, 18)),
        )
        if (!dup) {
          lead.signals.unshift(signal)
          lead.signals = lead.signals.slice(0, 12)
          lead.lastSeen = date
          // fresh signal on an existing profiled lead: small boost, capped
          if (lead.score > 0 && !touchedNew.includes(lead)) lead.score = Math.min(100, lead.score + 5)
        }
      }
      // full profile for brand-new news leads + repairs of corrupted profiles
      const toProfile = [...touchedNew, ...needsRepair.filter((l) => !touchedNew.includes(l))]
      for (let i = 0; i < toProfile.length; i += 8) {
        const batch = toProfile.slice(i, i + 8)
        try {
          const profiles = await profileNewsLeads(batch)
          for (const p of profiles) {
            const lead = fuzzyGet(byNorm, p.company)
            if (!lead) continue
            const key = normName(lead.company)
            if (p.skip) {
              byNorm.delete(key)
              continue
            }
            applyProfile(lead, p)
            if (!solid(lead)) byNorm.delete(key)
          }
        } catch (e) {
          console.warn(`profile-news batch failed: ${e.message}`)
          // unprofiled news leads are dropped rather than published half-empty
          batch.forEach((l) => byNorm.delete(normName(l.company)))
        }
        await sleep(1500)
      }
    } else console.warn('too little material — skipping news track')
  } catch (e) {
    console.warn(`news track failed: ${e.message}`)
  }

  const finalLeads = [...byNorm.values()]
    .filter(solid)
    .sort((a, b) => b.score - a.score || (a.lastSeen < b.lastSeen ? 1 : -1))
    .slice(0, MAX_LEADS)

  if (finalLeads.length === 0) {
    console.warn('no solid leads produced — keeping previous file')
    return
  }

  const out = {
    version: LIST_VERSION,
    asOf: date,
    source: '知識庫名單 + 台灣商業媒體 RSS + GitHub Models',
    leads: finalLeads,
    placeholder: false,
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote leads.json: ${finalLeads.length} leads (${finalLeads.filter((l) => l.origin === 'seed').length} seed / ${finalLeads.filter((l) => l.origin === 'news').length} news).`)
}

main()
