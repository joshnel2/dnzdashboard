import axios from 'axios'
import type { DashboardData, ClioTimeEntry, ClioActivity, ClioUser } from '../types'

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
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthUntil = new Date(nextMonthStart.getTime() - 1)

    console.log('[ClioService] getDashboardData()', {
      baseUrl: API_BASE_URL,
      since: startOfYear.toISOString(),
      monthSince: currentMonthStart.toISOString(),
      monthUntil: monthUntil.toISOString(),
    })

    const [timeEntries, activities] = await Promise.all([
      this.fetchTimeEntries(startOfYear.toISOString()),
      this.fetchPaymentsOrActivities(startOfYear.toISOString()),
    ])

    console.log('[ClioService] API responses received', {
      timeEntriesCount: timeEntries.length,
      activitiesCount: activities.length,
      timeEntrySample: timeEntries.slice(0, 2).map(e => ({
        keys: Object.keys(e as any),
        date: (e as any).date,
        occurred_at: (e as any).occurred_at,
        created_at: (e as any).created_at,
        quantity: (e as any).quantity,
        duration: (e as any).duration,
        user: (e as any).user?.name,
      })),
      activitySample: activities.slice(0, 2).map(a => ({
        keys: Object.keys(a as any),
        date: (a as any).date,
        occurred_at: (a as any).occurred_at,
        created_at: (a as any).created_at,
        total: (a as any).total,
        amount: (a as any).amount,
        price: (a as any).price,
        type: (a as any).type,
      })),
    })

    return this.transformData(timeEntries, activities)
  }

  private async fetchTimeEntries(sinceIso: string): Promise<ClioTimeEntry[]> {
    // Primary: dedicated time entries endpoint
    const direct = await this.fetchAll<any>('/time_entries.json', {
      'occurred_at[gte]': sinceIso,
      fields: 'user{id,name},date,quantity,price,occurred_at,created_at',
    }, 'time_entries')

    if (direct.length > 0) {
      console.log('[ClioService] fetchAll done', { path: '/time_entries.json', total: direct.length })
      return direct as ClioTimeEntry[]
    }

    console.log('[ClioService] /time_entries.json returned 0 items; trying activities?types[]=TimeEntry')
    const activitiesTime = await this.fetchAll<any>('/activities.json', {
      'occurred_at[gte]': sinceIso,
      'types[]': 'TimeEntry',
      fields: 'user{id,name},date,quantity,price,occurred_at,created_at,type',
    }, 'activities')

    if (activitiesTime.length === 0) {
      console.log('[ClioService] activities?type=TimeEntry returned 0; trying unfiltered activities heuristics')
      const activitiesAll = await this.fetchAll<any>('/activities.json', {
        'occurred_at[gte]': sinceIso,
        fields: 'user{id,name},date,quantity,price,occurred_at,created_at,type',
      }, 'activities')
      const mapped = activitiesAll
        .filter((a: any) => a?.type === 'TimeEntry' || a?.quantity !== undefined)
        .map((a: any) => this.toClioTimeEntryFromActivity(a))
      return mapped
    }

    return activitiesTime.map((a: any) => this.toClioTimeEntryFromActivity(a))
  }

  private async fetchPaymentsOrActivities(sinceIso: string): Promise<ClioActivity[]> {
    // Try specific payment endpoints first
    const payments = await this.fetchAll<any>('/payments.json', {
      'occurred_at[gte]': sinceIso,
      fields: 'date,total,amount,price,occurred_at,created_at',
    }, 'payments')
    if (payments.length > 0) {
      return payments.map(p => this.toActivityFromPaymentLike(p))
    }
    
    const billPayments = await this.fetchAll<any>('/bill_payments.json', {
      'occurred_at[gte]': sinceIso,
      fields: 'date,total,amount,price,occurred_at,created_at',
    }, 'bill_payments')
    if (billPayments.length > 0) {
      return billPayments.map(p => this.toActivityFromPaymentLike(p))
    }

    console.log('[ClioService] Payment-specific endpoints returned 0; using heuristic on activities')
    const activities = await this.fetchAll<any>('/activities.json', {
      'occurred_at[gte]': sinceIso,
      'types[]': 'Payment',
      fields: 'date,total,amount,price,occurred_at,created_at,type',
    }, 'activities')
    if (activities.length > 0) {
      return activities.map(a => this.toActivityFromPaymentLike(a))
    }

    // Last resort: unfiltered activities and pick likely payment-like ones
    const allActivities = await this.fetchAll<any>('/activities.json', {
      'occurred_at[gte]': sinceIso,
      fields: 'date,total,amount,price,occurred_at,created_at,type',
    }, 'activities')
    return allActivities
      .filter(a => a?.type === 'Payment' || typeof a?.total === 'number' || typeof a?.amount === 'number' || typeof a?.price === 'number')
      .map(a => this.toActivityFromPaymentLike(a))
  }

  private toClioTimeEntryFromActivity(a: any): ClioTimeEntry {
    const user: ClioUser = a?.user && typeof a.user === 'object'
      ? { id: Number(a.user.id) || 0, name: String(a.user.name || 'Unknown') }
      : { id: 0, name: 'Unknown' }
    const dateStr: string = a?.date || a?.occurred_at || a?.created_at || new Date().toISOString()
    const quantity: number = typeof a?.quantity === 'number'
      ? a.quantity
      : typeof a?.duration === 'number'
      ? a.duration / 3600
      : 0
    const price: number = typeof a?.price === 'number'
      ? a.price
      : typeof a?.amount === 'number'
      ? a.amount
      : 0
    const id: number = Number(a?.id) || Math.floor(Math.random() * 1_000_000_000)
    return {
      id,
      user,
      date: dateStr,
      quantity,
      price,
      occurred_at: a?.occurred_at,
    }
  }

  private toActivityFromPaymentLike(obj: any): ClioActivity {
    const dateStr: string = obj?.occurred_at || obj?.date || obj?.created_at || new Date().toISOString()
    const total: number | undefined = typeof obj?.total === 'number' ? obj.total : undefined
    const amount: number | undefined = typeof obj?.amount === 'number' ? obj.amount : undefined
    const price: number | undefined = typeof obj?.price === 'number' ? obj.price : undefined
    const type: string | undefined = typeof obj?.type === 'string' ? obj.type : 'Payment'
    const id: number = Number(obj?.id) || Math.floor(Math.random() * 1_000_000_000)
    return {
      id,
      date: dateStr,
      total,
      amount,
      price,
      type,
      occurred_at: obj?.occurred_at,
      created_at: obj?.created_at,
    }
  }

  private async fetchAll<T>(
    path: string,
    params: Record<string, any>,
    collectionKey?: string
  ): Promise<T[]> {
    const perPage = 200
    let page = 1
    const results: T[] = []

    while (true) {
      const response = await clioApi.get<any>(path, {
        params: { ...params, page, per_page: perPage },
      })

      const body = response?.data
      const keys = body && typeof body === 'object' ? Object.keys(body) : []
      let pageItems: T[] = []
      if (Array.isArray(body?.data)) {
        pageItems = body.data as T[]
      } else if (collectionKey && Array.isArray((body as any)?.[collectionKey])) {
        pageItems = (body as any)[collectionKey] as T[]
      } else {
        const firstArrayKey = keys.find(k => Array.isArray((body as any)[k]))
        if (firstArrayKey) {
          pageItems = (body as any)[firstArrayKey] as T[]
        } else if (Array.isArray(body)) {
          pageItems = body as T[]
        } else {
          pageItems = []
        }
      }

      console.log('[ClioService] Request', { method: 'GET', url: `${API_BASE_URL}${path}`, params: { ...params, page, per_page: perPage } })
      console.log('[ClioService] Response', { url: `${API_BASE_URL}${path}`, status: 200, count: pageItems.length })
      console.log('[ClioService] fetchAll page', { path, page, count: pageItems.length, keys, collectionKey: collectionKey || 'data' })

      results.push(...pageItems)

      // Determine pagination
      const totalPages = body?.meta?.paging?.total_pages
      const hasMoreByMeta = typeof totalPages === 'number' ? page < totalPages : undefined
      const hasMoreByCount = pageItems.length === perPage
      if (hasMoreByMeta === false || (!hasMoreByMeta && !hasMoreByCount)) {
        break
      }
      page += 1
    }

    console.log('[ClioService] fetchAll done', { path, total: results.length })
    return results
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
      const date = new Date(entry.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      const current = monthlyMap.get(monthKey) || 0
      monthlyMap.set(monthKey, current + entry.quantity)
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
