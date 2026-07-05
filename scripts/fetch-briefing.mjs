// Generates the daily news briefing and upserts it into src/data/briefings.json.
//
// Fully automated, no paid keys:
//   - Market snapshot: real numbers from market_signals.json + signals_history.json
//     (already fetched earlier in the workflow).
//   - News: ~20 free RSS feeds (global markets / macro / geopolitics / tech /
//     crypto / Taiwan), then a multi-stage GitHub Models pipeline (built-in
//     GITHUB_TOKEN, free):
//       stage 1  select & grade the 12-14 stories that matter to this reader
//       stage 2  write each story IN DEPTH in small batches (fits output limits)
//       stage 3  core judgment + weekly events
//
// Depth contract per item (enforced by prompt):
//   🔴 meaning ≥4 sentences (why now / short-term mechanism / structural
//   meaning / likely misread), 🟠 ≥3, 🟡 ≥2; business & investment ≥2 concrete
//   sentences or "—"; ≥2 triggers; ≥2 watchpoints; bold the numbers; NEVER
//   invent numbers not present in the source material.
//
// Degrades gracefully: if feeds or the model fail, briefings.json is left
// untouched (never blanked). Skips if today's entry already exists, unless
// FORCE_BRIEFING=1 (set on push deploys so pipeline improvements apply same-day).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')
const OUT = join(DATA, 'briefings.json')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ENDPOINT =
  process.env.GITHUB_MODELS_ENDPOINT || 'https://models.github.ai/inference/chat/completions'
const MODEL_PRIMARY = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o'
const MODEL_FALLBACK = 'openai/gpt-4o-mini'
const TOKEN = process.env.GITHUB_TOKEN
const FORCE = process.env.FORCE_BRIEFING === '1'

const readJson = (p, fb) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fb
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- Taipei date ----
function taipeiToday() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const wd = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][now.getUTCDay()]
  return { date: `${y}-${m}-${d}`, weekday: wd, isWeekend: now.getUTCDay() === 0 || now.getUTCDay() === 6 }
}

// ---- Market snapshot from already-fetched real data ----
function buildSnapshot() {
  const sig = readJson(join(DATA, 'market_signals.json'), {})
  const hist = readJson(join(DATA, 'signals_history.json'), [])
  const findEq = (id) => (sig.equityReturns || []).find((e) => e.id === id)
  const findOther = (id) => (sig.otherAssets || []).find((o) => o.id === id)
  const findYield = (id) => (sig.bondYields || []).find((b) => b.id === id)
  const last = hist[hist.length - 1] || {}
  const prev = hist[hist.length - 2] || {}
  const pctChg = (k) => (last[k] != null && prev[k] != null && prev[k] !== 0 ? (last[k] / prev[k] - 1) * 100 : null)
  const fmtPct = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)
  const price = (row, key = 'price') => (row && row[key] != null ? row[key] : null)
  const num = (v) => (v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: v < 100 ? 2 : 0 }))

  const spxChg = pctChg('spx')
  const btcChg = pctChg('btc')
  const y10 = last.us10y != null && prev.us10y != null ? (last.us10y - prev.us10y) * 100 : null

  const twii = price(findEq('twii'))
  const spx = price(findEq('spx')) ?? last.spx
  const ndq = price(findEq('ndq'))
  const usdtwd = price(findOther('usdtwd'))
  const btc = price(findOther('btc')) ?? last.btc
  const eth = price(findOther('eth'))
  const us10y = (findYield('us10y') && findYield('us10y').yield) ?? last.us10y

  return [
    { label: '台股加權指數', value: twii == null ? '—' : num(twii), change: '—', positive: null },
    { label: 'S&P 500', value: spx == null ? '—' : num(spx), change: fmtPct(spxChg), positive: spxChg == null ? null : spxChg >= 0 },
    { label: 'NASDAQ', value: ndq == null ? '—' : num(ndq), change: '—', positive: null },
    { label: '美元/台幣', value: usdtwd == null ? '—' : usdtwd.toFixed(2), change: '—', positive: null },
    { label: 'BTC', value: btc == null ? '—' : '$' + num(btc), change: fmtPct(btcChg), positive: btcChg == null ? null : btcChg >= 0 },
    { label: 'ETH', value: eth == null ? '—' : '$' + num(eth), change: '—', positive: null },
    { label: '美10年債', value: us10y == null ? '—' : `${us10y}%`, change: y10 == null ? '—' : `${y10 >= 0 ? '+' : ''}${Math.round(y10)} bps`, positive: null },
  ]
}

// ---- RSS ----
const FEEDS = [
  // Global markets / macro
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
  { url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html', source: 'CNBC' },
  { url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', source: 'CNBC Economy' },
  { url: 'https://www.cnbc.com/id/10000115/device/rss/rss.html', source: 'CNBC Real Estate' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', source: 'WSJ Markets' },
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance' },
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'Fed 官方' },
  // Geopolitics
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
  // Tech / AI
  { url: 'https://techcrunch.com/feed/', source: 'TechCrunch' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'Ars Technica' },
  { url: 'https://www.engadget.com/rss.xml', source: 'Engadget' },
  // Crypto
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
  { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph' },
  // Taiwan
  { url: 'https://feeds.feedburner.com/rsscna/finance', source: '中央社財經' },
  { url: 'https://feeds.feedburner.com/rsscna/technology', source: '中央社科技' },
  { url: 'https://feeds.feedburner.com/rsscna/politics', source: '中央社政治' },
  { url: 'https://technews.tw/feed/', source: 'TechNews' },
  { url: 'https://www.inside.com.tw/feed/rss', source: 'INSIDE' },
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

function parseRss(xml, source, max = 5) {
  const items = []
  const blocks = xml.split(/<item[\s>]/i).slice(1)
  const clean = (s) => decodeEntities((s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  for (const b of blocks.slice(0, max)) {
    const t = b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)
    const d = b.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
    if (!t) continue
    const title = clean(t[1])
    if (title) items.push({ source, title, summary: clean(d && d[1]).slice(0, 300) })
  }
  return items
}

async function fetchHeadlines() {
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const res = await fetch(f.url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseRss(await res.text(), f.source, 5)
    }),
  )
  const all = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      all.push(...r.value)
      console.log(`RSS ${FEEDS[i].source}: ${r.value.length}`)
    } else {
      console.warn(`RSS ${FEEDS[i].source} failed: ${r.reason?.message || r.reason}`)
    }
  })
  return all.slice(0, 80)
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
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
            messages,
          }),
          signal: AbortSignal.timeout(120000),
        })
        if (!res.ok) {
          const body = (await res.text()).slice(0, 200)
          const retryable = res.status === 429 || res.status >= 500
          const err = new Error(`HTTP ${res.status}: ${body}`)
          if (!retryable) {
            lastErr = err
            break // this model won't work — try the fallback model
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

const CATS = ['宏觀政策', '地緣政治', '市場動態', 'AI科技', '台灣政策', '加密貨幣', '房地產', '客戶產業']
const CAT_SET = new Set(CATS)
const GRADE_SET = new Set(['🔴', '🟠', '🟡'])

const AUDIENCE =
  '讀者是一位台灣 AI 顧問公司董事長（Microsoft 核心夥伴：Azure OpenAI/Copilot/Power Platform，客戶為金融、醫療、製造業）' +
  '兼個人投資人（台股基金、全球/美股基金、加密貨幣 BTC/ETH、房地產，房地產對台灣利率與信用管制最敏感）。' +
  '你是他的首席情報顧問，不是新聞整理員：要下明確方向性判斷，不寫「可能有影響」這種空話，每一句都要有資訊量。'

// stage 1 — select & grade
async function selectStories(headlines, dateInfo) {
  const system =
    AUDIENCE +
    '\n任務：從新聞標題清單中選出今天最值得他知道的 12-14 個「故事」（同一事件的多則標題合併為一個故事）。' +
    `\n分類只能用：${CATS.join('、')}。盡量讓 8 個分類都有覆蓋，每類至少 1 個（材料中確實沒有的分類可略）。` +
    '\n評級：🔴 影響重大需立即理解（2-4 個）、🟠 有明確業務或投資影響（6-8 個）、🟡 早期信號（2-4 個）。' +
    '\n嚴格只輸出一個 JSON 物件：{"stories":[{"refs":[標題編號,...],"category":"分類","grade":"🔴|🟠|🟡","angle":"一句話：這個故事對讀者為何重要"}]}' +
    '\n不要選內容農場式、與讀者無關的軟性新聞。'
  const user =
    `今天是 ${dateInfo.date}（${dateInfo.weekday}）${dateInfo.isWeekend ? '，週末休市日，可偏向回顧與前瞻選題' : ''}。\n\n【新聞標題清單】\n` +
    headlines.map((h, i) => `${i}. [${h.source}] ${h.title}`).join('\n')
  const { data, model } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 1500, temperature: 0.3 },
  )
  console.log(`stage1 (${model}): ${(data.stories || []).length} stories selected`)
  return (Array.isArray(data.stories) ? data.stories : [])
    .filter((s) => Array.isArray(s.refs) && s.refs.some((r) => headlines[r]) && CAT_SET.has(s.category) && GRADE_SET.has(s.grade))
    .slice(0, 14)
}

// stage 2 — write each story in depth, in small batches
async function writeBatch(stories, headlines, snapshot, dateInfo) {
  const system =
    AUDIENCE +
    '\n任務：把給定的每個故事，寫成情報簡報條目。**深度要求（務必遵守）**：' +
    '\n- title：精練、有觀點，點出事件本質，不是照抄標題。' +
    '\n- background：1-2 句前因脈絡。' +
    '\n- what：2-3 句，具體、有主詞，材料中的關鍵數字用 **粗體**。**嚴禁編造材料中沒有的數字**；材料沒有數字就寫定性事實。' +
    '\n- meaning：這是最重要的欄位。🔴 至少 4 句，依序涵蓋 (1)為何現在發生 (2)短期影響機制 (3)中期結構性意義 (4)市場可能的錯誤解讀；🟠 至少 3 句含具體推論；🟡 至少 2 句說明為何值得記錄與若成真的含義。' +
    '\n- business：對他的 AI 顧問公司（Microsoft 生態、金融/醫療/製造客戶）的具體含義，至少 2 句；真的無關才填 "—"。' +
    '\n- investment：至少 2 句，必須點名具體資產類別（台股/美股/科技股/加密/房地產/債券）與方向；真的無關才填 "—"。' +
    '\n- triggers：至少 2 個「若 X → 則 Y」的具體條件。' +
    '\n- watchpoints：至少 2 個具體指標或日期。' +
    '\n- sources：用材料中的媒體名稱。' +
    '\n每個故事都要利用「所有」給你的相關標題與摘要作為素材，交叉整合而非只看一則。' +
    '\n嚴格只輸出一個 JSON 物件：{"items":[{"category":"...","grade":"...","title":"...","background":"...","what":"...","meaning":"...","business":"...","investment":"...","triggers":["...","..."],"watchpoints":["...","..."],"sources":["..."]}]}'
  const material = stories.map((s, i) => ({
    story: i + 1,
    category: s.category,
    grade: s.grade,
    angle: s.angle,
    materials: s.refs.filter((r) => headlines[r]).map((r) => headlines[r]),
  }))
  const user =
    `今天是 ${dateInfo.date}（${dateInfo.weekday}）。\n\n【今日市場快照（真實數據，可引用）】\n` +
    JSON.stringify(snapshot) +
    '\n\n【要撰寫的故事與素材】\n' +
    JSON.stringify(material, null, 1) +
    '\n\n請依深度要求撰寫每一個故事，輸出 items 陣列（順序對應）。'
  const { data, model } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 4000, temperature: 0.4 },
  )
  console.log(`stage2 (${model}): ${(data.items || []).length}/${stories.length} items written`)
  return Array.isArray(data.items) ? data.items : []
}

// stage 3 — core judgment + weekly events
async function writeCore(items, snapshot, dateInfo) {
  const system =
    AUDIENCE +
    '\n任務：根據今日已完成的簡報條目與市場快照，寫出：' +
    '\n1. coreJudgment：4-6 句今日核心判斷，涵蓋市場基調、最大宏觀驅動力、業務面關鍵訊息、投資面方向性結論。要有觀點、引用具體數字。' +
    '\n2. weeklyEvents：3-5 個未來一至四週的關鍵觀察事件（已知：7 月中台積電法說會、07/28-29 FOMC 利率決議；可依材料補充其他）。' +
    '\n嚴格只輸出 {"coreJudgment":"...","weeklyEvents":[{"date":"MM/DD 或描述","event":"...","meaning":"一句話意義"}]}'
  const user =
    `今天是 ${dateInfo.date}（${dateInfo.weekday}）。\n\n【市場快照】\n` +
    JSON.stringify(snapshot) +
    '\n\n【今日條目】\n' +
    items.map((n) => `${n.grade}[${n.category}] ${n.title}：${(n.meaning || '').slice(0, 80)}`).join('\n')
  const { data, model } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 1200, temperature: 0.4 },
  )
  console.log(`stage3 (${model}): core judgment written`)
  return data
}

async function main() {
  const dateInfo = taipeiToday()
  const { date, weekday } = dateInfo
  const briefings = readJson(OUT, [])

  const existing = briefings.find((b) => b.date === date)
  if (!FORCE && existing && (existing.news || []).length >= 5) {
    console.log(`Briefing for ${date} already present (${existing.news.length} items) — skipping (set FORCE_BRIEFING=1 to regenerate).`)
    return
  }
  if (!TOKEN) {
    console.warn('GITHUB_TOKEN not set — skipping briefing generation.')
    return
  }

  const snapshot = buildSnapshot()
  const headlines = await fetchHeadlines()
  console.log(`headlines total: ${headlines.length}`)
  if (headlines.length < 10) {
    console.warn('Too few headlines — leaving briefings.json unchanged.')
    return
  }

  let stories
  try {
    stories = await selectStories(headlines, dateInfo)
  } catch (e) {
    console.error(`stage1 failed (leaving briefings.json unchanged): ${e.message}`)
    return
  }
  if (stories.length < 4) {
    console.warn(`Only ${stories.length} stories selected — leaving briefings.json unchanged.`)
    return
  }

  const rawItems = []
  for (let i = 0; i < stories.length; i += 4) {
    const batch = stories.slice(i, i + 4)
    try {
      const items = await writeBatch(batch, headlines, snapshot, dateInfo)
      // pair by position; fall back to batch metadata for category/grade
      items.forEach((it, j) => {
        const meta = batch[j] || batch[0]
        rawItems.push({ ...it, category: CAT_SET.has(it.category) ? it.category : meta.category, grade: GRADE_SET.has(it.grade) ? it.grade : meta.grade })
      })
    } catch (e) {
      console.warn(`stage2 batch ${i / 4 + 1} failed: ${e.message}`)
    }
    await sleep(1500)
  }

  const news = rawItems
    .filter((n) => n && n.title && n.meaning && String(n.meaning).length >= 40)
    .map((n, i) => ({
      id: `${date}-${String(i + 1).padStart(3, '0')}`,
      grade: n.grade,
      category: n.category,
      title: String(n.title),
      background: String(n.background || ''),
      what: String(n.what || ''),
      meaning: String(n.meaning || ''),
      business: String(n.business || '—'),
      investment: String(n.investment || '—'),
      triggers: Array.isArray(n.triggers) ? n.triggers.map(String) : [],
      watchpoints: Array.isArray(n.watchpoints) ? n.watchpoints.map(String) : [],
      sources: Array.isArray(n.sources) && n.sources.length ? n.sources.map(String) : ['RSS'],
    }))

  if (news.length < 4) {
    console.warn(`Only ${news.length} deep items survived — leaving briefings.json unchanged.`)
    return
  }

  let core = { coreJudgment: '', weeklyEvents: [] }
  try {
    core = await writeCore(news, snapshot, dateInfo)
  } catch (e) {
    console.warn(`stage3 failed (using empty core judgment): ${e.message}`)
  }

  const entry = {
    date,
    weekday,
    coreJudgment: String(core.coreJudgment || ''),
    sourceCount: headlines.length,
    marketSnapshot: snapshot,
    news,
    weeklyEvents: (Array.isArray(core.weeklyEvents) ? core.weeklyEvents : [])
      .filter((e) => e && e.event)
      .map((e) => ({ date: String(e.date || ''), event: String(e.event), meaning: String(e.meaning || '') })),
  }

  const combined = [entry, ...briefings.filter((b) => b.date !== date)].slice(0, 30)
  writeFileSync(OUT, JSON.stringify(combined, null, 2) + '\n')
  console.log(`Wrote briefing ${date}: ${news.length} deep items from ${headlines.length} headlines across ${FEEDS.length} feeds.`)
}

main()
