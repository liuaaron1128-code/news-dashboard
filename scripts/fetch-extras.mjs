// Fetches supplementary data sources and writes:
//   src/data/taiwan_flows.json  — TWSE 三大法人買賣超 (institutional flows)
//   src/data/sentiment.json     — CNN Fear & Greed index
//
// Every source degrades gracefully: a failure keeps the previous file's data
// (only the asOf/placeholder flags change), never aborting the workflow.
// No npm deps — Node 20+ global fetch, matching fetch-market-signals.mjs.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}
const round = (n, d = 1) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d)
const today = () => new Date().toISOString().slice(0, 10)

// ---- TWSE 三大法人買賣超 ----
async function fetchTaiwanFlows() {
  const prev = readJson(join(DATA, 'taiwan_flows.json'), { items: [] })
  try {
    const res = await fetch('https://openapi.twse.com.tw/v1/fund/BFI82U', {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = await res.json()
    // Sum the net (買賣差額) per institution type. Names vary slightly; bucket
    // by keyword so 自營商(自行買賣)+自營商(避險) collapse into one dealer figure.
    const buckets = { foreign: 0, trust: 0, dealer: 0 }
    let seen = false
    for (const r of rows || []) {
      const name = r['單位名稱'] || r['name'] || ''
      const net = Number(r['買賣差額'] ?? r['差額'])
      if (!Number.isFinite(net)) continue
      seen = true
      if (name.includes('外資')) buckets.foreign += net
      else if (name.includes('投信')) buckets.trust += net
      else if (name.includes('自營')) buckets.dealer += net
    }
    if (!seen) throw new Error('no parseable rows')
    const toYi = (v) => round(v / 1e8, 1) // 元 -> 億元
    const out = {
      asOf: today(),
      source: 'TWSE OpenAPI',
      date: today(),
      items: [
        { id: 'foreign', label: '外資及陸資', netBuy: toYi(buckets.foreign) },
        { id: 'trust', label: '投信', netBuy: toYi(buckets.trust) },
        { id: 'dealer', label: '自營商', netBuy: toYi(buckets.dealer) },
      ],
    }
    writeFileSync(join(DATA, 'taiwan_flows.json'), JSON.stringify(out, null, 2) + '\n')
    console.log(`taiwan flows: foreign ${out.items[0].netBuy} / trust ${out.items[1].netBuy} / dealer ${out.items[2].netBuy} (億)`)
  } catch (e) {
    console.warn(`taiwan flows failed (keeping previous): ${e.message}`)
    writeFileSync(
      join(DATA, 'taiwan_flows.json'),
      JSON.stringify({ ...prev, asOf: today() }, null, 2) + '\n',
    )
  }
}

// ---- CNN Fear & Greed ----
async function fetchSentiment() {
  const prev = readJson(join(DATA, 'sentiment.json'), {})
  try {
    const res = await fetch(
      `https://production.dataviz.cnn.com/index/fearandgreed/graphdata/${today()}`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' } },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const fg = json?.fear_and_greed
    if (!fg || fg.score == null) throw new Error('no fear_and_greed data')
    const out = {
      asOf: today(),
      source: 'CNN Fear & Greed',
      score: round(Number(fg.score), 0),
      rating: fg.rating || null,
      previousClose: round(Number(fg.previous_close), 0),
      weekAgo: round(Number(fg.previous_1_week), 0),
    }
    writeFileSync(join(DATA, 'sentiment.json'), JSON.stringify(out, null, 2) + '\n')
    console.log(`sentiment: ${out.score} (${out.rating})`)
  } catch (e) {
    console.warn(`sentiment failed (keeping previous): ${e.message}`)
    writeFileSync(
      join(DATA, 'sentiment.json'),
      JSON.stringify({ ...prev, asOf: today() }, null, 2) + '\n',
    )
  }
}

async function main() {
  await Promise.allSettled([fetchTaiwanFlows(), fetchSentiment()])
}

main()
