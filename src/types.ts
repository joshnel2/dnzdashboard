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
