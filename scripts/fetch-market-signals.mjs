// Fetches a broad set of global market signals and writes
// src/data/market_signals.json. Run by .github/workflows/market-signals.yml.
//
// Sources (no external npm deps — Node 20+ global fetch):
//   - Yahoo Finance chart API (no key): equity indices, US sectors, commodities,
//     FX, crypto, VIX.
//   - FRED (free API key in env FRED_API_KEY): full US Treasury curve, real
//     yields, breakevens, curve & credit spreads, policy rates, global 10Y,
//     and macro (CPI/PCE/unemployment/payrolls/GDP/claims/Fed balance sheet).
//   - multpl.com (scrape, best-effort): S&P 500 P/E & dividend yield -> ERP.
// Every fetch degrades gracefully: a failed source is skipped, never fatal.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'market_signals.json')
const FRED_KEY = process.env.FRED_API_KEY

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const INDICES = [
  { id: 'spx', region: '美國', name: 'S&P 500', symbol: '^GSPC' },
  { id: 'ndq', region: '美國', name: 'Nasdaq', symbol: '^IXIC' },
  { id: 'dji', region: '美國', name: '道瓊工業', symbol: '^DJI' },
  { id: 'rut', region: '美國', name: 'Russell 2000', symbol: '^RUT' },
  { id: 'sx5e', region: '歐元區', name: 'Euro Stoxx 50', symbol: '^STOXX50E' },
  { id: 'dax', region: '德國', name: 'DAX', symbol: '^GDAXI' },
  { id: 'ftse', region: '英國', name: 'FTSE 100', symbol: '^FTSE' },
  { id: 'cac', region: '法國', name: 'CAC 40', symbol: '^FCHI' },
  { id: 'ibex', region: '西班牙', name: 'IBEX 35', symbol: '^IBEX' },
  { id: 'aex', region: '荷蘭', name: 'AEX', symbol: '^AEX' },
  { id: 'smi', region: '瑞士', name: 'SMI', symbol: '^SSMI' },
  { id: 'n225', region: '日本', name: '日經 225', symbol: '^N225' },
  { id: 'hsi', region: '香港', name: '恒生指數', symbol: '^HSI' },
  { id: 'ssec', region: '中國', name: '上證綜指', symbol: '000001.SS' },
  { id: 'twii', region: '台灣', name: '台股加權', symbol: '^TWII' },
  { id: 'kospi', region: '南韓', name: 'KOSPI', symbol: '^KS11' },
  { id: 'sensex', region: '印度', name: 'Sensex', symbol: '^BSESN' },
  { id: 'jkse', region: '印尼', name: 'IDX Composite', symbol: '^JKSE' },
  { id: 'sti', region: '新加坡', name: 'STI', symbol: '^STI' },
  { id: 'asx', region: '澳洲', name: 'ASX 200', symbol: '^AXJO' },
  { id: 'tsx', region: '加拿大', name: 'S&P/TSX', symbol: '^GSPTSE' },
  { id: 'mxx', region: '墨西哥', name: 'IPC', symbol: '^MXX' },
  { id: 'bvsp', region: '巴西', name: 'Bovespa', symbol: '^BVSP' },
]

const SECTORS = [
  { id: 'xlk', region: '科技', name: '科技 (XLK)', symbol: 'XLK' },
  { id: 'xlc', region: '通訊', name: '通訊服務 (XLC)', symbol: 'XLC' },
  { id: 'xly', region: '非必需消費', name: '非必需消費 (XLY)', symbol: 'XLY' },
  { id: 'xlp', region: '必需消費', name: '必需消費 (XLP)', symbol: 'XLP' },
  { id: 'xlf', region: '金融', name: '金融 (XLF)', symbol: 'XLF' },
  { id: 'xlv', region: '醫療', name: '醫療保健 (XLV)', symbol: 'XLV' },
  { id: 'xli', region: '工業', name: '工業 (XLI)', symbol: 'XLI' },
  { id: 'xle', region: '能源', name: '能源 (XLE)', symbol: 'XLE' },
  { id: 'xlb', region: '原物料', name: '原物料 (XLB)', symbol: 'XLB' },
  { id: 'xlu', region: '公用', name: '公用事業 (XLU)', symbol: 'XLU' },
  { id: 'xlre', region: '房地產', name: '房地產 (XLRE)', symbol: 'XLRE' },
]

const OTHERS = [
  { id: 'gold', name: '黃金', icon: '🥇', symbol: 'GC=F' },
  { id: 'silver', name: '白銀', icon: '🥈', symbol: 'SI=F' },
  { id: 'copper', name: '銅', icon: '🟤', symbol: 'HG=F' },
  { id: 'wti', name: 'WTI 原油', icon: '🛢️', symbol: 'CL=F' },
  { id: 'brent', name: 'Brent 原油', icon: '🛢️', symbol: 'BZ=F' },
  { id: 'natgas', name: '天然氣', icon: '🔥', symbol: 'NG=F' },
  { id: 'btc', name: '比特幣', icon: '₿', symbol: 'BTC-USD' },
  { id: 'eth', name: '以太幣', icon: 'Ξ', symbol: 'ETH-USD' },
  { id: 'dxy', name: '美元指數', icon: '💵', symbol: 'DX-Y.NYB' },
  { id: 'eurusd', name: '歐元/美元', icon: '🇪🇺', symbol: 'EURUSD=X' },
  { id: 'usdjpy', name: '美元/日圓', icon: '🇯🇵', symbol: 'JPY=X' },
  { id: 'gbpusd', name: '英鎊/美元', icon: '🇬🇧', symbol: 'GBPUSD=X' },
  { id: 'usdcny', name: '美元/人民幣', icon: '🇨🇳', symbol: 'CNY=X' },
  { id: 'usdtwd', name: '美元/台幣', icon: '🇹🇼', symbol: 'TWD=X' },
]

// ---------- Yahoo ----------
async function fetchChart(symbol) {
  const path = `v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y`
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']
  let lastErr
  for (const host of hosts) {
    try {
      const res = await fetch(`https://${host}/${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue }
      const json = await res.json()
      const r = json?.chart?.result?.[0]
      const ts = r?.timestamp
      const close = r?.indicators?.quote?.[0]?.close
      if (!ts || !close) { lastErr = new Error('no data'); continue }
      const series = []
      for (let i = 0; i < ts.length; i++) if (close[i] != null) series.push({ date: new Date(ts[i] * 1000), close: close[i] })
      if (series.length < 2) { lastErr = new Error('series too short'); continue }
      return series
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('fetch failed')
}

// ---------- FRED ----------
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
// Year-over-year % change from a monthly index series.
async function fredYoY(seriesId) {
  const s = await fredSeries(seriesId, 16)
  if (s.length < 13) throw new Error('not enough history')
  const latest = s[s.length - 1]
  const prior = s[s.length - 13]
  return { value: (latest.value / prior.value - 1) * 100, date: latest.date }
}

// ---------- helpers ----------
const closeNearest = (series, target) => {
  let best = null, bestDiff = Infinity
  for (const p of series) { const d = Math.abs(p.date.getTime() - target.getTime()); if (d < bestDiff) { bestDiff = d; best = p } }
  return best
}
const yearsAgo = (date, n) => { const d = new Date(date); d.setFullYear(d.getFullYear() - n); return d }
const pct = (from, to) => (from == null || to == null || from === 0 ? null : (to / from - 1) * 100)
const cagr = (from, to, y) => (from == null || to == null || from <= 0 || to <= 0 ? null : ((to / from) ** (1 / y) - 1) * 100)
const round = (n, d = 2) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d)
const percentile = (series, value) => Math.round((series.filter((p) => (p.close ?? p.value) <= value).length / series.length) * 100)
const yieldSignal = (p) => (p >= 90 ? '極高' : p >= 75 ? '偏高' : p <= 10 ? '極低' : p <= 25 ? '偏低' : '中性')
const ym = (d) => d.toISOString().slice(0, 7)
const ymd = (d) => d.toISOString().slice(0, 10)

function returnsFor(series) {
  const latest = series[series.length - 1]
  const prev = series[series.length - 2]
  const year = latest.date.getUTCFullYear()
  const firstOfYear = series.find((p) => p.date.getUTCFullYear() === year)
  const c1y = closeNearest(series, yearsAgo(latest.date, 1))
  const c3y = closeNearest(series, yearsAgo(latest.date, 3))
  const c5y = closeNearest(series, yearsAgo(latest.date, 5))
  const spanYears = (latest.date.getTime() - series[0].date.getTime()) / (365.25 * 86400000)
  const hasYears = (n) => spanYears >= n - 0.15
  return {
    price: round(latest.close, latest.close < 50 ? 4 : 2),
    prevClose: prev.close,
    ytd: round(firstOfYear ? pct(firstOfYear.close, latest.close) : null, 1),
    return1y: round(hasYears(1) ? pct(c1y.close, latest.close) : null, 1),
    cagr3y: round(hasYears(3) ? cagr(c3y.close, latest.close, 3) : null, 1),
    cagr5y: round(hasYears(5) ? cagr(c5y.close, latest.close, 5) : null, 1),
  }
}

// Fetch a list of Yahoo symbols into EquityReturn-shaped rows.
async function fetchReturns(list, keep = {}) {
  const rows = []
  for (const item of list) {
    try {
      const s = await fetchChart(item.symbol)
      const r = returnsFor(s)
      const row = { id: item.id, region: item.region, name: item.name, icon: item.icon, price: r.price, ytd: r.ytd, return1y: r.return1y, cagr3y: r.cagr3y, cagr5y: r.cagr5y }
      rows.push(row)
      if (keep[item.id]) keep[item.id].row = { ...row, lastClose: s[s.length - 1].close }
      console.log(`yahoo ${item.symbol}: ${r.price}`)
    } catch (e) { console.warn(`yahoo ${item.symbol} failed: ${e.message}`) }
    await sleep(120)
  }
  return rows
}

// Best-effort Taiwan 10Y government bond yield.
// TPEx / CBC block data-center IPs (403) and the exact OpenAPI path could not be
// confirmed offline, so this tries a few plausible official endpoints, logs the
// raw response so the first real GitHub Actions run reveals the true schema/IP
// access, and falls back to null (the UI then shows "待補").
async function fetchTaiwan10Y() {
  const candidates = [
    'https://www.tpex.org.tw/openapi/v1/tpex_govbond_yield',
    'https://www.tpex.org.tw/openapi/v1/bond_govbond_yield_curve',
    'https://www.tpex.org.tw/openapi/v1/gov_bond_indicative_yield',
  ]
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
      if (!res.ok) { console.warn(`TW10Y ${url}: HTTP ${res.status}`); continue }
      const txt = await res.text()
      console.log(`TW10Y ${url} OK — sample: ${txt.slice(0, 400)}`)
      let data
      try { data = JSON.parse(txt) } catch { continue }
      const arr = Array.isArray(data) ? data : data?.data || []
      for (const row of arr) {
        const s = JSON.stringify(row)
        if (/10\s*年|10Y|10-?year/i.test(s)) {
          const nums = (s.match(/[0-9]+\.[0-9]+/g) || []).map(Number).filter((n) => n > 0 && n < 10)
          if (nums.length) return { value: nums[0], note: 'TPEx 官方資料（自動解析，首次請人工核對）' }
        }
      }
      console.warn('TW10Y: fetched but could not locate a 10Y yield in payload')
      return null
    } catch (e) { console.warn(`TW10Y ${url} failed: ${e.message}`) }
  }
  return null
}

async function main() {
  const usYield = {} // id -> yield value

  // ---- US Treasury curve ----
  const bondYields = []
  if (FRED_KEY) {
    const US_CURVE = [
      { id: 'us1m', name: '1 個月', series: 'DGS1MO' },
      { id: 'us3m', name: '3 個月', series: 'DGS3MO' },
      { id: 'us6m', name: '6 個月', series: 'DGS6MO' },
      { id: 'us1y', name: '1 年期', series: 'DGS1' },
      { id: 'us2y', name: '2 年期', series: 'DGS2' },
      { id: 'us3y', name: '3 年期', series: 'DGS3' },
      { id: 'us5y', name: '5 年期', series: 'DGS5' },
      { id: 'us7y', name: '7 年期', series: 'DGS7' },
      { id: 'us10y', name: '10 年期', series: 'DGS10' },
      { id: 'us20y', name: '20 年期', series: 'DGS20' },
      { id: 'us30y', name: '30 年期', series: 'DGS30' },
    ]
    for (const b of US_CURVE) {
      try {
        const s = await fredSeries(b.series, 1300)
        const latest = s[s.length - 1], prev = s[s.length - 2]
        const p = percentile(s, latest.value)
        usYield[b.id] = latest.value
        bondYields.push({ id: b.id, region: '美國', name: b.name, yield: round(latest.value, 2), changeBps: round((latest.value - prev.value) * 100, 0), percentile5y: p, signal: yieldSignal(p) })
        console.log(`curve ${b.series}: ${latest.value} (p${p})`)
      } catch (e) { console.warn(`curve ${b.series} failed: ${e.message}`) }
    }
  } else {
    const YBONDS = [
      { id: 'us3m', name: '3 個月', symbol: '^IRX' },
      { id: 'us5y', name: '5 年期', symbol: '^FVX' },
      { id: 'us10y', name: '10 年期', symbol: '^TNX' },
      { id: 'us30y', name: '30 年期', symbol: '^TYX' },
    ]
    for (const b of YBONDS) {
      try {
        const s = await fetchChart(b.symbol)
        const latest = s[s.length - 1], prev = s[s.length - 2]
        const p = percentile(s, latest.close)
        usYield[b.id] = latest.close
        bondYields.push({ id: b.id, region: '美國', name: b.name, yield: round(latest.close, 2), changeBps: round((latest.close - prev.close) * 100, 0), percentile5y: p, signal: yieldSignal(p) })
      } catch (e) { console.warn(`bond ${b.symbol} failed: ${e.message}`) }
      await sleep(120)
    }
  }

  // ---- Equity indices, sectors, commodities/FX/crypto (Yahoo) ----
  const keep = { spx: {}, gold: {} }
  const equityReturns = await fetchReturns(INDICES, keep)
  const sectors = await fetchReturns(SECTORS)
  const otherAssets = (await fetchReturns(OTHERS, keep)).map((r) => ({
    id: r.id, name: r.name, icon: r.icon, price: r.price, ytd: r.ytd, return1y: r.return1y, cagr5y: r.cagr5y,
  }))
  const spx = keep.spx.row
  const gold = keep.gold.row

  // ---- Risk indicators ----
  const riskIndicators = []
  try {
    const s = await fetchChart('^VIX')
    const v = s[s.length - 1].close
    const sig = v >= 30 ? { s: '極高', l: 'high' } : v >= 20 ? { s: '偏高', l: 'high' } : v <= 13 ? { s: '偏低', l: 'low' } : { s: '中性', l: 'neutral' }
    riskIndicators.push({ id: 'vix', label: 'VIX 波動率指數', value: round(v, 2), unit: '', signal: sig.s, signalLevel: sig.l, note: '股市恐慌情緒；>20 偏緊張、<13 自滿' })
  } catch (e) { console.warn(`VIX failed: ${e.message}`) }
  const fredRisk = [
    { id: 'hyoas', series: 'BAMLH0A0HYM2', label: '高收益債信用利差 (HY OAS)', note: '走闊代表市場壓力升高', pctile: true },
    { id: 'igoas', series: 'BAMLC0A0CM', label: '投資級債信用利差 (IG OAS)', note: '投資級企業債的風險溢酬', pctile: true },
    { id: 'stress', series: 'STLFSI4', label: '聖路易聯儲金融壓力指數', note: '0 為平均水準，正值代表壓力高於平均', pctile: false, signalFn: (v) => (v > 0.5 ? { s: '偏高', l: 'high' } : v < -0.5 ? { s: '偏低', l: 'low' } : { s: '中性', l: 'neutral' }) },
  ]
  for (const r of fredRisk) {
    try {
      const s = await fredSeries(r.series, 1300)
      const v = s[s.length - 1].value
      let sig
      if (r.pctile) { const p = percentile(s, v); sig = p >= 75 ? { s: '偏高', l: 'high' } : p <= 25 ? { s: '偏低', l: 'low' } : { s: '中性', l: 'neutral' }; r.note += `；近 5 年第 ${p} 百分位` }
      else sig = r.signalFn(v)
      riskIndicators.push({ id: r.id, label: r.label, value: round(v, 2), unit: r.id === 'stress' ? '' : '%', signal: sig.s, signalLevel: sig.l, note: r.note })
      console.log(`risk ${r.series}: ${v}`)
    } catch (e) { console.warn(`risk ${r.series} failed: ${e.message}`) }
  }

  // ---- Relative value ----
  const relativeValue = []
  const fredRel = [
    { id: 'real10y', series: 'DFII10', label: '10Y 實質殖利率 (TIPS)', note: '扣除通膨後的無風險年化報酬；>2% 對成長股與黃金不利', sig: (v) => (v >= 2 ? { s: '偏高(緊縮)', l: 'high' } : v <= 0 ? { s: '偏低(寬鬆)', l: 'low' } : { s: '中性', l: 'neutral' }) },
    { id: 'real5y', series: 'DFII5', label: '5Y 實質殖利率 (TIPS)', note: '中天期實質利率', sig: (v) => (v >= 2 ? { s: '偏高', l: 'high' } : v <= 0 ? { s: '偏低', l: 'low' } : { s: '中性', l: 'neutral' }) },
    { id: 'be10y', series: 'T10YIE', label: '10Y 通膨預期 (breakeven)', note: '市場對未來 10 年平均通膨的定價；Fed 目標約 2%', sig: (v) => (v >= 2.5 ? { s: '偏高', l: 'high' } : v < 2 ? { s: '偏低', l: 'low' } : { s: '接近目標', l: 'neutral' }) },
    { id: 'be5y5y', series: 'T5YIFR', label: '5y5y 遠期通膨預期', note: 'Fed 最看重的長期通膨預期指標', sig: (v) => (v >= 2.5 ? { s: '偏高', l: 'high' } : v < 2 ? { s: '偏低', l: 'low' } : { s: '接近目標', l: 'neutral' }) },
    { id: 'curve10y2y', series: 'T10Y2Y', label: '殖利率曲線 10Y−2Y', note: '負值(倒掛)是經典的衰退領先訊號', sig: (v) => (v < 0 ? { s: '倒掛', l: 'high' } : v < 0.5 ? { s: '偏平', l: 'neutral' } : { s: '正常', l: 'low' }) },
    { id: 'curve10y3mF', series: 'T10Y3M', label: '殖利率曲線 10Y−3M', note: 'Fed 偏好的衰退指標；負值代表倒掛', sig: (v) => (v < 0 ? { s: '倒掛', l: 'high' } : v < 0.5 ? { s: '偏平', l: 'neutral' } : { s: '正常', l: 'low' }) },
  ]
  for (const r of fredRel) {
    try {
      const s = await fredSeries(r.series, 60)
      const v = s[s.length - 1].value
      const sig = r.sig(v)
      relativeValue.push({ id: r.id, label: r.label, value: round(v, 2), unit: '%', signal: sig.s, signalLevel: sig.l, note: r.note })
      console.log(`rel ${r.series}: ${v}`)
    } catch (e) { console.warn(`rel ${r.series} failed: ${e.message}`) }
  }
  // ERP & valuation via multpl
  let erp = null, pe = null, divYield = null
  // multpl puts "Current S&P 500 PE Ratio is 30.42 ..." in the page text; anchor
  // on "Ratio is"/"Yield is" so the "500" in "S&P 500" doesn't break the match.
  try {
    const res = await fetch('https://www.multpl.com/s-p-500-pe-ratio', { headers: { 'User-Agent': UA } })
    if (res.ok) {
      const html = await res.text()
      const m = html.match(/PE Ratio is[:\s]*([0-9]+(?:\.[0-9]+)?)/i)
      pe = m ? Number(m[1]) : null
      console.log(`multpl PE: ${pe}`)
    } else console.warn(`multpl PE HTTP ${res.status}`)
  } catch (e) { console.warn(`multpl PE failed: ${e.message}`) }
  try {
    const res = await fetch('https://www.multpl.com/s-p-500-dividend-yield', { headers: { 'User-Agent': UA } })
    if (res.ok) {
      const html = await res.text()
      const m = html.match(/Dividend Yield is[:\s]*([0-9]+(?:\.[0-9]+)?)/i)
      divYield = m ? Number(m[1]) : null
      console.log(`multpl div: ${divYield}`)
    } else console.warn(`multpl div HTTP ${res.status}`)
  } catch (e) { console.warn(`multpl div failed: ${e.message}`) }
  if (pe && usYield.us10y != null) {
    const ey = 100 / pe
    erp = ey - usYield.us10y
    const sig = erp <= 0 ? { s: '無溢酬', l: 'high' } : erp < 1 ? { s: '偏低', l: 'high' } : erp >= 3 ? { s: '偏高', l: 'low' } : { s: '中性', l: 'neutral' }
    relativeValue.unshift({ id: 'erp', label: '股債風險溢酬 (ERP)', value: round(erp, 2), unit: '%', signal: sig.s, signalLevel: sig.l, note: `S&P500 盈餘殖利率 ${ey.toFixed(1)}% − 10Y ${usYield.us10y.toFixed(1)}%；越低代表股票相對債券越不划算` })
  }
  if (pe) relativeValue.push({ id: 'pe', label: 'S&P 500 本益比 (trailing)', value: round(pe, 1), unit: '倍', note: '越高代表股市估值越貴' })
  if (divYield) relativeValue.push({ id: 'divy', label: 'S&P 500 股息殖利率', value: round(divYield, 2), unit: '%', note: '大盤的現金流年化報酬' })

  // ---- Global sovereign 10Y yields (FRED, monthly OECD) ----
  const globalYields = []
  const GLOBAL = [
    { id: 'de10y', label: '德國 10Y 公債', series: 'IRLTLT01DEM156N' },
    { id: 'fr10y', label: '法國 10Y 公債', series: 'IRLTLT01FRM156N' },
    { id: 'it10y', label: '義大利 10Y 公債', series: 'IRLTLT01ITM156N' },
    { id: 'gb10y', label: '英國 10Y 公債', series: 'IRLTLT01GBM156N' },
    { id: 'jp10y', label: '日本 10Y 公債', series: 'IRLTLT01JPM156N' },
    { id: 'ca10y', label: '加拿大 10Y 公債', series: 'IRLTLT01CAM156N' },
    { id: 'au10y', label: '澳洲 10Y 公債', series: 'IRLTLT01AUM156N' },
    { id: 'kr10y', label: '南韓 10Y 公債', series: 'IRLTLT01KRM156N' },
  ]
  for (const g of GLOBAL) {
    try {
      const s = await fredSeries(g.series, 12)
      const last = s[s.length - 1]
      globalYields.push({ id: g.id, label: g.label, value: round(last.value, 2), unit: '%', note: `資料月份 ${ym(last.date)}（OECD 月頻）` })
      console.log(`${g.id}: ${last.value}`)
    } catch (e) { console.warn(`${g.id} failed: ${e.message}`) }
  }
  const tw = await fetchTaiwan10Y().catch(() => null)
  if (tw) globalYields.push({ id: 'tw10y', label: '台灣 10Y 公債', value: round(tw.value, 2), unit: '%', note: tw.note })
  else globalYields.push({ id: 'tw10y', label: '台灣 10Y 公債', value: null, unit: '%', note: '官方源未能自動抓取，待補' })

  // ---- Policy rates ----
  const policyRates = []
  // Only Fed and ECB have reliable, current, daily policy-rate series on FRED.
  // BOE (IRSTCB01GBM156N) 400s and BOJ's OECD series is stale (stopped 2023),
  // so they're omitted rather than shown with misleading values.
  const POLICY = [
    { id: 'fed', label: '美國 Fed 基準利率 (上限)', series: 'DFEDTARU' },
    { id: 'ecb', label: '歐洲央行 ECB 存款利率', series: 'ECBDFR' },
  ]
  for (const r of POLICY) {
    try {
      const s = await fredSeries(r.series, 12)
      const last = s[s.length - 1]
      policyRates.push({ id: r.id, label: r.label, value: round(last.value, 2), unit: '%', note: `更新於 ${ymd(last.date)}` })
      console.log(`${r.id}: ${last.value}`)
    } catch (e) { console.warn(`${r.id} failed: ${e.message}`) }
  }

  // ---- Macro ----
  const macro = []
  const pushMacro = (id, label, value, unit, note) => { if (value != null) macro.push({ id, label, value: round(value, value != null && Math.abs(value) < 10 ? 2 : 1), unit, note }) }
  const yoyJobs = [
    { id: 'cpi', series: 'CPIAUCSL', label: '美國 CPI 年增率', unit: '%' },
    { id: 'corecpi', series: 'CPILFESL', label: '核心 CPI 年增率', unit: '%' },
    { id: 'corepce', series: 'PCEPILFE', label: '核心 PCE 年增率（Fed 關注）', unit: '%' },
  ]
  for (const j of yoyJobs) {
    try { const r = await fredYoY(j.series); pushMacro(j.id, j.label, r.value, j.unit, `資料月份 ${ym(r.date)}`); console.log(`macro ${j.series} YoY: ${r.value}`) }
    catch (e) { console.warn(`macro ${j.series} failed: ${e.message}`) }
  }
  const levelJobs = [
    { id: 'unrate', series: 'UNRATE', label: '美國失業率', unit: '%', t: 'level' },
    { id: 'gdp', series: 'A191RL1Q225SBEA', label: '實質 GDP 季增年率', unit: '%', t: 'level' },
    { id: 'payrolls', series: 'PAYEMS', label: '非農就業月增', unit: ' 千人', t: 'mom' },
    { id: 'claims', series: 'ICSA', label: '初領失業金人數', unit: ' 千人', t: 'claims' },
    { id: 'walcl', series: 'WALCL', label: 'Fed 資產負債表', unit: ' 兆美元', t: 'walcl' },
  ]
  for (const j of levelJobs) {
    try {
      const s = await fredSeries(j.series, 6)
      const last = s[s.length - 1], prev = s[s.length - 2]
      let v
      if (j.t === 'mom') v = last.value - prev.value
      else if (j.t === 'claims') v = last.value / 1000
      else if (j.t === 'walcl') v = last.value / 1e6
      else v = last.value
      pushMacro(j.id, j.label, v, j.unit, `資料 ${j.series === 'A191RL1Q225SBEA' ? ym(last.date) + '（季）' : ymd(last.date)}`)
      console.log(`macro ${j.series}: ${v}`)
    } catch (e) { console.warn(`macro ${j.series} failed: ${e.message}`) }
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
    headline.push({ id: 'us10y', icon: '🏦', title: '美國 10 年期公債殖利率', value: `${us10yRow.yield}%`, tag: us10yRow.signal, tagLevel: level,
      detail: `處於近 5 年區間第 ${us10yRow.percentile5y} 百分位，無風險年化報酬${dir}。` + (level === 'high' ? '股票須提供更高的預期報酬才划算，對成長股與長天期資產形成壓力。' : level === 'low' ? '資金成本低，有利風險性資產。' : '處於中性水準。') })
  }
  const erpRow = relativeValue.find((m) => m.id === 'erp')
  if (erpRow && erpRow.value != null) headline.push({ id: 'erp', icon: '⚖️', title: '股債風險溢酬 (ERP)', value: `${erpRow.value}%`, tag: erpRow.signal, tagLevel: erpRow.signalLevel || 'neutral', detail: erpRow.note })
  const curveRow = relativeValue.find((m) => m.id === 'curve10y2y') || relativeValue.find((m) => m.id === 'curve10y3mF')
  if (curveRow && curveRow.value != null && curveRow.value < 0) headline.push({ id: 'curve', icon: '⚠️', title: '殖利率曲線倒掛', value: `${curveRow.value}%`, tag: '倒掛', tagLevel: 'high', detail: '殖利率曲線倒掛是經典的衰退領先訊號，通常領先 6–18 個月，須留意景氣轉折風險。' })
  if (spx && spx.cagr5y != null) headline.push({ id: 'spx5y', icon: '📈', title: 'S&P 500 近 5 年年化報酬', value: `${spx.cagr5y >= 0 ? '+' : ''}${spx.cagr5y}%`, tag: spx.cagr5y >= 10 ? '高於長期均值' : spx.cagr5y >= 0 ? '正報酬' : '負報酬', tagLevel: spx.cagr5y >= 0 ? 'high' : 'low', detail: `美股大盤近 5 年年化 ${spx.cagr5y}%、近 1 年 ${spx.return1y ?? '—'}%。` })
  if (gold && gold.return1y != null) headline.push({ id: 'gold', icon: '🥇', title: '黃金近 1 年報酬', value: `${gold.return1y >= 0 ? '+' : ''}${gold.return1y}%`, tag: gold.return1y >= 0 ? '避險需求' : '回落', tagLevel: gold.return1y >= 0 ? 'high' : 'low', detail: `黃金近 1 年 ${gold.return1y}%、近 5 年年化 ${gold.cagr5y ?? '—'}%，常反映通膨與避險情緒。` })

  const synthesis = buildSynthesis({ bondYields, relativeValue, riskIndicators, macro, equityReturns, sectors })

  const now = new Date()
  const out = {
    generatedAt: now.toISOString(),
    asOf: now.toISOString().slice(0, 10),
    source: FRED_KEY ? 'Yahoo Finance + FRED' : 'Yahoo Finance（未設 FRED 金鑰，部分指標略過）',
    synthesis,
    headline: headline.slice(0, 5),
    relativeValue, riskIndicators, macro,
    bondYields, globalYields, policyRates,
    equityReturns, sectors, otherAssets,
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  console.log(
    `Wrote ${OUT}: ${bondYields.length} US yields, ${equityReturns.length} indices, ${sectors.length} sectors, ` +
      `${otherAssets.length} others, ${relativeValue.length} rel-value, ${riskIndicators.length} risk, ` +
      `${macro.length} macro, ${globalYields.length} global yields, ${policyRates.length} policy rates.`,
  )
}

// Turns the assembled signals into a plain-language market read: an overall
// regime label + themed interpretations. Pure function (no I/O) so it is unit
// testable and deterministic.
export function buildSynthesis(d) {
  const find = (arr, id) => (arr || []).find((x) => x.id === id)
  const val = (arr, id) => { const m = find(arr, id); return m && m.value != null ? m.value : null }
  const us10 = find(d.bondYields, 'us10y')
  const real10 = val(d.relativeValue, 'real10y')
  const curve = val(d.relativeValue, 'curve10y2y')
  const erp = val(d.relativeValue, 'erp')
  const pe = val(d.relativeValue, 'pe')
  const divy = val(d.relativeValue, 'divy')
  const vix = val(d.riskIndicators, 'vix')
  const hy = find(d.riskIndicators, 'hyoas')
  const stress = val(d.riskIndicators, 'stress')
  const cpi = val(d.macro, 'cpi')
  const corepce = val(d.macro, 'corepce')
  const unrate = val(d.macro, 'unrate')

  const points = []
  if (us10) {
    let t = `美 10Y 公債 ${us10.yield}%（近 5 年第 ${us10.percentile5y} 百分位）`
    if (real10 != null) t += `，實質利率 ${real10}%${real10 >= 2 ? '（偏高、屬限制性，壓抑長天期與成長股）' : ''}`
    if (curve != null) t += `；曲線 10Y−2Y ${curve > 0 ? '+' : ''}${curve}%${curve < 0 ? '（倒掛、衰退警訊）' : curve < 0.5 ? '（偏平）' : '（正斜率）'}`
    points.push({ theme: '利率環境', text: t + '。' })
  }
  if (cpi != null || corepce != null) {
    const sticky = corepce != null && corepce > 2.5
    points.push({
      theme: '通膨與就業',
      text:
        `${cpi != null ? `CPI ${cpi}%、` : ''}${corepce != null ? `核心 PCE ${corepce}%` : ''}` +
        `${sticky ? '，仍明顯高於 Fed 2% 目標、通膨黏著，降息空間受限' : '，逐步回落'}` +
        `${unrate != null ? `；失業率 ${unrate}%` : ''}。`,
    })
  }
  if (vix != null || hy) {
    const calm = vix != null && vix < 20 && hy && hy.signalLevel === 'low'
    let t = ''
    if (vix != null) t += `VIX ${vix}${vix < 15 ? '（極低）' : vix < 20 ? '（平穩）' : vix < 30 ? '（偏緊張）' : '（恐慌）'}`
    if (hy) t += `${t ? '、' : ''}高收益債利差 ${hy.value}%（${hy.signal}）`
    if (stress != null) t += `、金融壓力 ${stress}`
    points.push({ theme: '風險胃納', text: t + (calm ? ' → 信用與波動極度平穩、無系統性壓力，偏 risk-on。' : ' → 風險指標升溫，留意。') })
  }
  if (d.equityReturns && d.equityReturns.length) {
    const byY = [...d.equityReturns].filter((e) => e.return1y != null).sort((a, b) => b.return1y - a.return1y)
    const top = byY.slice(0, 3).map((e) => `${e.name} +${e.return1y}%`).join('、')
    const bot = byY.slice(-2).map((e) => `${e.name} ${e.return1y}%`).join('、')
    let t = `近 1 年領先 ${top}；落後 ${bot}`
    if (d.sectors && d.sectors.length) {
      const s = [...d.sectors].filter((x) => x.return1y != null).sort((a, b) => b.return1y - a.return1y)
      const clean = (n) => n.replace(/\s*\(.*\)/, '')
      if (s.length) t += `。美股由 ${clean(s[0].name)} 領軍、${clean(s[s.length - 1].name)} 墊後`
    }
    points.push({ theme: '股市與輪動', text: t + '。' })
  }
  {
    let t = ''
    if (erp != null) t += `ERP 股債溢酬 ${erp}%${erp <= 1 ? '（偏低、股票相對債券不划算）' : erp >= 3 ? '（偏高、股票相對便宜）' : '（中性）'}`
    if (pe != null) t += `${t ? '；' : ''}S&P500 本益比 ${pe} 倍`
    if (divy != null) t += `${t ? '、' : ''}股息殖利率 ${divy}%`
    if (t) {
      if (real10 != null && real10 >= 2) t += '。高實質利率下，偏貴的股市估值承壓'
      points.push({ theme: '股債相對價值', text: t + '。' })
    }
  }

  const inverted = curve != null && curve < 0
  const stressed = stress != null && stress > 0.5
  const riskOn = vix != null && vix < 20 && hy && hy.signalLevel === 'low' && (stress == null || stress < 0)
  const tight = real10 != null && real10 >= 2
  let tone = 'neutral'
  let label = '中性'
  if (inverted || stressed) { tone = 'risk-off'; label = 'Risk-off／留意衰退訊號' }
  else if (riskOn) { tone = tight ? 'caution' : 'risk-on'; label = tight ? 'Risk-on，但屬晚週期（高實質利率）' : 'Risk-on（風險偏好高）' }

  const parts = []
  parts.push(riskOn ? '市場風險胃納高、信用利差與波動極度平穩' : '風險指標尚未轉極端')
  if (tight) parts.push('但實質利率偏高、估值不便宜')
  if (corepce != null && corepce > 2.5) parts.push('通膨仍黏著、壓縮降息空間')
  if (inverted) parts.push('殖利率曲線倒掛為衰退警訊')
  const summary = parts.join('，') + '。整體屬「報酬靠風險資產推動、但底層利率與估值已偏緊」的格局。'

  return { regime: { label, tone, summary }, points }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
