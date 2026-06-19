// Fetches global market "annualized return" signals (bond yields + equity CAGRs
// + commodities/FX) from the Yahoo Finance chart API (no API key required) and
// writes src/data/market_signals.json. Run by .github/workflows/market-signals.yml.
//
// No external dependencies — uses Node 20+ global fetch.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'market_signals.json')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// US Treasury curve (Yahoo quotes these directly as the yield in percent).
const BONDS = [
  { id: 'us3m', region: '美國', name: '3 個月國庫券', symbol: '^IRX' },
  { id: 'us5y', region: '美國', name: '5 年期公債', symbol: '^FVX' },
  { id: 'us10y', region: '美國', name: '10 年期公債', symbol: '^TNX' },
  { id: 'us30y', region: '美國', name: '30 年期公債', symbol: '^TYX' },
]

// Global equity indices — we report annualized (CAGR) returns.
const INDICES = [
  { id: 'spx', region: '美國', name: 'S&P 500', symbol: '^GSPC' },
  { id: 'ndq', region: '美國', name: 'Nasdaq', symbol: '^IXIC' },
  { id: 'dji', region: '美國', name: '道瓊工業', symbol: '^DJI' },
  { id: 'sx5e', region: '歐元區', name: 'Euro Stoxx 50', symbol: '^STOXX50E' },
  { id: 'dax', region: '德國', name: 'DAX', symbol: '^GDAXI' },
  { id: 'ftse', region: '英國', name: 'FTSE 100', symbol: '^FTSE' },
  { id: 'cac', region: '法國', name: 'CAC 40', symbol: '^FCHI' },
  { id: 'n225', region: '日本', name: '日經 225', symbol: '^N225' },
  { id: 'hsi', region: '香港', name: '恒生指數', symbol: '^HSI' },
  { id: 'ssec', region: '中國', name: '上證綜指', symbol: '000001.SS' },
  { id: 'twii', region: '台灣', name: '台股加權', symbol: '^TWII' },
  { id: 'kospi', region: '南韓', name: 'KOSPI', symbol: '^KS11' },
  { id: 'sensex', region: '印度', name: 'Sensex', symbol: '^BSESN' },
  { id: 'asx', region: '澳洲', name: 'ASX 200', symbol: '^AXJO' },
  { id: 'tsx', region: '加拿大', name: 'S&P/TSX', symbol: '^GSPTSE' },
  { id: 'bvsp', region: '巴西', name: 'Bovespa', symbol: '^BVSP' },
]

const OTHERS = [
  { id: 'gold', name: '黃金', icon: '🥇', symbol: 'GC=F' },
  { id: 'wti', name: 'WTI 原油', icon: '🛢️', symbol: 'CL=F' },
  { id: 'btc', name: '比特幣', icon: '₿', symbol: 'BTC-USD' },
  { id: 'dxy', name: '美元指數', icon: '💵', symbol: 'DX-Y.NYB' },
  { id: 'usdtwd', name: '美元/台幣', icon: '🇹🇼', symbol: 'TWD=X' },
]

async function fetchChart(symbol) {
  const path = `v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y`
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']
  let lastErr
  for (const host of hosts) {
    try {
      const res = await fetch(`https://${host}/${path}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`)
        continue
      }
      const json = await res.json()
      const r = json?.chart?.result?.[0]
      const ts = r?.timestamp
      const close = r?.indicators?.quote?.[0]?.close
      if (!ts || !close) {
        lastErr = new Error('no data')
        continue
      }
      const series = []
      for (let i = 0; i < ts.length; i++) {
        if (close[i] != null) series.push({ date: new Date(ts[i] * 1000), close: close[i] })
      }
      if (series.length < 2) {
        lastErr = new Error('series too short')
        continue
      }
      return series
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('fetch failed')
}

// Find the close nearest to `target` date (within the series).
function closeNearest(series, target) {
  let best = null
  let bestDiff = Infinity
  for (const p of series) {
    const diff = Math.abs(p.date.getTime() - target.getTime())
    if (diff < bestDiff) {
      bestDiff = diff
      best = p
    }
  }
  return best
}

function yearsAgo(date, n) {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() - n)
  return d
}

function pct(from, to) {
  if (from == null || to == null || from === 0) return null
  return ((to / from - 1) * 100)
}

function cagr(from, to, years) {
  if (from == null || to == null || from <= 0 || to <= 0) return null
  return ((to / from) ** (1 / years) - 1) * 100
}

function round(n, d = 2) {
  if (n == null || Number.isNaN(n)) return null
  const f = 10 ** d
  return Math.round(n * f) / f
}

function returnsFor(series) {
  const latest = series[series.length - 1]
  const prev = series[series.length - 2]
  // Year-to-date: first trading day of the latest data's calendar year.
  const year = latest.date.getUTCFullYear()
  const firstOfYear = series.find((p) => p.date.getUTCFullYear() === year)
  const c1y = closeNearest(series, yearsAgo(latest.date, 1))
  const c3y = closeNearest(series, yearsAgo(latest.date, 3))
  const c5y = closeNearest(series, yearsAgo(latest.date, 5))
  // Only treat a horizon close as valid if we actually have data near it.
  const hasYears = (n) => series[0].date <= yearsAgo(latest.date, n - 0.1)
  return {
    price: round(latest.close, latest.close < 50 ? 4 : 2),
    prevClose: prev.close,
    ytd: round(firstOfYear ? pct(firstOfYear.close, latest.close) : null, 1),
    return1y: round(hasYears(1) ? pct(c1y.close, latest.close) : null, 1),
    cagr3y: round(hasYears(3) ? cagr(c3y.close, latest.close, 3) : null, 1),
    cagr5y: round(hasYears(5) ? cagr(c5y.close, latest.close, 5) : null, 1),
  }
}

function percentile(series, value) {
  const n = series.length
  const below = series.filter((p) => p.close <= value).length
  return Math.round((below / n) * 100)
}

function yieldSignal(p) {
  if (p >= 90) return '極高'
  if (p >= 75) return '偏高'
  if (p <= 10) return '極低'
  if (p <= 25) return '偏低'
  return '中性'
}

async function main() {
  const bondYields = []
  for (const b of BONDS) {
    try {
      const s = await fetchChart(b.symbol)
      const latest = s[s.length - 1]
      const prev = s[s.length - 2]
      const p = percentile(s, latest.close)
      bondYields.push({
        id: b.id,
        region: b.region,
        name: b.name,
        yield: round(latest.close, 2),
        changeBps: round((latest.close - prev.close) * 100, 0),
        percentile5y: p,
        signal: yieldSignal(p),
      })
      console.log(`bond ${b.symbol}: ${latest.close} (p${p})`)
    } catch (e) {
      console.warn(`bond ${b.symbol} failed: ${e.message}`)
    }
  }

  const equityReturns = []
  for (const idx of INDICES) {
    try {
      const s = await fetchChart(idx.symbol)
      const r = returnsFor(s)
      equityReturns.push({
        id: idx.id,
        region: idx.region,
        name: idx.name,
        price: r.price,
        ytd: r.ytd,
        return1y: r.return1y,
        cagr3y: r.cagr3y,
        cagr5y: r.cagr5y,
      })
      console.log(`index ${idx.symbol}: ${r.price} (5y CAGR ${r.cagr5y})`)
    } catch (e) {
      console.warn(`index ${idx.symbol} failed: ${e.message}`)
    }
  }

  const otherAssets = []
  for (const o of OTHERS) {
    try {
      const s = await fetchChart(o.symbol)
      const r = returnsFor(s)
      otherAssets.push({
        id: o.id,
        name: o.name,
        icon: o.icon,
        price: r.price,
        ytd: r.ytd,
        return1y: r.return1y,
        cagr5y: r.cagr5y,
      })
      console.log(`other ${o.symbol}: ${r.price}`)
    } catch (e) {
      console.warn(`other ${o.symbol} failed: ${e.message}`)
    }
  }

  if (bondYields.length === 0 && equityReturns.length === 0) {
    throw new Error('No data fetched for any symbol — aborting without overwriting.')
  }

  // Rule-based headline signals (no LLM) for the lead of the tab.
  const headline = []
  const us10y = bondYields.find((b) => b.id === 'us10y')
  if (us10y) {
    const level = us10y.percentile5y >= 75 ? 'high' : us10y.percentile5y <= 25 ? 'low' : 'neutral'
    const dir = level === 'high' ? '偏高' : level === 'low' ? '偏低' : '中性'
    headline.push({
      id: 'us10y',
      icon: '🏦',
      title: '美國 10 年期公債殖利率',
      value: `${us10y.yield}%`,
      tag: us10y.signal,
      tagLevel: level,
      detail:
        `處於近 5 年區間第 ${us10y.percentile5y} 百分位，無風險年化報酬${dir}。` +
        (level === 'high'
          ? '股票須提供更高的預期報酬才划算，對成長股與長天期資產形成壓力。'
          : level === 'low'
          ? '資金成本低，有利風險性資產與長天期資產。'
          : '處於中性水準。'),
    })
  }
  const spx = equityReturns.find((e) => e.id === 'spx')
  if (spx && spx.cagr5y != null) {
    headline.push({
      id: 'spx5y',
      icon: '📈',
      title: 'S&P 500 近 5 年年化報酬',
      value: `${spx.cagr5y >= 0 ? '+' : ''}${spx.cagr5y}%`,
      tag: spx.cagr5y >= 10 ? '高於長期均值' : spx.cagr5y >= 0 ? '正報酬' : '負報酬',
      tagLevel: spx.cagr5y >= 0 ? 'high' : 'low',
      detail: `美股大盤近 5 年年化 ${spx.cagr5y}%、近 1 年 ${spx.return1y ?? '—'}%。可與上方公債殖利率對比，評估股債相對吸引力。`,
    })
  }
  const gold = otherAssets.find((o) => o.id === 'gold')
  if (gold && gold.return1y != null) {
    headline.push({
      id: 'gold',
      icon: '🥇',
      title: '黃金近 1 年報酬',
      value: `${gold.return1y >= 0 ? '+' : ''}${gold.return1y}%`,
      tag: gold.return1y >= 0 ? '避險需求' : '回落',
      tagLevel: gold.return1y >= 0 ? 'high' : 'low',
      detail: `黃金近 1 年 ${gold.return1y}%、近 5 年年化 ${gold.cagr5y ?? '—'}%，常反映通膨與避險情緒。`,
    })
  }

  const now = new Date()
  const out = {
    generatedAt: now.toISOString(),
    asOf: now.toISOString().slice(0, 10),
    source: 'Yahoo Finance',
    headline,
    bondYields,
    equityReturns,
    otherAssets,
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(
    `Wrote ${OUT}: ${bondYields.length} yields, ${equityReturns.length} indices, ${otherAssets.length} others.`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
