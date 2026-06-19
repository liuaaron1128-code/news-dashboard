// Appends one compact daily point to src/data/signals_history.json.
//
// market_signals.json is overwritten on every run, so this file is the only
// place trend / look-back data accumulates. Run AFTER fetch-market-signals.mjs.
// Same-day re-runs overwrite that day's point (idempotent); history is capped.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'src', 'data')
const SIGNALS = join(DATA, 'market_signals.json')
const HISTORY = join(DATA, 'signals_history.json')
const MAX_POINTS = 400 // ~13 months of trading days

const find = (arr, id, key) => {
  const row = (arr || []).find((e) => e.id === id)
  return row && row[key] != null ? row[key] : null
}

function main() {
  let signals
  try {
    signals = JSON.parse(readFileSync(SIGNALS, 'utf8'))
  } catch (e) {
    console.error(`Cannot read ${SIGNALS}: ${e.message}`)
    process.exit(1)
  }

  const point = {
    date: signals.asOf || new Date().toISOString().slice(0, 10),
    us10y: find(signals.bondYields, 'us10y', 'yield'),
    us2y: find(signals.bondYields, 'us2y', 'yield'),
    curve10y2y: find(signals.relativeValue, 'curve10y2y', 'value'),
    erp: find(signals.relativeValue, 'erp', 'value'),
    pe: find(signals.relativeValue, 'pe', 'value'),
    vix: find(signals.riskIndicators, 'vix', 'value'),
    spx: find(signals.equityReturns, 'spx', 'price'),
    gold: find(signals.otherAssets, 'gold', 'price'),
    btc: find(signals.otherAssets, 'btc', 'price'),
    dxy: find(signals.otherAssets, 'dxy', 'price'),
  }

  let history = []
  try {
    history = JSON.parse(readFileSync(HISTORY, 'utf8'))
    if (!Array.isArray(history)) history = []
  } catch {
    history = []
  }

  // Replace same-day point if present, else append; keep chronological order.
  history = history.filter((p) => p.date !== point.date)
  history.push(point)
  history.sort((a, b) => (a.date < b.date ? -1 : 1))
  if (history.length > MAX_POINTS) history = history.slice(history.length - MAX_POINTS)

  mkdirSync(dirname(HISTORY), { recursive: true })
  writeFileSync(HISTORY, JSON.stringify(history, null, 2) + '\n')
  console.log(`Appended ${point.date}; history now ${history.length} points.`)
}

main()
