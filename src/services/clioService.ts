import axios from 'axios'
import type { DashboardData } from '../types'

const API_BASE_URL = 'https://app.clio.com/api/v4'
const DEFAULT_PAGE_SIZE = 200

const TIME_ACTIVITY_TYPES = new Set(['timeentry', 'time', 'timeactivity'])
const EXPENSE_ACTIVITY_TYPES = new Set(['expenseentry', 'expense', 'expenseactivity'])
const NON_BILLABLE_STATUSES = new Set([
  'nonbillable',
  'non_billable',
  'non-billable',
  'nonbillables',
  'nonbillabletime',
  'nonbillablehours',
  'void',
  'voided',
  'voiding',
  'cancelled',
  'canceled',
  'deleted',
  'draft',
])
const BILLABLE_STATUS_KEYWORDS = ['billable', 'billed', 'approved', 'finalized', 'invoiced']
const NON_REVENUE_STATUSES = new Set([
  'void',
  'voided',
  'voiding',
  'reversed',
  'reverse',
  'reversal',
  'refunded',
  'refund',
  'failed',
  'pending',
  'pendingapproval',
])
const NON_REVENUE_SOURCE_KEYWORDS = ['refund', 'writeoff', 'write_off', 'credit', 'discount', 'adjustment']

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
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

type DateRange = {
  start: Date
  end: Date
}

interface ClioActivityUser {
  id?: number
  name?: string
}

interface ClioActivity {
  id: number
  type?: string | null
  activity_type?: string | null
  category?: string | null
  date?: string | null
  start_date?: string | null
  created_at?: string | null
  updated_at?: string | null
  quantity?: number | string | null
  duration?: number | string | null
  billable?: boolean | string | null
  bill_status?: string | null
  status?: string | null
  user?: ClioActivityUser | null
}

interface ClioAllocationParty {
  type?: string | null
  status?: string | null
}

interface ClioAllocation {
  id: number
  amount?: number | string | null
  applied_amount?: number | string | null
  value?: number | string | null
  total?: number | string | null
  status?: string | null
  allocation_status?: string | null
  type?: string | null
  created_at?: string | null
  updated_at?: string | null
  applied_at?: string | null
  payment?: ClioAllocationParty | null
  transaction?: ClioAllocationParty | null
  source?: ClioAllocationParty | null
  target?: ClioAllocationParty | null
}

interface PaginationInfo {
  next: string | null
  currentPage?: number
  totalPages?: number
}

class ClioService {
  async getDashboardData(): Promise<DashboardData> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    try {
      const [monthlyActivities, yearlyActivities, allocations] = await Promise.all([
        this.fetchTimeActivities({ start: startOfMonth, end: now }),
        this.fetchTimeActivities({ start: startOfYear, end: now }),
        this.fetchAllocations({ start: startOfYear, end: now }),
      ])

      const attorneyBillableHours = this.calculateAttorneyBillableHours(monthlyActivities)
      const ytdTime = this.calculateYTDTime(yearlyActivities, now)
      const revenueMetrics = this.calculateRevenueMetrics(allocations, now)

      return {
        monthlyDeposits: revenueMetrics.monthlyDeposits,
        attorneyBillableHours,
        weeklyRevenue: revenueMetrics.weeklyRevenue,
        ytdTime,
        ytdRevenue: revenueMetrics.ytdRevenue,
      }
    } catch (error) {
      console.error('Failed to load dashboard data from Clio API', error)
      throw error
    }
  }

  private async fetchTimeActivities(range: DateRange): Promise<ClioActivity[]> {
    const params = {
      start_date: this.formatDate(range.start),
      end_date: this.formatDate(range.end),
    }

    const activities = await this.fetchAllPages<ClioActivity>('/activities.json', params, 'activities')
    return activities.filter((activity) => this.isTimeActivity(activity))
  }

  private async fetchAllocations(range: DateRange): Promise<ClioAllocation[]> {
    const params = {
      start_date: this.formatDate(range.start),
      end_date: this.formatDate(range.end),
      'created_at[gte]': this.formatDate(range.start),
      'created_at[lte]': this.formatDate(range.end),
    }

    return this.fetchAllPages<ClioAllocation>('/allocations.json', params, 'allocations')
  }

  private async fetchAllPages<T>(endpoint: string, params: Record<string, unknown>, keyHint?: string): Promise<T[]> {
    const results: T[] = []
    let page = 1
    const perPage =
      typeof params.per_page === 'number'
        ? (params.per_page as number)
        : typeof params.limit === 'number'
          ? (params.limit as number)
          : DEFAULT_PAGE_SIZE

    const sanitizedParams: Record<string, unknown> = { ...params }
    delete sanitizedParams.page
    delete sanitizedParams.per_page
    delete sanitizedParams.limit

    while (true) {
      const response = await clioApi.get(endpoint, {
        params: {
          page,
          per_page: perPage,
          limit: perPage,
          ...sanitizedParams,
        },
      })

      const payload = response.data
      const records = this.extractRecords<T>(payload, keyHint)
      if (records.length === 0) {
        break
      }

      results.push(...records)

      const pagination = this.getPaginationInfo(payload)
      if (pagination?.next) {
        page += 1
        continue
      }

      if (pagination?.currentPage && pagination?.totalPages) {
        if (pagination.currentPage >= pagination.totalPages) {
          break
        }
      }

      if (records.length < perPage) {
        break
      }

      page += 1
    }

    return results
  }

  private extractRecords<T>(payload: unknown, keyHint?: string): T[] {
    if (!payload || typeof payload !== 'object') {
      return []
    }

    if (Array.isArray(payload)) {
      return payload as T[]
    }

    const typedPayload = payload as Record<string, unknown>

    if (keyHint) {
      const hinted = typedPayload[keyHint]
      if (Array.isArray(hinted)) {
        return hinted as T[]
      }
    }

    if (Array.isArray(typedPayload.data)) {
      return typedPayload.data as T[]
    }

    if (Array.isArray(typedPayload.activities)) {
      return typedPayload.activities as T[]
    }

    if (Array.isArray(typedPayload.allocations)) {
      return typedPayload.allocations as T[]
    }

    for (const value of Object.values(typedPayload)) {
      if (Array.isArray(value)) {
        return value as T[]
      }
    }

    return []
  }

  private getPaginationInfo(payload: any): PaginationInfo | null {
    if (!payload || typeof payload !== 'object') {
      return null
    }

    const meta = payload.meta
    if (!meta || typeof meta !== 'object') {
      return null
    }

    const paging =
      (meta as any).paging ||
      (meta as any).pagination ||
      (meta as any).page ||
      (meta as any).pages ||
      null

    if (!paging || typeof paging !== 'object') {
      return null
    }

    const next =
      typeof paging.next === 'string'
        ? paging.next
        : typeof paging.next_page_url === 'string'
          ? paging.next_page_url
          : typeof paging.next_page === 'string'
            ? paging.next_page
            : null

    const currentPage =
      typeof paging.current_page === 'number'
        ? paging.current_page
        : typeof paging.page === 'number'
          ? paging.page
          : undefined

    const totalPages =
      typeof paging.total_pages === 'number'
        ? paging.total_pages
        : typeof paging.pages === 'number'
          ? paging.pages
          : typeof paging.total_page_count === 'number'
            ? paging.total_page_count
            : undefined

    return { next, currentPage, totalPages }
  }

  private calculateAttorneyBillableHours(activities: ClioActivity[]): { name: string; hours: number }[] {
    if (activities.length === 0) {
      return []
    }

    const totals = new Map<string, number>()

    activities.forEach((activity) => {
      if (!this.isBillableTime(activity)) {
        return
      }

      const hours = this.getActivityHours(activity)
      if (!hours) {
        return
      }

      const name = activity.user?.name?.trim()
      if (!name) {
        return
      }

      totals.set(name, (totals.get(name) || 0) + hours)
    })

    return Array.from(totals.entries())
      .map(([name, hours]) => ({ name, hours: this.roundHours(hours) }))
      .sort((a, b) => b.hours - a.hours)
  }

  private calculateYTDTime(activities: ClioActivity[], now: Date): { date: string; hours: number }[] {
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const monthKeys = this.buildMonthKeyRange(startOfYear, now)

    if (activities.length === 0) {
      return monthKeys.map((date) => ({ date, hours: 0 }))
    }

    const monthlyTotals = new Map<string, number>()

    activities.forEach((activity) => {
      if (!this.isTimeActivity(activity)) {
        return
      }

      const entryDate = this.getActivityDate(activity)
      if (!entryDate) {
        return
      }

      if (entryDate < startOfYear || entryDate > now) {
        return
      }

      const hours = this.getActivityHours(activity)
      if (!hours) {
        return
      }

      const monthKey = this.formatMonthKey(entryDate)
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + hours)
    })

    return monthKeys.map((date) => ({
      date,
      hours: this.roundHours(monthlyTotals.get(date) || 0),
    }))
  }

  private calculateRevenueMetrics(allocations: ClioAllocation[], now: Date) {
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const weeklyTotals = new Map<string, number>()
    const monthlyTotals = new Map<string, number>()
    const monthKeys = this.buildMonthKeyRange(startOfYear, now)
    let currentMonthTotal = 0

    allocations.forEach((allocation) => {
      if (!this.isRevenueAllocation(allocation)) {
        return
      }

      const entryDate = this.getAllocationDate(allocation)
      if (!entryDate) {
        return
      }

      if (entryDate < startOfYear || entryDate > today) {
        return
      }

      const amount = this.getAllocationAmount(allocation)
      if (!amount) {
        return
      }

      if (entryDate >= startOfMonth && entryDate <= today) {
        currentMonthTotal += amount
      }

      const weekStart = this.getWeekStart(entryDate)
      const weekKey = this.formatKeyDate(weekStart)
      weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + amount)

      const monthKey = this.formatMonthKey(entryDate)
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + amount)
    })

    const weeklyRevenue = this.buildWeeklySeries(weeklyTotals, now)

    const ytdRevenue = monthKeys.map((date) => ({
      date,
      amount: this.roundCurrency(monthlyTotals.get(date) || 0),
    }))

    const currentMonthKey = this.formatMonthKey(now)
    const fallbackMonthTotal = monthlyTotals.get(currentMonthKey) ?? 0
    const monthlyDepositsRaw = currentMonthTotal > 0 ? currentMonthTotal : fallbackMonthTotal

    return {
      weeklyRevenue,
      ytdRevenue,
      monthlyDeposits: this.roundCurrency(monthlyDepositsRaw),
    }
  }

  private isTimeActivity(activity: ClioActivity): boolean {
    const type = this.normalizeKey(activity.type || activity.activity_type || activity.category)
    if (type) {
      if (TIME_ACTIVITY_TYPES.has(type)) {
        return true
      }
      if (EXPENSE_ACTIVITY_TYPES.has(type)) {
        return false
      }
      if (type.includes('expense')) {
        return false
      }
      if (type.includes('time')) {
        return true
      }
    }

    if (activity.quantity !== undefined && activity.quantity !== null) {
      return true
    }

    return true
  }

  private isBillableTime(activity: ClioActivity): boolean {
    if (!this.isTimeActivity(activity)) {
      return false
    }

    if (typeof activity.billable === 'boolean') {
      return activity.billable
    }

    if (typeof activity.billable === 'string') {
      const normalizedBillable = this.normalizeKey(activity.billable)
      if (!normalizedBillable) {
        // Fall back to status evaluation
      } else if (normalizedBillable === 'true' || normalizedBillable === 'yes' || normalizedBillable === 'billable') {
        return true
      } else if (normalizedBillable === 'false' || normalizedBillable === 'no') {
        return false
      }
    }

    const status = this.normalizeKey(activity.status || activity.bill_status)
    if (status) {
      if (NON_BILLABLE_STATUSES.has(status)) {
        return false
      }
      if (BILLABLE_STATUS_KEYWORDS.some((keyword) => status.includes(keyword))) {
        return true
      }
    }

    return true
  }

  private getActivityHours(activity: ClioActivity): number {
    if (typeof activity.quantity === 'number') {
      return activity.quantity
    }

    if (typeof activity.quantity === 'string') {
      const parsed = this.parseNumber(activity.quantity)
      if (parsed) {
        return parsed
      }
    }

    if (typeof activity.duration === 'number') {
      return activity.duration
    }

    if (typeof activity.duration === 'string') {
      const parsed = this.parseNumber(activity.duration)
      if (parsed) {
        return parsed
      }
    }

    return 0
  }

  private getActivityDate(activity: ClioActivity): Date | null {
    return (
      this.parseDate(activity.date) ||
      this.parseDate(activity.start_date) ||
      this.parseDate(activity.created_at) ||
      this.parseDate(activity.updated_at)
    )
  }

  private isRevenueAllocation(allocation: ClioAllocation): boolean {
    const amount = this.getAllocationAmount(allocation)
    if (amount <= 0) {
      return false
    }

    const status = this.normalizeKey(
      allocation.status ||
        allocation.allocation_status ||
        allocation.payment?.status ||
        allocation.transaction?.status
    )

    if (status) {
      if (NON_REVENUE_STATUSES.has(status)) {
        return false
      }
      if (status.includes('refund') || status.includes('writeoff') || status.includes('write_off')) {
        return false
      }
    }

    const sourceType = this.normalizeKey(allocation.source?.type || allocation.target?.type || allocation.type)
    if (sourceType) {
      if (NON_REVENUE_SOURCE_KEYWORDS.some((keyword) => sourceType.includes(keyword))) {
        return false
      }
    }

    return true
  }

  private getAllocationAmount(allocation: ClioAllocation): number {
    if (typeof allocation.amount === 'number') {
      return allocation.amount
    }

    if (typeof allocation.amount === 'string') {
      const parsed = this.parseNumber(allocation.amount)
      if (parsed) {
        return parsed
      }
    }

    for (const key of ['applied_amount', 'value', 'total']) {
      const raw = (allocation as Record<string, unknown>)[key]
      if (typeof raw === 'number') {
        return raw
      }
      if (typeof raw === 'string') {
        const parsed = this.parseNumber(raw)
        if (parsed) {
          return parsed
        }
      }
    }

    return 0
  }

  private getAllocationDate(allocation: ClioAllocation): Date | null {
    return (
      this.parseDate(allocation.applied_at) ||
      this.parseDate(allocation.created_at) ||
      this.parseDate(allocation.updated_at)
    )
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const isoMatch = trimmed.match(/\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?/)
    if (isoMatch) {
      const date = new Date(isoMatch[0])
      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }

    const slashMatch = trimmed.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)
    if (slashMatch) {
      const [monthStr, dayStr, yearStr] = slashMatch[0].split('/')
      const month = Number.parseInt(monthStr ?? '', 10)
      const day = Number.parseInt(dayStr ?? '', 10)
      let year = Number.parseInt(yearStr ?? '', 10)
      if (!Number.isNaN(month) && !Number.isNaN(day) && !Number.isNaN(year)) {
        if (year < 100) {
          year += 2000
        }
        const date = new Date(year, month - 1, day)
        if (!Number.isNaN(date.getTime())) {
          return date
        }
      }
    }

    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }

    return null
  }

  private parseNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value
    }

    if (typeof value !== 'string') {
      return 0
    }

    const normalized = value.replace(/[^0-9.\-]/g, '')
    if (!normalized) {
      return 0
    }

    const parsed = Number.parseFloat(normalized)
    if (Number.isNaN(parsed)) {
      return 0
    }

    return parsed
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  private formatKeyDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  private formatWeekLabel(date: Date): string {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  private formatMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  private buildWeeklySeries(weeklyTotals: Map<string, number>, now: Date): { week: string; amount: number }[] {
    const weeks: { week: string; amount: number }[] = []

    for (let i = 11; i >= 0; i--) {
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

  private getWeekStart(date: Date): Date {
    const result = new Date(date)
    const day = result.getDay()
    result.setHours(0, 0, 0, 0)
    result.setDate(result.getDate() - day)
    return result
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }

  private roundHours(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }

  private normalizeKey(value: string | null | undefined): string {
    if (!value) {
      return ''
    }
    return value.toLowerCase().replace(/[^a-z0-9]/g, '')
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

    for (let i = 11; i >= 0; i--) {
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
