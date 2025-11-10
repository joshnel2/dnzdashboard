import axios, { AxiosHeaders } from 'axios'
import type { DashboardData } from '../types'

const DEFAULT_API_BASE_URL = 'https://app.clio.com/api/v4'
const API_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLIO_API_BASE_URL
    ? import.meta.env.VITE_CLIO_API_BASE_URL
    : DEFAULT_API_BASE_URL

const DEBUG_ENABLED =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLIO_DEBUG === 'true') ||
  (typeof window !== 'undefined' && window.localStorage?.getItem('clio_debug') === 'true')

const PER_PAGE = 200
const MAX_PAGES = 1000
const WEEKS_TO_DISPLAY = 12

type DateRange = {
  start: Date
  end: Date
}

type PossiblyNumeric = string | number | null | undefined

interface ClioPaging {
  current_page?: number
  next?: number | string | null
  total_pages?: number
}

interface ClioPaginated<T> {
  data?: T[]
  meta?: {
    paging?: ClioPaging
  }
}

interface ClioUserRef {
  id?: number
  name?: string | null
}

interface ClioTimeEntry {
  id: number
  date?: string | null
  quantity?: PossiblyNumeric
  billed_quantity?: PossiblyNumeric
  duration?: PossiblyNumeric
  billable?: boolean | null
  user?: ClioUserRef | null
}

interface ClioActivity {
  id: number
  date?: string | null
  amount?: PossiblyNumeric
  type?: string | null
  activity_type?: string | null
}

const getAccessToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('clio_access_token') || ''
  }
  return ''
}

const clioApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

clioApi.interceptors.request.use((config) => {
  const headers = (config.headers = AxiosHeaders.from(config.headers))

  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  } else {
    headers.delete('Authorization')
  }

  headers.set('Accept', 'application/json')
  return config
})

class ClioService {
  private debug(message: string, ...args: unknown[]) {
    if (DEBUG_ENABLED) {
      console.log(`[ClioService] ${message}`, ...args)
    }
  }

  async getDashboardData(): Promise<DashboardData> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    this.debug('Fetching dashboard data', {
      startOfYear: startOfYear.toISOString(),
      now: now.toISOString(),
      apiBaseUrl: API_BASE_URL,
    })

    try {
      const [timeEntries, payments] = await Promise.all([
        this.fetchTimeEntries({ start: startOfYear, end: now }),
        this.fetchPayments({ start: startOfYear, end: now }),
      ])

      this.debug('Fetched raw datasets', {
        timeEntriesCount: timeEntries.length,
        paymentsCount: payments.length,
      })

      const revenueMetrics = this.calculateRevenueMetrics(payments, now)
      const attorneyBillableHours = this.calculateAttorneyBillableHours(timeEntries)
      const ytdTime = this.calculateYTDTime(timeEntries, now)

      this.debug('Computed dashboard metrics', {
        monthlyDeposits: revenueMetrics.monthlyDeposits,
        weeklyRevenuePoints: revenueMetrics.weeklyRevenue.length,
        ytdRevenuePoints: revenueMetrics.ytdRevenue.length,
        attorneyBillableCount: attorneyBillableHours.length,
        ytdTimePoints: ytdTime.length,
      })

      return {
        monthlyDeposits: revenueMetrics.monthlyDeposits,
        attorneyBillableHours,
        weeklyRevenue: revenueMetrics.weeklyRevenue,
        ytdTime,
        ytdRevenue: revenueMetrics.ytdRevenue,
      }
    } catch (error) {
      console.error('Failed to load dashboard data from Clio API', error)
      this.debug('Dashboard load failed with error', error)
      throw error
    }
  }

  private async fetchTimeEntries(range: DateRange): Promise<ClioTimeEntry[]> {
    const baseParams = {
      fields: 'id,date,quantity,billed_quantity,duration,billable,user{id,name}',
      sort: 'date',
      order: 'asc',
    }

    const dateStart = this.formatDate(range.start)
    const dateEnd = this.formatDate(range.end)
    const isoStart = this.formatDateTime(range.start)

    const paramVariants = [
      { ...baseParams, 'filters[date][gte]': dateStart, 'filters[date][lte]': dateEnd },
      { ...baseParams, 'date[gte]': dateStart, 'date[lte]': dateEnd },
      { ...baseParams, since: isoStart },
      baseParams,
    ]

    for (const params of paramVariants) {
      this.debug('Requesting time entries variant', params)
      try {
        const entries = await this.fetchAllPages<ClioTimeEntry>('/time_entries', params)
        const filtered = entries.filter((entry) => this.isWithinRange(entry.date, range))

        this.debug('Time entries variant result', {
          requested: entries.length,
          withinRange: filtered.length,
        })

        if (filtered.length > 0 || entries.length === 0) {
          return filtered
        }
      } catch (error) {
        if (this.shouldRetryWithNextConfig(error)) {
          this.debug('Time entries variant failed, trying next configuration', this.safeError(error))
          continue
        }
        this.debug('Time entries variant failed, aborting', this.safeError(error))
        throw error
      }
    }

    this.debug('No time entries returned after all variants')
    return []
  }

  private async fetchPayments(range: DateRange): Promise<ClioActivity[]> {
    const baseParams = {
      fields: 'id,date,amount,type,activity_type',
      sort: 'date',
      order: 'asc',
    }

    const dateStart = this.formatDate(range.start)
    const dateEnd = this.formatDate(range.end)
    const isoStart = this.formatDateTime(range.start)

    const paramVariants = [
      {
        ...baseParams,
        activity_type: 'Payment',
        'filters[date][gte]': dateStart,
        'filters[date][lte]': dateEnd,
      },
      {
        ...baseParams,
        activity_type: 'payment',
        'filters[date][gte]': dateStart,
        'filters[date][lte]': dateEnd,
      },
      {
        ...baseParams,
        type: 'Payment',
        'filters[date][gte]': dateStart,
        'filters[date][lte]': dateEnd,
      },
      { ...baseParams, activity_type: 'Payment', since: isoStart },
      { ...baseParams, since: isoStart },
      baseParams,
    ]

    for (const params of paramVariants) {
      this.debug('Requesting payment activities variant', params)
      try {
        const activities = await this.fetchAllPages<ClioActivity>('/activities', params)
        const filtered = activities
          .filter((activity) => this.isPaymentActivity(activity))
          .filter((activity) => this.isWithinRange(activity.date, range))

        this.debug('Payment activities variant result', {
          requested: activities.length,
          payments: filtered.length,
        })

        if (filtered.length > 0 || activities.length === 0) {
          return filtered
        }
      } catch (error) {
        if (this.shouldRetryWithNextConfig(error)) {
          this.debug(
            'Payment activities variant failed, trying next configuration',
            this.safeError(error)
          )
          continue
        }
        this.debug('Payment activities variant failed, aborting', this.safeError(error))
        throw error
      }
    }

    this.debug('No payment activities returned after all variants')
    return []
  }

  private async fetchAllPages<T>(path: string, params: Record<string, unknown>): Promise<T[]> {
    const results: T[] = []
    let page = 1

    while (page <= MAX_PAGES) {
      this.debug('Requesting page', { path, page, per_page: PER_PAGE, params })
      const response = await clioApi.get(path, {
        params: { ...params, page, per_page: PER_PAGE },
      })

      const payload = response.data as ClioPaginated<T> | T[]
      const items: T[] = Array.isArray(payload) ? payload : payload?.data ?? []
      results.push(...items)
      this.debug('Received page data', {
        path,
        page,
        received: items.length,
        totalAccumulated: results.length,
      })

      const paging = Array.isArray(payload) ? undefined : payload?.meta?.paging

      if (paging?.current_page !== undefined && paging?.total_pages !== undefined) {
        if (paging.current_page >= paging.total_pages) {
          this.debug('Stopping pagination due to current_page >= total_pages', paging)
          break
        }
        page = paging.current_page + 1
        continue
      }

      if (paging?.next) {
        if (typeof paging.next === 'number') {
          page = paging.next
          continue
        }
        if (typeof paging.next === 'string') {
          const match = paging.next.match(/[?&]page=(\d+)/)
          if (match) {
            page = Number.parseInt(match[1], 10)
            continue
          }
        }
      }

      const totalPagesHeader =
        response.headers?.['x-total-pages'] ?? response.headers?.['x-total-page']
      if (typeof totalPagesHeader === 'string') {
        const parsed = Number.parseInt(totalPagesHeader, 10)
        if (!Number.isNaN(parsed) && page < parsed) {
          page += 1
          continue
        }
      }

      if (items.length === PER_PAGE) {
        page += 1
        continue
      }

      this.debug('Stopping pagination after partial page', { path, page, received: items.length })
      break
    }

    if (page > MAX_PAGES) {
      console.warn(`Reached maximum page limit when fetching ${path}`)
      this.debug('Reached maximum pagination limit', { path, pagesAttempted: MAX_PAGES })
    }

    return results
  }

  private calculateRevenueMetrics(payments: ClioActivity[], now: Date) {
    const weeklyTotals = new Map<string, number>()
    const monthlyTotals = new Map<string, number>()
    let currentMonthTotal = 0
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const today = this.normalizeToDay(now)
    const monthKeys = this.buildMonthKeyRange(startOfYear, now)

    payments.forEach((activity) => {
      if (!this.isPaymentActivity(activity)) {
        return
      }

      const date = this.parseDate(activity.date)
      if (!date) {
        return
      }

      const normalizedDate = this.normalizeToDay(date)
      if (normalizedDate < startOfYear || normalizedDate > today) {
        return
      }

      const amount = this.parseAmount(activity.amount)
      if (amount === 0) {
        return
      }

      if (normalizedDate >= startOfMonth && normalizedDate <= today) {
        currentMonthTotal += amount
      }

      const weekStart = this.getWeekStart(normalizedDate)
      const weekKey = this.formatKeyDate(weekStart)
      weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + amount)

      const monthKey = this.formatMonthKey(normalizedDate)
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + amount)
    })

    const ytdRevenue = monthKeys.map((dateKey) => ({
      date: dateKey,
      amount: this.roundCurrency(monthlyTotals.get(dateKey) || 0),
    }))

    return {
      monthlyDeposits: this.roundCurrency(currentMonthTotal),
      weeklyRevenue: this.buildWeeklySeries(weeklyTotals, now),
      ytdRevenue,
    }
  }

  private calculateAttorneyBillableHours(entries: ClioTimeEntry[]) {
    if (entries.length === 0) {
      return []
    }

    const totals = new Map<string, number>()

    entries.forEach((entry) => {
      if (entry.billable === false) {
        return
      }

      const name = entry.user?.name?.trim()
      if (!name) {
        return
      }

      const hours = this.extractHours(entry)
      if (hours <= 0) {
        return
      }

      totals.set(name, (totals.get(name) || 0) + hours)
    })

    return Array.from(totals.entries())
      .map(([name, hours]) => ({ name, hours: this.roundHours(hours) }))
      .sort((a, b) => b.hours - a.hours)
  }

  private calculateYTDTime(entries: ClioTimeEntry[], now: Date) {
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const monthKeys = this.buildMonthKeyRange(startOfYear, now)

    if (entries.length === 0) {
      return monthKeys.map((date) => ({ date, hours: 0 }))
    }

    const monthlyTotals = new Map<string, number>()

    entries.forEach((entry) => {
      const date = this.parseDate(entry.date)
      if (!date) {
        return
      }

      const hours = this.extractHours(entry)
      if (hours <= 0) {
        return
      }

      const monthKey = this.formatMonthKey(date)
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + hours)
    })

    return monthKeys.map((date) => ({
      date,
      hours: this.roundHours(monthlyTotals.get(date) || 0),
    }))
  }

  private extractHours(entry: ClioTimeEntry): number {
    const quantity = this.parseHours(entry.quantity)
    if (quantity > 0) {
      return quantity
    }

    const billedQuantity = this.parseHours(entry.billed_quantity)
    if (billedQuantity > 0) {
      return billedQuantity
    }

    const duration = this.parseHours(entry.duration)
    if (duration > 0) {
      if (duration > 60) {
        // Assume seconds for large values, minutes for medium values
        if (duration >= 3600) {
          return duration / 3600
        }
        return duration / 60
      }
      return duration
    }

    return 0
  }

  private shouldRetryWithNextConfig(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false
    }

    const status = error.response?.status
    return status === 400 || status === 404 || status === 422
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null
    }

    const trimmed = value.trim()
    if (!trimmed) {
      this.debug('parseDate received empty value', { value })
      return null
    }

    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}-01`)
    }

    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }

    this.debug('parseDate failed to parse value', { value })
    return null
  }

  private parseHours(value: PossiblyNumeric): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0
    }
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (!normalized) {
        return 0
      }
      const parsed = Number.parseFloat(normalized.replace(/[^0-9.\-]/g, ''))
      return Number.isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  private parseAmount(value: PossiblyNumeric): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        return 0
      }
      let numericString = trimmed.replace(/[^0-9.,()\-]/g, '')
      const isNegative = numericString.includes('(') && numericString.includes(')')
      numericString = numericString.replace(/[(),]/g, '')
      if (!numericString) {
        return 0
      }
      const parsed = Number.parseFloat(numericString)
      if (Number.isNaN(parsed)) {
        return 0
      }
      return isNegative ? -parsed : parsed
    }

    return 0
  }

  private isPaymentActivity(activity: ClioActivity): boolean {
    const type = (activity.activity_type || activity.type || '').toString().toLowerCase()
    return type === 'payment'
  }

  private isWithinRange(value: string | null | undefined, range: DateRange): boolean {
    const date = this.parseDate(value)
    if (!date) {
      return false
    }

    const normalized = this.normalizeToDay(date)
    const start = this.normalizeToDay(range.start)
    const end = this.normalizeToDay(range.end)

    return normalized >= start && normalized <= end
  }

  private safeError(error: unknown) {
    if (axios.isAxiosError(error)) {
      return {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response?.data,
      }
    }
    if (error instanceof Error) {
      return { message: error.message, stack: error.stack }
    }
    return error
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  private formatDateTime(date: Date): string {
    return date.toISOString()
  }

  private normalizeToDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  private getWeekStart(date: Date): Date {
    const result = new Date(date)
    const day = result.getDay()
    result.setHours(0, 0, 0, 0)
    result.setDate(result.getDate() - day)
    return result
  }

  private formatKeyDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`
  }

  private formatWeekLabel(date: Date): string {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  private formatMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  private buildWeeklySeries(
    weeklyTotals: Map<string, number>,
    now: Date
  ): { week: string; amount: number }[] {
    const weeks: { week: string; amount: number }[] = []

    for (let i = WEEKS_TO_DISPLAY - 1; i >= 0; i--) {
      const weekDate = new Date(now)
      weekDate.setDate(weekDate.getDate() - i * 7)
      const weekStart = this.getWeekStart(weekDate)
      const key = this.formatKeyDate(weekStart)
      weeks.push({
        week: this.formatWeekLabel(weekStart),
        amount: this.roundCurrency(weeklyTotals.get(key) || 0),
      })
    }

    return weeks
  }

  private buildMonthKeyRange(start: Date, end: Date): string[] {
    const keys: string[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

    while (cursor <= endMonth) {
      keys.push(this.formatMonthKey(cursor))
      cursor.setMonth(cursor.getMonth() + 1)
    }

    return keys
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }

  private roundHours(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }

  getSampleData(): DashboardData {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const monthKeys = this.buildMonthKeyRange(startOfYear, now)

    const ytdRevenue = monthKeys.map((date, index) => ({
      date,
      amount: this.roundCurrency(360000 + index * 15000 + ((index % 3) - 1) * 12000),
    }))

    const ytdTime = monthKeys.map((date, index) => ({
      date,
      hours: this.roundHours(1180 + index * 45 + ((index % 4) - 1) * 30),
    }))

    const weeklyRevenue: { week: string; amount: number }[] = []
    const currentWeekStart = this.getWeekStart(now)

    for (let i = WEEKS_TO_DISPLAY - 1; i >= 0; i--) {
      const weekStart = new Date(currentWeekStart)
      weekStart.setDate(weekStart.getDate() - i * 7)
      weeklyRevenue.push({
        week: this.formatWeekLabel(weekStart),
        amount: this.roundCurrency(78000 + (i % 5) * 4000 + (i % 3) * 6500),
      })
    }

    const monthlyDeposits = ytdRevenue.length > 0 ? ytdRevenue[ytdRevenue.length - 1].amount : 0

    return {
      monthlyDeposits,
      attorneyBillableHours: [
        { name: 'Sarah Johnson', hours: 168 },
        { name: 'Michael Chen', hours: 152 },
        { name: 'Emily Rodriguez', hours: 145 },
        { name: 'David Kim', hours: 138 },
        { name: 'Jennifer Taylor', hours: 125 },
        { name: 'Robert Martinez', hours: 118 },
        { name: 'Lisa Anderson', hours: 105 },
      ],
      weeklyRevenue,
      ytdTime,
      ytdRevenue,
    }
  }
}

export const clioService = new ClioService()
