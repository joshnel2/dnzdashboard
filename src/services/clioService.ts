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

// Utilities to infer and extract collection arrays from Clio responses
function inferCollectionKey(url: string | undefined): string | undefined {
  if (!url) return undefined
  const match = url.match(/\/([a-z_]+)\.json/i)
  return match ? match[1] : undefined
}

function extractArrayData(body: any, collectionKey?: string): any[] {
  if (!body) return []
  // Common shapes
  if (Array.isArray(body.data)) return body.data
  if (collectionKey) {
    const direct = body[collectionKey]
    if (Array.isArray(direct)) return direct
    if (direct && typeof direct === 'object') {
      if (Array.isArray(direct.items)) return direct.items
      if (Array.isArray(direct.records)) return direct.records
    }
  }
  if (body.data && typeof body.data === 'object' && collectionKey && Array.isArray(body.data[collectionKey])) {
    return body.data[collectionKey]
  }
  if (Array.isArray((body as any).items)) return (body as any).items
  if (Array.isArray((body as any).records)) return (body as any).records
  const arrayEntries = Object.entries(body).filter(([, v]) => Array.isArray(v as any))
  if (arrayEntries.length === 1) return arrayEntries[0][1] as any[]
  return []
}

// Add lightweight request/response logging to help diagnose issues
clioApi.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase()
  const url = `${config.baseURL || ''}${config.url || ''}`
  const params = config.params || {}
  ;(config as any).meta = { start: Date.now() }
  console.log('[ClioService] Request', { method, url, params })
  return config
})

clioApi.interceptors.response.use(
  (response) => {
    const meta = (response.config as any).meta
    const durationMs = meta?.start ? Date.now() - meta.start : undefined
    const url = `${response.config.baseURL || ''}${response.config.url || ''}`
    const collectionKey = inferCollectionKey(response.config.url)
    const arr = extractArrayData(response.data, collectionKey)
    const count = Array.isArray(arr) ? arr.length : undefined
    console.log('[ClioService] Response', {
      url,
      status: response.status,
      durationMs,
      count,
    })
    return response
  },
  (error) => {
    const config = error.config || {}
    const method = (config.method || 'get').toUpperCase()
    const url = `${config.baseURL || ''}${config.url || ''}`
    const status = error.response?.status
    console.error('[ClioService] HTTP Error', {
      method,
      url,
      status,
      data: error.response?.data,
      message: error.message,
    })
    return Promise.reject(error)
  }
)

class ClioService {
  async getDashboardData(): Promise<DashboardData> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    console.log('[ClioService] getDashboardData()', {
      baseUrl: API_BASE_URL,
      since: startOfYear.toISOString(),
      monthSince: startOfMonth.toISOString(),
      monthUntil: endOfMonth.toISOString(),
    })

    // Fetch all pages for each endpoint to avoid partial results
    const [timeEntriesRaw, activitiesRaw] = await Promise.all([
      this.fetchTimeEntries(),
      this.fetchPaymentsOrActivities(startOfYear.toISOString()),
    ])

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

    return this.transformData(timeEntriesRaw, activitiesRaw)
  }

  // Try multiple sources for time entries to maximize compatibility
  private async fetchTimeEntries(): Promise<ClioTimeEntry[]> {
    // 1) Native time entries endpoint
    const timeEntries = await this.fetchAll<ClioTimeEntry>('/time_entries.json', { per_page: 200 })
    if (timeEntries.length > 0) return timeEntries

    console.warn('[ClioService] /time_entries.json returned 0 items; trying activities?types[]=TimeEntry')

    // 2) Activities filtered to time entries
    const activityTimeEntries = await this.fetchAll<any>('/activities.json', {
      'types[]': ['TimeEntry'],
      per_page: 200,
    })
    if (activityTimeEntries.length > 0) {
      // Normalize minimal shape
      const normalized: ClioTimeEntry[] = activityTimeEntries.map((a: any) => ({
        id: a.id,
        user: typeof a.user === 'object' && a.user
          ? { id: a.user.id, name: a.user.name }
          : { id: a.user_id || 0, name: a.user_name || 'Unknown' },
        date: a.date || a.occurred_at || a.created_at,
        quantity: typeof a.quantity === 'number' ? a.quantity : (typeof a.duration === 'number' ? a.duration / 3600 : 0),
        price: typeof a.price === 'number' ? a.price : 0,
        occurred_at: a.occurred_at,
      }))
      return normalized
    }

    console.warn('[ClioService] activities?type=TimeEntry returned 0; trying unfiltered activities heuristics')

    // 3) As a last resort, unfiltered activities and pick ones that look like time entries
    const activities = await this.fetchAll<any>('/activities.json', { per_page: 200 })
    const heuristicTimeEntries = activities
      .filter((a: any) => typeof a.quantity === 'number' || typeof a.duration === 'number')
      .map((a: any) => ({
        id: a.id,
        user: typeof a.user === 'object' && a.user
          ? { id: a.user.id, name: a.user.name }
          : { id: a.user_id || 0, name: a.user_name || 'Unknown' },
        date: a.date || a.occurred_at || a.created_at,
        quantity: typeof a.quantity === 'number' ? a.quantity : (typeof a.duration === 'number' ? a.duration / 3600 : 0),
        price: typeof a.price === 'number' ? a.price : 0,
        occurred_at: a.occurred_at,
      })) as ClioTimeEntry[]

    return heuristicTimeEntries
  }

  // Fetch all pages from a Clio collection endpoint
  private async fetchAll<T>(path: string, baseParams: Record<string, any>): Promise<T[]> {
    const results: T[] = []
    let page = 1
    const perPage = Number(baseParams.per_page ?? baseParams.limit) || 200
    // Avoid mutating caller's params
    const params = { ...baseParams }

    for (;;) {
      const resp = await clioApi.get<any>(path, {
        params: { ...params, page, per_page: perPage, page_size: perPage, limit: perPage },
      })
      const collectionKey = inferCollectionKey(path)
      const pageItems: T[] = extractArrayData(resp.data, collectionKey)
      console.log('[ClioService] fetchAll page', {
        path,
        page,
        count: pageItems.length,
        keys: page === 1 ? Object.keys(resp.data || {}) : undefined,
        collectionKey,
      })
      results.push(...pageItems)
      if (pageItems.length < perPage) break
      page += 1
      if (page > 50) { // safety guard against runaway pagination
        console.warn('[ClioService] fetchAll page limit reached, stopping', { path })
        break
      }
    }
    console.log('[ClioService] fetchAll done', { path, total: results.length })
    return results
  }

  // Try payments first; if none found, fallback to activities to approximate revenue
  private async fetchPaymentsOrActivities(_sinceIso: string): Promise<ClioActivity[]> {
    try {
      const payments = await this.fetchAll<any>('/payments.json', { per_page: 200 })
      if (payments.length > 0) {
        // Normalize payments to the ClioActivity shape consumed by downstream transforms
        const normalized: ClioActivity[] = payments.map((p: any) => ({
          id: p.id,
          date: p.date || p.recorded_at || p.created_at,
          total: typeof p.total === 'number' ? p.total : (typeof p.amount === 'number' ? p.amount : undefined),
          amount: typeof p.amount === 'number' ? p.amount : undefined,
          price: typeof p.price === 'number' ? p.price : undefined,
          type: 'Payment',
          occurred_at: p.occurred_at || p.date || p.recorded_at,
          created_at: p.created_at,
        }))
        return normalized
      }
    } catch (e) {
      console.warn('[ClioService] payments fetch failed, will fallback to activities')
    }

    // Try bill payments endpoint commonly used in Clio for recorded payments
    try {
      const billPayments = await this.fetchAll<any>('/bill_payments.json', { per_page: 200 })
      if (billPayments.length > 0) {
        const normalized: ClioActivity[] = billPayments.map((p: any) => ({
          id: p.id,
          date: p.paid_at || p.date || p.created_at,
          total:
            typeof p.amount === 'number' ? p.amount :
            typeof p.applied_amount === 'number' ? p.applied_amount :
            typeof p.total === 'number' ? p.total : undefined,
          amount: typeof p.amount === 'number' ? p.amount : (typeof p.applied_amount === 'number' ? p.applied_amount : undefined),
          price: undefined,
          type: 'Payment',
          occurred_at: p.paid_at || p.date,
          created_at: p.created_at,
        }))
        return normalized
      }
    } catch {}

    // Fallback to activities filtered to payments (try multiple param shapes)
    let activitiesResp: ClioActivity[] = []
    try {
      activitiesResp = await this.fetchAll<ClioActivity>('/activities.json', {
        'types[]': ['Payment', 'payment'],
        per_page: 200,
      })
    } catch {}
    if (activitiesResp.length > 0) return activitiesResp

    try {
      activitiesResp = await this.fetchAll<ClioActivity>('/activities.json', {
        type: 'Payment', // alternate param key just in case
        per_page: 200,
      })
    } catch {}
    if (activitiesResp.length > 0) return activitiesResp

    // As last resort, use unfiltered activities and pick ones that look like payments
    console.warn('[ClioService] Payment-specific endpoints returned 0; using heuristic on activities')
    const allActivities = await this.fetchAll<any>('/activities.json', { per_page: 200 })
    const heuristicPayments: ClioActivity[] = allActivities
      .filter((a: any) => {
        const type = (a.type || a.activity_type || '').toString().toLowerCase()
        return type.includes('payment') || typeof a.total === 'number' || typeof a.amount === 'number'
      })
      .map((a: any) => ({
        id: a.id,
        date: a.date || a.occurred_at || a.created_at,
        total: typeof a.total === 'number' ? a.total : (typeof a.amount === 'number' ? a.amount : undefined),
        amount: typeof a.amount === 'number' ? a.amount : undefined,
        price: typeof a.price === 'number' ? a.price : undefined,
        type: a.type || 'Payment',
        occurred_at: a.occurred_at,
        created_at: a.created_at,
      }))
    return heuristicPayments
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
