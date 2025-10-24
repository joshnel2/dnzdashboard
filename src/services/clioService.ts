import axios from 'axios'
import type { DashboardData, ClioTimeEntry, ClioActivity } from '../types'

// Route all requests through our serverless proxy to avoid CORS
const API_BASE_URL = '/api/clio'

const clioApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Same-origin requests automatically include cookies; no extra config needed
})

class ClioService {
  async getDashboardData(): Promise<DashboardData> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    console.log('[ClioService] getDashboardData()', {
      since: startOfYear.toISOString(),
      baseUrl: API_BASE_URL,
    })

    const [timeEntriesResponse, activitiesResponse] = await Promise.all([
      clioApi.get<{ data: ClioTimeEntry[] }>('/time_entries.json', {
        params: {
          since: startOfYear.toISOString(),
          fields: 'user{id,name},date,quantity,price,occurred_at',
        },
      }),
      clioApi.get<{ data: ClioActivity[] }>('/activities.json', {
        params: {
          since: startOfYear.toISOString(),
          type: 'Payment',
          // Ensure the total and date fields are returned
          fields: 'date,total,type,amount,price,occurred_at,created_at',
        },
      })
    ])

    const timeEntriesRaw = timeEntriesResponse.data?.data || []
    const activitiesRaw = activitiesResponse.data?.data || []
    const timeCount = timeEntriesRaw.length
    const activityCount = activitiesRaw.length
    console.log('[ClioService] API responses received', {
      timeEntriesCount: timeCount,
      activitiesCount: activityCount,
      timeEntrySample: timeEntriesRaw.slice(0, 2).map(e => ({
        keys: Object.keys(e),
        date: (e as any).date,
        occurred_at: (e as any).occurred_at,
        created_at: (e as any).created_at,
        quantity: (e as any).quantity,
        duration: (e as any).duration,
        user: (e as any).user?.name,
      })),
      activitySample: activitiesRaw.slice(0, 2).map(a => ({
        keys: Object.keys(a),
        date: (a as any).date,
        occurred_at: (a as any).occurred_at,
        created_at: (a as any).created_at,
        total: (a as any).total,
        amount: (a as any).amount,
        price: (a as any).price,
        type: (a as any).type,
      })),
    })

    return this.transformData(timeEntriesResponse.data.data || [], activitiesResponse.data.data || [])
  }

  transformData(timeEntries: ClioTimeEntry[], activities: ClioActivity[]): DashboardData {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    console.log('[ClioService] transformData()', {
      timeEntries: timeEntries.length,
      activities: activities.length,
      currentMonth: currentMonth + 1,
      currentYear,
    })

    // Calculate monthly deposits
    const monthlyDeposits = activities
      .filter(activity => {
        const effectiveDateStr = activity.occurred_at || activity.date || activity.created_at
        const activityDate = effectiveDateStr ? new Date(effectiveDateStr) : new Date(NaN)
        return activityDate.getMonth() === currentMonth && 
               activityDate.getFullYear() === currentYear
      })
      .reduce((sum, activity) => {
        const value =
          (typeof activity.total === 'number' ? activity.total : undefined) ??
          (typeof activity.amount === 'number' ? activity.amount : undefined) ??
          (typeof activity.price === 'number' ? activity.price : undefined) ??
          0
        return sum + value
      }, 0)
    console.log('[ClioService] Monthly deposits (current month)', { monthlyDeposits })

    // Group billable hours by attorney (CURRENT MONTH ONLY)
    const attorneyHoursMap = new Map<string, number>()
    const timeEntriesInMonth = timeEntries.filter(entry => {
      const effectiveDateStr = entry.occurred_at || entry.date || (entry as any).created_at
      const entryDate = effectiveDateStr ? new Date(effectiveDateStr) : new Date(NaN)
      return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear
    })
    console.log('[ClioService] Time entries filtering', {
      totalTimeEntries: timeEntries.length,
      inMonthCount: timeEntriesInMonth.length,
    })
    timeEntriesInMonth.forEach(entry => {
      const name = entry.user?.name || 'Unknown'
      const quantity = typeof entry.quantity === 'number' ? entry.quantity : undefined
      const duration = typeof (entry as any).duration === 'number' ? (entry as any).duration : undefined
      const hours = quantity ?? (duration !== undefined ? duration / 3600 : 0)
      const current = attorneyHoursMap.get(name) || 0
      attorneyHoursMap.set(name, current + hours)
    })
    const attorneyBillableHours = Array.from(attorneyHoursMap.entries())
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
    console.log('[ClioService] Attorney billable hours (top 5)', attorneyBillableHours.slice(0, 5))

    // Calculate weekly revenue (last 12 weeks)
    const weeklyRevenue = this.calculateWeeklyRevenue(activities)
    console.log('[ClioService] Weekly revenue weeks', weeklyRevenue.length)

    // Calculate YTD time entries
    const ytdTime = this.calculateYTDTime(timeEntries)
    console.log('[ClioService] YTD time months', ytdTime.length)

    // Calculate YTD revenue
    const ytdRevenue = this.calculateYTDRevenue(activities)
    console.log('[ClioService] YTD revenue months', ytdRevenue.length)

    return {
      monthlyDeposits,
      attorneyBillableHours,
      weeklyRevenue,
      ytdTime,
      ytdRevenue,
    }
  }

  calculateWeeklyRevenue(activities: ClioActivity[]) {
    const weeklyMap = new Map<string, number>()
    const now = new Date()

    activities.forEach(activity => {
      const effectiveDateStr = activity.occurred_at || activity.date || activity.created_at
      const activityDate = effectiveDateStr ? new Date(effectiveDateStr) : new Date(NaN)
      const weekStart = this.getWeekStart(activityDate)
      const weekKey = this.formatDate(weekStart)
      
      const deposit =
        (typeof activity.total === 'number' ? activity.total : undefined) ??
        (typeof activity.amount === 'number' ? activity.amount : undefined) ??
        (typeof activity.price === 'number' ? activity.price : undefined) ??
        0
      const current = weeklyMap.get(weekKey) || 0
      weeklyMap.set(weekKey, current + deposit)
    })

    // Get last 12 weeks
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

  calculateYTDTime(timeEntries: ClioTimeEntry[]) {
    const monthlyMap = new Map<string, number>()

    timeEntries.forEach(entry => {
      const effectiveDateStr = entry.occurred_at || entry.date || (entry as any).created_at
      const date = effectiveDateStr ? new Date(effectiveDateStr) : new Date(NaN)
      
      if (isNaN(date.getTime())) return // Skip invalid dates
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      const quantity = typeof entry.quantity === 'number' ? entry.quantity : undefined
      const duration = typeof (entry as any).duration === 'number' ? (entry as any).duration : undefined
      const hours = quantity ?? (duration !== undefined ? duration / 3600 : 0)
      
      const current = monthlyMap.get(monthKey) || 0
      monthlyMap.set(monthKey, current + hours)
    })

    return Array.from(monthlyMap.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  calculateYTDRevenue(activities: ClioActivity[]) {
    const monthlyMap = new Map<string, number>()

    activities.forEach(activity => {
      const effectiveDateStr = activity.occurred_at || activity.date || activity.created_at
      const date = effectiveDateStr ? new Date(effectiveDateStr) : new Date(NaN)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      const deposit =
        (typeof activity.total === 'number' ? activity.total : undefined) ??
        (typeof activity.amount === 'number' ? activity.amount : undefined) ??
        (typeof activity.price === 'number' ? activity.price : undefined) ??
        0
      const current = monthlyMap.get(monthKey) || 0
      monthlyMap.set(monthKey, current + deposit)
    })

    return Array.from(monthlyMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }

  formatDate(date: Date): string {
    return `${date.getMonth() + 1}/${date.getDate()}`
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
