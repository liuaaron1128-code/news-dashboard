// Fetches global market "annualized return" signals and writes
// src/data/market_signals.json. Run by .github/workflows/market-signals.yml.
//
// Sources (no external npm deps — Node 20+ global fetch):
//   - Yahoo Finance chart API (no key): equity indices, US Treasury curve,
//     commodities/FX/crypto, VIX.
//   - FRED (free API key in env FRED_API_KEY): real yield, breakeven inflation,
//     curve spreads, credit spread, policy rates, German/Japan/UK 10Y.
//   - multpl.com (scrape, best-effort): S&P 500 P/E -> earnings yield -> ERP.
// Every fetch degrades gracefully: a failed source is skipped, never fatal.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'market_signals.json')
const FRED_KEY = process.env.FRED_API_KEY

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const BONDS = [
  { id: 'us3m', region: '美國', name: '3 個月國庫券', symbol: '^IRX' },
  { id: 'us5y', region: '美國', name: '5 年期公債', symbol: '^FVX' },
  { id: 'us10y', region: '美國', name: '10 年期公債', symbol: '^TNX' },
  { id: 'us30y', region: '美國', name: '30 年期公債', symbol: '^TYX' },
]

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

// ---------- Yahoo ----------
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

// ---------- FRED ----------
// Returns observations ascending: [{ date: Date, value: number }]
async function fredSeries(seriesId, limit = 30) {
  if (!FRED_KEY) throw new Error('FRED_API_KEY not set')
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
    `&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${limit}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const obs = (json?.observations || [])
    .filter((o) => o.value !== '.' && o.value != null && o.value !== '')
    .map((o) => ({ date: new Date(o.date), value: Number(o.value) }))
    .filter((o) => Number.isFinite(o.value))
  obs.reverse()
  if (obs.length === 0) throw new Error('no observations')
  return obs
}

// ---------- helpers ----------
const closeNearest = (series, target) => {
  let best = null
  let bestDiff = Infinity
  for (const p of series) {
    const diff = Math.abs(p.date.getTime() - target.getTime())
    if (diff < bestDiff) { bestDiff = diff; best = p }
  }
  return best
}
const yearsAgo = (date, n) => { const d = new Date(date); d.setFullYear(d.getFullYear() - n); return d }
const pct = (from, to) => (from == null || to == null || from === 0 ? null : (to / from - 1) * 100)
const cagr = (from, to, y) => (from == null || to == null || from <= 0 || to <= 0 ? null : ((to / from) ** (1 / y) - 1) * 100)
const round = (n, d = 2) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d)
const percentile = (series, value) => Math.round((series.filter((p) => (p.close ?? p.value) <= value).length / series.length) * 100)

function returnsFor(series) {
  const latest = series[series.length - 1]
  const prev = series[series.length - 2]
  const year = latest.date.getUTCFullYear()
  const firstOfYear = series.find((p) => p.date.getUTCFullYear() === year)
  const c1y = closeNearest(series, yearsAgo(latest.date, 1))
  const c3y = closeNearest(series, yearsAgo(latest.date, 3))
  const c5y = closeNearest(series, yearsAgo(latest.date, 5))
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

const yieldSignal = (p) => (p >= 90 ? '極高' : p >= 75 ? '偏高' : p <= 10 ? '極低' : p <= 25 ? '偏低' : '中性')

async function main() {
  // ---- US Treasury curve (Yahoo) ----
  const bondYields = []
  const usYield = {} // id -> latest value
  for (const b of BONDS) {
    try {
      const s = await fetchChart(b.symbol)
      const latest = s[s.length - 1]
      const prev = s[s.length - 2]
      const p = percentile(s, latest.close)
      usYield[b.id] = latest.close
      bondYields.push({
        id: b.id, region: b.region, name: b.name,
        yield: round(latest.close, 2),
        changeBps: round((latest.close - prev.close) * 100, 0),
        percentile5y: p, signal: yieldSignal(p),
      })
      console.log(`bond ${b.symbol}: ${latest.close} (p${p})`)
    } catch (e) { console.warn(`bond ${b.symbol} failed: ${e.message}`) }
  }

  // ---- Equity indices (Yahoo) ----
  const equityReturns = []
  let spx = null
  for (const idx of INDICES) {
    try {
      const s = await fetchChart(idx.symbol)
      const r = returnsFor(s)
      const row = { id: idx.id, region: idx.region, name: idx.name, price: r.price, ytd: r.ytd, return1y: r.return1y, cagr3y: r.cagr3y, cagr5y: r.cagr5y }
      equityReturns.push(row)
      if (idx.id === 'spx') spx = { ...row, price: s[s.length - 1].close }
      console.log(`index ${idx.symbol}: ${r.price} (5y CAGR ${r.cagr5y})`)
    } catch (e) { console.warn(`index ${idx.symbol} failed: ${e.message}`) }
  }

  // ---- Commodities / FX / crypto (Yahoo) ----
  const otherAssets = []
  let gold = null
  for (const o of OTHERS) {
    try {
      const s = await fetchChart(o.symbol)
      const r = returnsFor(s)
      const row = { id: o.id, name: o.name, icon: o.icon, price: r.price, ytd: r.ytd, return1y: r.return1y, cagr5y: r.cagr5y }
      otherAssets.push(row)
      if (o.id === 'gold') gold = row
      console.log(`other ${o.symbol}: ${r.price}`)
    } catch (e) { console.warn(`other ${o.symbol} failed: ${e.message}`) }
  }

  // ---- Risk indicators ----
  const riskIndicators = []
  // VIX (Yahoo)
  try {
    const s = await fetchChart('^VIX')
    const v = s[s.length - 1].close
    const sig = v >= 30 ? { s: '極高', l: 'high' } : v >= 20 ? { s: '偏高', l: 'high' } : v <= 13 ? { s: '偏低', l: 'low' } : { s: '中性', l: 'neutral' }
    riskIndicators.push({ id: 'vix', label: 'VIX 波動率指數', value: round(v, 2), unit: '', signal: sig.s, signalLevel: sig.l, note: '股市恐慌情緒；>20 偏緊張、<13 自滿' })
    console.log(`VIX: ${v}`)
  } catch (e) { console.warn(`VIX failed: ${e.message}`) }
  // HY OAS credit spread (FRED)
  try {
    const s = await fredSeries('BAMLH0A0HYM2', 1300)
    const v = s[s.length - 1].value
    const p = percentile(s, v)
    const sig = p >= 75 ? { s: '偏高', l: 'high' } : p <= 25 ? { s: '偏低', l: 'low' } : { s: '中性', l: 'neutral' }
    riskIndicators.push({ id: 'hyoas', label: '高收益債信用利差 (HY OAS)', value: round(v, 2), unit: '%', signal: sig.s, signalLevel: sig.l, note: `近 5 年第 ${p} 百分位；走闊代表市場壓力升高` })
    console.log(`HY OAS: ${v} (p${p})`)
  } catch (e) { console.warn(`HY OAS failed: ${e.message}`) }

  // ---- Relative value (股債相對價值) ----
  const relativeValue = []
  let real10y = null
  // 10Y real yield (FRED DFII10)
  try {
    const s = await fredSeries('DFII10', 60)
    real10y = s[s.length - 1].value
    const sig = real10y >= 2 ? { s: '偏高(緊縮)', l: 'high' } : real10y <= 0 ? { s: '偏低(寬鬆)', l: 'low' } : { s: '中性', l: 'neutral' }
    relativeValue.push({ id: 'real10y', label: '10Y 實質殖利率 (TIPS)', value: round(real10y, 2), unit: '%', signal: sig.s, signalLevel: sig.l, note: '扣除通膨後的無風險年化報酬；>2% 對成長股與黃金不利' })
  } catch (e) { console.warn(`DFII10 failed: ${e.message}`) }
  // 10Y breakeven inflation (FRED T10YIE)
  try {
    const s = await fredSeries('T10YIE', 60)
    const v = s[s.length - 1].value
    const sig = v >= 2.5 ? { s: '偏高', l: 'high' } : v < 2 ? { s: '偏低', l: 'low' } : { s: '接近目標', l: 'neutral' }
    relativeValue.push({ id: 'breakeven10y', label: '10Y 通膨預期 (breakeven)', value: round(v, 2), unit: '%', signal: sig.s, signalLevel: sig.l, note: '市場對未來 10 年平均通膨的定價；Fed 目標約 2%' })
  } catch (e) { console.warn(`T10YIE failed: ${e.message}`) }
  // Curve 10Y-2Y (FRED T10Y2Y)
  try {
    const s = await fredSeries('T10Y2Y', 60)
    const v = s[s.length - 1].value
    const sig = v < 0 ? { s: '倒掛', l: 'high' } : v < 0.5 ? { s: '偏平', l: 'neutral' } : { s: '正常', l: 'low' }
    relativeValue.push({ id: 'curve10y2y', label: '殖利率曲線 10Y−2Y', value: round(v, 2), unit: '%', signal: sig.s, signalLevel: sig.l, note: '負值(倒掛)是經典的衰退領先訊號' })
  } catch (e) { console.warn(`T10Y2Y failed: ${e.message}`) }
  // Curve 10Y-3M (compute from Yahoo if both present)
  if (usYield.us10y != null && usYield.us3m != null) {
    const v = usYield.us10y - usYield.us3m
    const sig = v < 0 ? { s: '倒掛', l: 'high' } : v < 0.5 ? { s: '偏平', l: 'neutral' } : { s: '正常', l: 'low' }
    relativeValue.push({ id: 'curve10y3m', label: '殖利率曲線 10Y−3M', value: round(v, 2), unit: '%', signal: sig.s, signalLevel: sig.l, note: 'Fed 偏好的衰退指標；負值代表倒掛' })
  }
  // Equity risk premium (multpl earnings yield - US 10Y)
  let erp = null
  try {
    const res = await fetch('https://www.multpl.com/s-p-500-pe-ratio', { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const m = html.match(/Current[^0-9]*([0-9]+\.[0-9]+)/)
    const pe = m ? Number(m[1]) : null
    if (pe && usYield.us10y != null) {
      const earningsYield = 100 / pe
      erp = earningsYield - usYield.us10y
      const sig = erp <= 0 ? { s: '無溢酬', l: 'high' } : erp < 1 ? { s: '偏低', l: 'high' } : erp >= 3 ? { s: '偏高', l: 'low' } : { s: '中性', l: 'neutral' }
      relativeValue.push({ id: 'erp', label: '股債風險溢酬 (ERP)', value: round(erp, 2), unit: '%', signal: sig.s, signalLevel: sig.l, note: `S&P500 盈餘殖利率 ${earningsYield.toFixed(1)}% − 10Y ${usYield.us10y.toFixed(1)}%；越低代表股票相對債券越不划算` })
      console.log(`ERP: ${erp} (PE ${pe})`)
    }
  } catch (e) { console.warn(`ERP (multpl) failed: ${e.message}`) }

  // ---- Global sovereign 10Y yields (FRED, monthly OECD series) ----
  const globalYields = []
  const GLOBAL = [
    { id: 'de10y', label: '德國 10Y 公債', series: 'IRLTLT01DEM156N' },
    { id: 'jp10y', label: '日本 10Y 公債', series: 'IRLTLT01JPM156N' },
    { id: 'gb10y', label: '英國 10Y 公債', series: 'IRLTLT01GBM156N' },
  ]
  for (const g of GLOBAL) {
    try {
      const s = await fredSeries(g.series, 12)
      const last = s[s.length - 1]
      globalYields.push({ id: g.id, label: g.label, value: round(last.value, 2), unit: '%', note: `資料月份 ${last.date.toISOString().slice(0, 7)}（OECD 月頻）` })
      console.log(`${g.id}: ${last.value}`)
    } catch (e) { console.warn(`${g.id} failed: ${e.message}`) }
  }
  // Note Taiwan is not available on FRED.
  globalYields.push({ id: 'tw10y', label: '台灣 10Y 公債', value: null, unit: '%', note: '免費資料源暫無，待補' })

  // ---- Policy rates ----
  const policyRates = []
  const POLICY = [
    { id: 'fed', label: '美國 Fed 基準利率 (上限)', series: 'DFEDTARU' },
    { id: 'ecb', label: '歐洲央行 ECB 存款利率', series: 'ECBDFR' },
    { id: 'boj', label: '日本央行 BOJ 政策利率', series: 'IRSTCB01JPM156N' },
  ]
  for (const r of POLICY) {
    try {
      const s = await fredSeries(r.series, 12)
      const last = s[s.length - 1]
      policyRates.push({ id: r.id, label: r.label, value: round(last.value, 2), unit: '%', note: `更新於 ${last.date.toISOString().slice(0, 10)}` })
      console.log(`${r.id}: ${last.value}`)
    } catch (e) { console.warn(`${r.id} failed: ${e.message}`) }
  }

  if (bondYields.length === 0 && equityReturns.length === 0) {
    throw new Error('No data fetched for any symbol — aborting without overwriting.')
  }

  // ---- Headline signals (rule-based) ----
  const headline = []
  const us10yRow = bondYields.find((b) => b.id === 'us10y')
  if (us10yRow) {
    const level = us10yRow.percentile5y >= 75 ? 'high' : us10yRow.percentile5y <= 25 ? 'low' : 'neutral'
    const dir = level === 'high' ? '偏高' : level === 'low' ? '偏低' : '中性'
    headline.push({
      id: 'us10y', icon: '🏦', title: '美國 10 年期公債殖利率', value: `${us10yRow.yield}%`,
      tag: us10yRow.signal, tagLevel: level,
      detail: `處於近 5 年區間第 ${us10yRow.percentile5y} 百分位，無風險年化報酬${dir}。` +
        (level === 'high' ? '股票須提供更高的預期報酬才划算，對成長股與長天期資產形成壓力。' : level === 'low' ? '資金成本低，有利風險性資產。' : '處於中性水準。'),
    })
  }
  const erpRow = relativeValue.find((m) => m.id === 'erp')
  if (erpRow && erpRow.value != null) {
    headline.push({
      id: 'erp', icon: '⚖️', title: '股債風險溢酬 (ERP)', value: `${erpRow.value}%`,
      tag: erpRow.signal, tagLevel: erpRow.signalLevel || 'neutral',
      detail: erpRow.note,
    })
  }
  const curveRow = relativeValue.find((m) => m.id === 'curve10y2y') || relativeValue.find((m) => m.id === 'curve10y3m')
  if (curveRow && curveRow.value != null && curveRow.value < 0) {
    headline.push({
      id: 'curve', icon: '⚠️', title: `殖利率曲線 ${curveRow.label.includes('2Y') ? '10Y−2Y' : '10Y−3M'} 倒掛`, value: `${curveRow.value}%`,
      tag: '倒掛', tagLevel: 'high',
      detail: '殖利率曲線倒掛是經典的衰退領先訊號，通常領先 6–18 個月，須留意景氣轉折風險。',
    })
  }
  if (spx && spx.cagr5y != null) {
    headline.push({
      id: 'spx5y', icon: '📈', title: 'S&P 500 近 5 年年化報酬', value: `${spx.cagr5y >= 0 ? '+' : ''}${spx.cagr5y}%`,
      tag: spx.cagr5y >= 10 ? '高於長期均值' : spx.cagr5y >= 0 ? '正報酬' : '負報酬', tagLevel: spx.cagr5y >= 0 ? 'high' : 'low',
      detail: `美股大盤近 5 年年化 ${spx.cagr5y}%、近 1 年 ${spx.return1y ?? '—'}%。`,
    })
  }
  if (gold && gold.return1y != null) {
    headline.push({
      id: 'gold', icon: '🥇', title: '黃金近 1 年報酬', value: `${gold.return1y >= 0 ? '+' : ''}${gold.return1y}%`,
      tag: gold.return1y >= 0 ? '避險需求' : '回落', tagLevel: gold.return1y >= 0 ? 'high' : 'low',
      detail: `黃金近 1 年 ${gold.return1y}%、近 5 年年化 ${gold.cagr5y ?? '—'}%，常反映通膨與避險情緒。`,
    })
  }

  const now = new Date()
  const out = {
    generatedAt: now.toISOString(),
    asOf: now.toISOString().slice(0, 10),
    source: FRED_KEY ? 'Yahoo Finance + FRED' : 'Yahoo Finance（未設 FRED 金鑰，部分指標略過）',
    headline: headline.slice(0, 5),
    relativeValue,
    riskIndicators,
    bondYields,
    globalYields,
    policyRates,
    equityReturns,
    otherAssets,
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(
    `Wrote ${OUT}: ${bondYields.length} US yields, ${equityReturns.length} indices, ` +
      `${otherAssets.length} others, ${relativeValue.length} rel-value, ${riskIndicators.length} risk, ` +
      `${globalYields.length} global yields, ${policyRates.length} policy rates.`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
