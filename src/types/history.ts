// Compact daily time-series of the key market signals. Appended once per day
// by scripts/append-history.mjs (market_signals.json itself is overwritten, so
// this file is the *only* place trend/lookback data lives).

export interface SignalHistoryPoint {
  date: string // YYYY-MM-DD
  us10y: number | null
  us2y: number | null
  curve10y2y: number | null
  erp: number | null
  pe: number | null
  vix: number | null
  spx: number | null
  gold: number | null
  btc: number | null
  dxy: number | null
}

// Which fields are plottable and how to present them.
export interface TrendSpec {
  key: keyof Omit<SignalHistoryPoint, 'date'>
  label: string
  unit: string
  // true => higher is "risk-on/expensive" (used only for colour hinting)
  higherIsHot?: boolean
}
