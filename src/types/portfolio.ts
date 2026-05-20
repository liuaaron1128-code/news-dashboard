export interface DCAContract {
  id: string
  startDate: string
  paymentDay: number
  monthlyAmount: number
  status: 'active' | 'paused'
  confirmedPayments?: number  // for paused funds: fixed count from last known state
}

export interface Fund {
  code: string
  name: string
  shortName: string
  currency: 'TWD' | 'USD'
  category: string
  icon: string
  color: string
  contracts: DCAContract[]
  isTISA: boolean
}

export interface Portfolio {
  funds: Fund[]
}

export interface FundAnalysis {
  code: string
  totalInvested: number
  paymentsCount: number
  nav: number | null
  navDate: string | null
  estimatedValue: number | null
  returnAmount: number | null
  returnPercent: number | null
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  riskNotes: string
  allocation: number  // % of total portfolio
}

export interface DCAToday {
  fundCode: string
  fundName: string
  contractId: string
  amount: number
  paymentDay: number
}

export interface Alert {
  level: 'info' | 'warning' | 'danger'
  title: string
  detail: string
  fundCode?: string
}

export interface PortfolioSummary {
  totalInvested: number
  estimatedValue: number | null
  returnAmount: number | null
  returnPercent: number | null
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
  monthlyDCA: number
}

export interface PortfolioAnalysis {
  date: string
  generatedAt: string
  summary: PortfolioSummary
  dcaToday: DCAToday[]
  dcaUpcoming: (DCAToday & { daysUntil: number })[]
  funds: FundAnalysis[]
  alerts: Alert[]
  marketContext: string
  recommendation: string
}
