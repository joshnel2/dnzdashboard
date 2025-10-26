export interface AttorneyBillableHours {
  name: string
  hours: number
}

export interface WeeklyRevenue {
  week: string
  amount: number
}

export interface YTDTimeEntry {
  date: string
  hours: number
}

export interface YTDRevenueEntry {
  date: string
  amount: number
}

export interface DashboardData {
  monthlyDeposits: number
  attorneyBillableHours: AttorneyBillableHours[]
  weeklyRevenue: WeeklyRevenue[]
  ytdTime: YTDTimeEntry[]
  ytdRevenue: YTDRevenueEntry[]
}

export interface ClioUser {
  id: number
  name: string
}

export interface ClioTimeEntry {
  id: number
  user: ClioUser
  date: string
  quantity: number
  price: number
  occurred_at?: string
}

// Clio Payments represent money-in applied to bills (revenue receipts)
export interface ClioPayment {
  id: number
  date: string
  amount: number
  created_at?: string
  applied_at?: string
}
