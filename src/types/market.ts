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

// Generic single-number indicator used by relative-value, risk, policy-rate
// and global-yield sections.
export interface Metric {
  id: string
  label: string
  value: number | null
  unit: string
  signal?: string
  signalLevel?: SignalLevel
  note?: string
}

export type RegimeTone = 'risk-on' | 'risk-off' | 'caution' | 'neutral'

export interface SynthesisPoint {
  theme: string
  text: string
}

export interface SynthesisScenario {
  name: string
  text: string
}

export interface Synthesis {
  engine?: 'ai' | 'rule'
  regime: { label: string; tone: RegimeTone; summary: string }
  points: SynthesisPoint[]
  scenarios?: SynthesisScenario[]
  positioning?: string[]
  watch?: string[]
}

export interface MarketSignals {
  generatedAt: string
  asOf: string
  source: string
  placeholder?: boolean
  synthesis?: Synthesis | null
  headline: SignalHeadline[]
  relativeValue: Metric[]
  riskIndicators: Metric[]
  macro: Metric[]
  bondYields: BondYield[]
  globalYields: Metric[]
  policyRates: Metric[]
  equityReturns: EquityReturn[]
  sectors: EquityReturn[]
  otherAssets: OtherAsset[]
}
