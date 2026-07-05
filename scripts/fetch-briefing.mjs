// Generates the daily news briefing and upserts it into src/data/briefings.json.
//
// Fully automated, no paid keys:
//   - Market snapshot: real numbers from market_signals.json + signals_history.json
//     (already fetched earlier in the workflow).
//   - News: free RSS feeds (business / tech / crypto / Taiwan), summarised and
//     analysed into the dashboard's briefing schema by GitHub Models
//     (built-in GITHUB_TOKEN, free).
//
// Degrades gracefully: if RSS all fail or GitHub Models fails, briefings.json is
// left untouched (never blanked). Skips generation if today's entry already
// exists with real content, so repeated pushes don't regenerate. No npm deps.

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
const MODEL = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o-mini'
const TOKEN = process.env.GITHUB_TOKEN

const readJson = (p, fb) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fb
  }
}

// ---- Taipei date ----
function taipeiToday() {
  // Compute Taipei (UTC+8) date without pulling in tz libs.
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const wd = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][now.getUTCDay()]
  return { date: `${y}-${m}-${d}`, weekday: wd }
}

// ---- Market snapshot from already-fetched real data ----
function buildSnapshot() {
  const sig = readJson(join(DATA, 'market_signals.json'), {})
  const hist = readJson(join(DATA, 'signals_history.json'), [])
  const findEq = (id) => (sig.equityReturns || []).find((e) => e.id === id) || (sig.sectors || []).find((e) => e.id === id)
  const findOther = (id) => (sig.otherAssets || []).find((o) => o.id === id)
  const findYield = (id) => (sig.bondYields || []).find((b) => b.id === id)
  const last = hist[hist.length - 1] || {}
  const prev = hist[hist.length - 2] || {}
  const pctChg = (k) => (last[k] != null && prev[k] != null && prev[k] !== 0 ? ((last[k] / prev[k] - 1) * 100) : null)
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
function parseRss(xml, source, max = 5) {
  const items = []
  const blocks = xml.split(/<item[\s>]/i).slice(1)
  for (const b of blocks.slice(0, max)) {
    const t = b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)
    const d = b.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)
    if (!t) continue
    const clean = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
    const title = clean(t[1])
    if (title) items.push({ source, title, summary: clean(d && d[1]).slice(0, 180) })
  }
  return items
}

async function fetchHeadlines() {
  const feeds = [
    { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
    { url: 'https://techcrunch.com/feed/', source: 'TechCrunch' },
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
    { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance' },
    { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'Ars Technica' },
    { url: 'https://feeds.feedburner.com/rsscna/finance', source: '中央社財經' },
    { url: 'https://www.inside.com.tw/feed/rss', source: 'INSIDE' },
  ]
  const all = []
  for (const f of feeds) {
    try {
      const res = await fetch(f.url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const xml = await res.text()
      const items = parseRss(xml, f.source, 6)
      all.push(...items)
      console.log(`RSS ${f.source}: ${items.length}`)
    } catch (e) {
      console.warn(`RSS ${f.source} failed: ${e.message}`)
    }
  }
  return all.slice(0, 40)
}

// ---- GitHub Models → briefing ----
async function generate(headlines, snapshot, dateInfo) {
  const system =
    '你是服務於一位董事長（台灣 AI 顧問公司負責人＋個人投資人：台股/全球/美股基金、加密貨幣、房地產）的首席情報顧問。' +
    '根據提供的「今日市場快照（真實數據）」與「新聞標題清單」，用繁體中文寫出有觀點、可行動的每日情報簡報。你是顧問不是整理員，要下明確方向性判斷。\n' +
    '嚴格只輸出一個 JSON 物件，結構如下（型別務必正確）：\n' +
    '{\n' +
    '  "coreJudgment": "4-6 句今日核心判斷",\n' +
    '  "news": [ { "id": "YYYY-MM-DD-001 遞增", "grade": "🔴或🟠或🟡", "category": "宏觀政策|地緣政治|市場動態|AI科技|台灣政策|加密貨幣|房地產|客戶產業 其中之一", "title": "標題", "background": "背景", "what": "發生了什麼(具體、有數字)", "meaning": "真正的意義(判斷)", "business": "業務視角(無關填—)", "investment": "投資視角(無關填—)", "triggers": ["觸發條件1","觸發條件2"], "watchpoints": ["觀察點1","觀察點2"], "sources": ["來源"] } ],\n' +
    '  "weeklyEvents": [ { "date": "MM/DD 或 07/28-29", "event": "事件", "meaning": "意義" } ]\n' +
    '}\n' +
    'news 需 10-14 則，盡量涵蓋 8 個 category、每類至少 1 則；grade 分佈約 🔴2-4、🟠6-8、🟡2-4。' +
    '只根據提供的新聞標題與市場數據撰寫，不要杜撰不存在的事件或數字。若當天是週末/假日、新聞稀薄，就寫成「週末回顧＋下週前瞻」，news 可少於 10 則但仍需有觀點。不要輸出 JSON 以外的文字。'

  const user =
    `【今日】${dateInfo.date}（${dateInfo.weekday}）\n\n` +
    '【今日市場快照（真實數據，請在 coreJudgment/news 引用）】\n' +
    JSON.stringify(snapshot, null, 2) +
    '\n\n【新聞標題清單（來自各家 RSS，據此判斷與取材）】\n' +
    headlines.map((h, i) => `${i + 1}. [${h.source}] ${h.title}${h.summary ? ' — ' + h.summary : ''}`).join('\n') +
    '\n\n請依規定 JSON 結構產出今日簡報。'

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) throw new Error('no content')
  return JSON.parse(content)
}

const CATS = new Set(['宏觀政策', '地緣政治', '市場動態', 'AI科技', '台灣政策', '加密貨幣', '房地產', '客戶產業'])
const GRADES = new Set(['🔴', '🟠', '🟡'])

async function main() {
  const { date, weekday } = taipeiToday()
  const briefings = readJson(OUT, [])

  const existing = briefings.find((b) => b.date === date)
  if (existing && (existing.news || []).length >= 5) {
    console.log(`Briefing for ${date} already present (${existing.news.length} items) — skipping.`)
    return
  }
  if (!TOKEN) {
    console.warn('GITHUB_TOKEN not set — skipping briefing generation.')
    return
  }

  const snapshot = buildSnapshot()

  let headlines = []
  try {
    headlines = await fetchHeadlines()
  } catch (e) {
    console.warn(`headlines failed: ${e.message}`)
  }
  if (headlines.length === 0) {
    console.warn('No headlines fetched — leaving briefings.json unchanged.')
    return
  }

  let ai
  try {
    ai = await generate(headlines, snapshot, { date, weekday })
  } catch (e) {
    console.error(`generation failed (leaving briefings.json unchanged): ${e.message}`)
    return
  }

  const news = (Array.isArray(ai.news) ? ai.news : [])
    .filter((n) => n && n.title && GRADES.has(n.grade) && CATS.has(n.category))
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

  if (news.length < 3) {
    console.warn(`Only ${news.length} valid news items — leaving briefings.json unchanged.`)
    return
  }

  const entry = {
    date,
    weekday,
    coreJudgment: String(ai.coreJudgment || ''),
    sourceCount: headlines.length,
    marketSnapshot: snapshot,
    news,
    weeklyEvents: (Array.isArray(ai.weeklyEvents) ? ai.weeklyEvents : [])
      .filter((e) => e && e.event)
      .map((e) => ({ date: String(e.date || ''), event: String(e.event), meaning: String(e.meaning || '') })),
  }

  const combined = [entry, ...briefings.filter((b) => b.date !== date)].slice(0, 30)
  writeFileSync(OUT, JSON.stringify(combined, null, 2) + '\n')
  console.log(`Wrote briefing ${date}: ${news.length} news items from ${headlines.length} headlines.`)
}

main()
