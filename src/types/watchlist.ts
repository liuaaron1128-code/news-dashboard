// Decision-layer data: a lightweight watchlist plus a log of judgement calls
// that can be reconciled against later price action.

export interface WatchItem {
  id: string
  symbol: string // Yahoo symbol, e.g. 2330.TW / AAPL
  name: string
  thesis: string // why we are watching
  addedDate: string
  targetNote?: string
  // Filled in daily by the fetch script so the UI shows live context.
  price?: number | null
  ytd?: number | null
  return1y?: number | null
  // Simplified risk inputs for the What-if simulator (rough estimates).
  beta?: number // equity beta vs broad market
  duration?: number // years, for rate sensitivity (0 for pure equity)
  weight?: number // optional portfolio weight 0–1
}

export interface Decision {
  date: string
  symbol: string
  name?: string
  action: 'buy' | 'sell' | 'hold' | 'watch'
  rationale: string
  priceAtDecision?: number | null
}

export interface WatchlistData {
  asOf?: string
  items: WatchItem[]
}
