import axios from 'axios'
import type { DashboardData, ClioTimeEntry, ClioAllocation } from '../types'

// Use hardcoded base URL - simpler and more reliable
const API_BASE_URL = 'https://app.clio.com/api/v4'

// Get token from localStorage only (set by OAuth flow)
const getAccessToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('clio_access_token') || '';
  }
  return '';
}

const clioApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth header dynamically
clioApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
})

class ClioService {
  async getDashboardData(): Promise<DashboardData> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfWeeksWindow = new Date(now)
    startOfWeeksWindow.setDate(now.getDate() - 7 * 12)

    // Fetch time entries (YTD) and allocations (last 12 weeks window)
    const [timeEntries, allocations] = await Promise.all([
      this.fetchAllTimeEntries({ start_date: startOfYear.toISOString().slice(0, 10), end_date: now.toISOString().slice(0, 10) }),
      this.fetchAllAllocations({ start_date: startOfWeeksWindow.toISOString().slice(0, 10), end_date: now.toISOString().slice(0, 10) }),
    ])

    return this.transformData({ timeEntries, allocations, now })
  }

  private async fetchAllTimeEntries(params: { start_date: string; end_date: string; user_id?: number }): Promise<ClioTimeEntry[]> {
    const results: ClioTimeEntry[] = []
    let page = 1
    const perPage = 200
    // Loop through pages until fewer than perPage returned
    while (true) {
      const response = await clioApi.get<{ data: ClioTimeEntry[] }>(`/time_entries`, {
        params: {
          ...params,
          page,
          per_page: perPage,
          fields: 'user{id,name},date,quantity,price',
        },
      })
      const data = response.data?.data || []
      results.push(...data)
      if (data.length < perPage) break
      page += 1
    }
    return results
  }

  private async fetchAllAllocations(params: { start_date: string; end_date: string }): Promise<ClioAllocation[]> {
    const results: ClioAllocation[] = []
    let page = 1
    const perPage = 200
    while (true) {
      const response = await clioApi.get<{ data: ClioAllocation[] }>(`/allocations`, {
        params: {
          ...params,
          page,
          per_page: perPage,
          fields: 'amount,bill{id},applied_at,created_at,date',
        },
      })
      const data = response.data?.data || []
      results.push(...data)
      if (data.length < perPage) break
      page += 1
    }
    return results
  }

  private transformData(input: { timeEntries: ClioTimeEntry[]; allocations: ClioAllocation[]; now: Date; }): DashboardData {
    const { timeEntries, allocations, now } = input
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // Calculate monthly deposits from allocations in current month
    const monthlyDeposits = allocations
      .filter(a => this.isInMonth(this.getAllocationDate(a), currentMonth, currentYear))
      .reduce((sum, a) => sum + (a.amount || 0), 0)

    // Group billable hours by attorney (CURRENT MONTH ONLY)
    const attorneyHoursMap = new Map<string, number>()
    timeEntries
      .filter(entry => this.isInMonth(new Date(entry.date), currentMonth, currentYear))
      .forEach(entry => {
        const name = entry.user?.name || 'Unknown'
        const hours = attorneyHoursMap.get(name) || 0
        attorneyHoursMap.set(name, hours + (entry.quantity || 0))
      })
    const attorneyBillableHours = Array.from(attorneyHoursMap.entries())
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)

    // Calculate weekly revenue (last 12 weeks) from allocations
    const weeklyRevenue = this.calculateWeeklyRevenueFromAllocations(allocations, now)

    // Calculate YTD time entries
    const ytdTime = this.calculateYTDTime(timeEntries)

    // Calculate YTD revenue from allocations
    const ytdRevenue = this.calculateYTDRevenueFromAllocations(allocations)

    return {
      monthlyDeposits,
      attorneyBillableHours,
      weeklyRevenue,
      ytdTime,
      ytdRevenue,
    }
  }

  private calculateWeeklyRevenueFromAllocations(allocations: ClioAllocation[], now: Date) {
    const weeklyMap = new Map<string, number>()

    allocations.forEach(a => {
      const allocDate = this.getAllocationDate(a)
      const weekStart = this.getWeekStart(allocDate)
      const weekKey = this.formatDate(weekStart)
      const current = weeklyMap.get(weekKey) || 0
      weeklyMap.set(weekKey, current + (a.amount || 0))
    })

    const weeks = []
    for (let i = 11; i >= 0; i--) {
      const weekDate = new Date(now)
      weekDate.setDate(weekDate.getDate() - (i * 7))
      const weekStart = this.getWeekStart(weekDate)
      const weekKey = this.formatDate(weekStart)
      weeks.push({
        week: weekKey,
        amount: weeklyMap.get(weekKey) || 0,
      })
    }

    return weeks
  }

  private calculateYTDTime(timeEntries: ClioTimeEntry[]) {
    const monthlyMap = new Map<string, number>()

    timeEntries.forEach(entry => {
      const date = new Date(entry.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const current = monthlyMap.get(monthKey) || 0
      monthlyMap.set(monthKey, current + (entry.quantity || 0))
    })

    return Array.from(monthlyMap.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  private calculateYTDRevenueFromAllocations(allocations: ClioAllocation[]) {
    const monthlyMap = new Map<string, number>()

    allocations.forEach(a => {
      const date = this.getAllocationDate(a)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const current = monthlyMap.get(monthKey) || 0
      monthlyMap.set(monthKey, current + (a.amount || 0))
    })

    return Array.from(monthlyMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }

  private formatDate(date: Date): string {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  private getAllocationDate(a: ClioAllocation): Date {
    const raw = a.applied_at || a.date || a.created_at
    return raw ? new Date(raw) : new Date()
  }

  private isInMonth(date: Date, month: number, year: number): boolean {
    return date.getMonth() === month && date.getFullYear() === year
  }

  // Sample data for demonstration when API is not configured
  getSampleData(): DashboardData {
    return {
      monthlyDeposits: 425000,
      attorneyBillableHours: [
        { name: 'Sarah Johnson', hours: 168 },
        { name: 'Michael Chen', hours: 152 },
        { name: 'Emily Rodriguez', hours: 145 },
        { name: 'David Kim', hours: 138 },
        { name: 'Jennifer Taylor', hours: 125 },
        { name: 'Robert Martinez', hours: 118 },
        { name: 'Lisa Anderson', hours: 105 },
      ],
      weeklyRevenue: [
        { week: '8/19', amount: 85000 },
        { week: '8/26', amount: 92000 },
        { week: '9/2', amount: 78000 },
        { week: '9/9', amount: 95000 },
        { week: '9/16', amount: 88000 },
        { week: '9/23', amount: 91000 },
        { week: '9/30', amount: 105000 },
        { week: '10/7', amount: 98000 },
        { week: '10/14', amount: 102000 },
        { week: '10/21', amount: 96000 },
        { week: '10/28', amount: 89000 },
        { week: '11/4', amount: 94000 },
      ],
      ytdTime: [
        { date: '2025-01', hours: 1250 },
        { date: '2025-02', hours: 1180 },
        { date: '2025-03', hours: 1320 },
        { date: '2025-04', hours: 1290 },
        { date: '2025-05', hours: 1405 },
        { date: '2025-06', hours: 1380 },
        { date: '2025-07', hours: 1295 },
        { date: '2025-08', hours: 1350 },
        { date: '2025-09', hours: 1420 },
        { date: '2025-10', hours: 1155 },
      ],
      ytdRevenue: [
        { date: '2025-01', amount: 385000 },
        { date: '2025-02', amount: 360000 },
        { date: '2025-03', amount: 425000 },
        { date: '2025-04', amount: 410000 },
        { date: '2025-05', amount: 455000 },
        { date: '2025-06', amount: 440000 },
        { date: '2025-07', amount: 395000 },
        { date: '2025-08', amount: 420000 },
        { date: '2025-09', amount: 465000 },
        { date: '2025-10', amount: 425000 },
      ],
    }
  }
}

export const clioService = new ClioService()
