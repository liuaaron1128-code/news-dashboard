export type SignalLevel = 'high' | 'low' | 'neutral'

export interface SignalHeadline {
  id: string
  icon: string
  title: string
  value: string
  tag: string
  tagLevel: SignalLevel
  detail: string
}

export interface BondYield {
  id: string
  region: string
  name: string
  yield: number
  changeBps: number | null
  percentile5y: number | null
  signal: string
}

export interface EquityReturn {
  id: string
  region: string
  name: string
  price: number | null
  ytd: number | null
  return1y: number | null
  cagr3y: number | null
  cagr5y: number | null
}

export interface OtherAsset {
  id: string
  name: string
  icon: string
  price: number | null
  ytd: number | null
  return1y: number | null
  cagr5y: number | null
}

export interface MarketSignals {
  generatedAt: string
  asOf: string
  source: string
  placeholder?: boolean
  headline: SignalHeadline[]
  bondYields: BondYield[]
  equityReturns: EquityReturn[]
  otherAssets: OtherAsset[]
}
