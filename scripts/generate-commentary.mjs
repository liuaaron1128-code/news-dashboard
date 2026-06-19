// Generates src/data/commentary.json — an AI daily read of the dashboard.
//
// Reads that day's news + bubble + market-signal data, sends a compact summary
// to the Claude API, and writes structured commentary. Degrades gracefully:
// if ANTHROPIC_API_KEY is unset or the call fails, the existing commentary.json
// is left untouched and the script exits 0 (never breaks the daily workflow).
//
// Raw HTTPS (global fetch) is used deliberately — these scripts carry no npm
// dependencies, matching fetch-market-signals.mjs.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')
const OUT = join(DATA, 'commentary.json')

const MODEL = 'claude-opus-4-8'
const API_KEY = process.env.ANTHROPIC_API_KEY

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

async function callClaude(summary) {
  const system =
    '你是一位資深總體經濟與市場策略分析師，為一位企業董事長撰寫每日情報摘要。' +
    '根據提供的當日新聞、股市泡沫分數與市場訊號資料，用繁體中文寫出有觀點、白話、可行動的解讀。' +
    '聚焦「今天最該注意什麼」與跨資料的背離或共振訊號。不要重複原始數字，要提供判斷。這不是投資建議。'

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      headline: { type: 'string', description: '一句話總結今天的市場/情報重點' },
      topConcern: { type: 'string', description: '今天最該關注或擔心的一件事' },
      bullets: {
        type: 'array',
        items: { type: 'string' },
        description: '3-4 點白話解讀',
      },
      crossSignals: {
        type: 'array',
        items: { type: 'string' },
        description: '跨資料的背離或共振訊號，0-3 點',
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['headline', 'topConcern', 'bullets', 'crossSignals', 'confidence'],
  }

  const body = {
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema },
    },
    system,
    messages: [
      {
        role: 'user',
        content:
          '以下是今天的儀表板資料（JSON）：\n\n' +
          JSON.stringify(summary, null, 2) +
          '\n\n請依 schema 產出今日解讀。',
      },
    ],
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.stop_reason === 'refusal') throw new Error('model refused')

  const textBlock = (json.content || []).find((b) => b.type === 'text')
  if (!textBlock) throw new Error('no text block in response')
  return JSON.parse(textBlock.text)
}

async function main() {
  if (!API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set — keeping existing commentary.json.')
    return
  }
  const summary = buildSummary()
  try {
    const parsed = await callClaude(summary)
    const out = {
      date: summary.date,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      headline: parsed.headline,
      topConcern: parsed.topConcern,
      bullets: parsed.bullets || [],
      crossSignals: parsed.crossSignals || [],
      confidence: parsed.confidence || 'medium',
    }
    writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
    console.log(`Wrote commentary for ${out.date}.`)
  } catch (e) {
    console.error(`Commentary generation failed (keeping previous): ${e.message}`)
    // Non-fatal: leave the previous commentary in place.
  }
}

main()
