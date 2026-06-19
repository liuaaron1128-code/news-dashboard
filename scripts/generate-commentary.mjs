// Generates src/data/commentary.json — an AI daily read of the dashboard.
//
// Uses GitHub Models (free, OpenAI-compatible) authenticated with the workflow's
// built-in GITHUB_TOKEN — no separate API key to manage. Reads that day's news +
// bubble + market-signal data and writes structured commentary.
//
// Degrades gracefully: if GITHUB_TOKEN is unset or the call fails, the existing
// commentary.json is left untouched and the script exits 0 (never breaks the
// daily workflow). Raw HTTPS (global fetch), no npm dependencies — matching
// fetch-market-signals.mjs.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')
const OUT = join(DATA, 'commentary.json')

// GitHub Models config (overridable via env).
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

function buildSummary() {
  const briefings = readJson(join(DATA, 'briefings.json'), [])
  const bubbles = readJson(join(DATA, 'bubble.json'), [])
  const signals = readJson(join(DATA, 'market_signals.json'), {})
  const today = briefings[0] || {}
  const bubble = bubbles[0] || {}

  const topNews = (today.news || [])
    .filter((n) => n.grade === '🔴' || n.grade === '🟠')
    .slice(0, 8)
    .map((n) => `[${n.grade}/${n.category}] ${n.title} — ${n.meaning || n.what || ''}`)

  const headlineSignals = (signals.headline || []).map(
    (h) => `${h.title}: ${h.value} (${h.tag})`,
  )

  return {
    date: today.date || new Date().toISOString().slice(0, 10),
    coreJudgment: today.coreJudgment || '',
    bubble: {
      overallRisk: bubble.overallRisk,
      defconLevel: bubble.defconLevel,
      alertLabel: bubble.alertLabel,
      summary: bubble.summary,
    },
    marketSignals: headlineSignals,
    topNews,
  }
}

async function callModel(summary) {
  const system =
    '你是一位資深總體經濟與市場策略分析師，為一位企業董事長撰寫每日情報摘要。' +
    '根據提供的當日新聞、股市泡沫分數與市場訊號資料，用繁體中文寫出有觀點、白話、可行動的解讀。' +
    '聚焦「今天最該注意什麼」與跨資料的背離或共振訊號。不要重複原始數字，要提供判斷。這不是投資建議。\n' +
    '只輸出一個 JSON 物件，欄位為：headline (string)、topConcern (string)、' +
    'bullets (string 陣列，3-4 點)、crossSignals (string 陣列，0-3 點)、' +
    'confidence ("high"|"medium"|"low")。不要輸出任何其他文字。'

  const body = {
    model: MODEL,
    temperature: 0.4,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content:
          '以下是今天的儀表板資料（JSON）：\n\n' +
          JSON.stringify(summary, null, 2) +
          '\n\n請依規定的 JSON 格式產出今日解讀。',
      },
    ],
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (!content) throw new Error('no content in response')
  return JSON.parse(content)
}

async function main() {
  if (!TOKEN) {
    console.warn('GITHUB_TOKEN not set — keeping existing commentary.json.')
    return
  }
  const summary = buildSummary()
  try {
    const parsed = await callModel(summary)
    const out = {
      date: summary.date,
      generatedAt: new Date().toISOString(),
      model: `GitHub Models (${MODEL})`,
      headline: parsed.headline || '',
      topConcern: parsed.topConcern || '',
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
      crossSignals: Array.isArray(parsed.crossSignals) ? parsed.crossSignals : [],
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    }
    writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
    console.log(`Wrote commentary for ${out.date} via ${MODEL}.`)
  } catch (e) {
    console.error(`Commentary generation failed (keeping previous): ${e.message}`)
    // Non-fatal: leave the previous commentary in place.
  }
}

main()
