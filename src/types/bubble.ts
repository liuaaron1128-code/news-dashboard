export type RiskLevel = 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW' | 'SAFE'
export type AlertColor = 'red' | 'orange' | 'yellow' | 'green'

export interface BubbleIndicator {
  id: string
  name: string
  fullName: string
  value: string
  numericValue: number
  riskScore: number
  level: RiskLevel
  historicalAvg: string
  currentVsAvg: string
  benchmark: string
  description: string
  implication: string
}

export interface ActionRecommendation {
  priority: string
  level: 'high' | 'medium' | 'low'
  action: string
  detail: string
}

export interface HistoricalComparison {
  period: string
  cape: number
  buffett: number
  result: string
}

export interface BubbleSnapshot {
  date: string
  defconLevel: number
  overallRisk: number
  alertLabel: string
  alertColor: AlertColor
  summary: string
  indicators: BubbleIndicator[]
  actionRecommendations: ActionRecommendation[]
  historicalComparisons: HistoricalComparison[]
}
