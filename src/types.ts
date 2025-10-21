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

export interface ClioActivity {
  id: number
  date: string
  total?: number
  amount?: number
  price?: number
  type?: string
  occurred_at?: string
  created_at?: string
}
