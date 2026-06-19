// Client-side analytics over the signal history time-series. No dependencies —
// pure functions so the UI can compute trends, z-scores and rule-based
// divergence flags from the static JSON at render time.

import { SignalHistoryPoint } from '@/types/history'

export type SeriesKey = keyof Omit<SignalHistoryPoint, 'date'>

export function series(history: SignalHistoryPoint[], key: SeriesKey): number[] {
  return history.map((p) => p[key]).filter((v): v is number => v != null)
}

export function latest(history: SignalHistoryPoint[], key: SeriesKey): number | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const v = history[i][key]
    if (v != null) return v
  }
  return null
}

// z-score of the most recent value vs the rest of the series.
export function zScore(values: number[]): number | null {
  if (values.length < 8) return null
  const last = values[values.length - 1]
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  if (std === 0) return null
  return (last - mean) / std
}

// Change over the last `n` points (absolute units).
export function delta(values: number[], n = 5): number | null {
  if (values.length < 2) return null
  const from = values[Math.max(0, values.length - 1 - n)]
  const to = values[values.length - 1]
  return to - from
}

export interface AnomalyTag {
  level: 'high' | 'low' | 'normal'
  z: number | null
  label: string
}

export function anomaly(values: number[]): AnomalyTag {
  const z = zScore(values)
  if (z == null) return { level: 'normal', z: null, label: '資料不足' }
  if (z >= 2) return { level: 'high', z, label: `異常偏高 (+${z.toFixed(1)}σ)` }
  if (z <= -2) return { level: 'low', z, label: `異常偏低 (${z.toFixed(1)}σ)` }
  return { level: 'normal', z, label: `正常 (${z >= 0 ? '+' : ''}${z.toFixed(1)}σ)` }
}

export interface DivergenceInput {
  latestPoint: SignalHistoryPoint | null
  bubbleRisk?: number
  sentimentScore?: number | null
}

export interface Divergence {
  id: string
  level: 'high' | 'medium' | 'low'
  text: string
}

// Rule-based cross-signal detection — deterministic, explainable companions to
// the AI commentary's crossSignals.
export function detectDivergences(input: DivergenceInput): Divergence[] {
  const out: Divergence[] = []
  const p = input.latestPoint
  const risk = input.bubbleRisk
  const fg = input.sentimentScore

  if (p?.vix != null && risk != null && p.vix < 15 && risk >= 60) {
    out.push({
      id: 'vix-bubble',
      level: 'high',
      text: `VIX 偏低 (${p.vix})＋泡沫分數偏高 (${risk})：市場自滿，下檔保護便宜但風險累積。`,
    })
  }
  if (p?.curve10y2y != null && p.curve10y2y < 0) {
    out.push({
      id: 'curve',
      level: 'high',
      text: `殖利率曲線倒掛 (${p.curve10y2y})：經典衰退領先訊號，通常領先 6–18 個月。`,
    })
  }
  if (p?.erp != null && p.erp < 0) {
    out.push({
      id: 'erp',
      level: 'medium',
      text: `股債風險溢酬為負 (${p.erp}%)：股票相對債券不划算，估值偏貴。`,
    })
  }
  if (fg != null && fg >= 75 && risk != null && risk >= 55) {
    out.push({
      id: 'greed',
      level: 'medium',
      text: `情緒極度貪婪 (${fg})＋泡沫分數偏高 (${risk})：追高風險升溫。`,
    })
  }
  if (fg != null && fg <= 25) {
    out.push({
      id: 'fear',
      level: 'low',
      text: `情緒極度恐懼 (${fg})：歷史上常是中期的逆勢佈局區。`,
    })
  }
  return out
}
