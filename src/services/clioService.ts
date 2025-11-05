import axios from 'axios'
import type { DashboardData } from '../types'

const API_BASE_URL = 'https://app.clio.com/api/v4'

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

type ReportCategory = 'managed' | 'billing' | 'standard'

interface ReportPath {
  category: ReportCategory
  key: string
}

interface CsvRow {
  [key: string]: string
}

interface DateRange {
  start: Date
  end: Date
}

const REVENUE_REPORT_PATHS: ReportPath[] = [
  { category: 'managed', key: 'revenue' },
  { category: 'billing', key: 'revenue' },
  { category: 'standard', key: 'revenue' },
]

const PRODUCTIVITY_REPORT_PATHS: ReportPath[] = [
  { category: 'managed', key: 'productivity_by_user' },
  { category: 'managed', key: 'productivity_user' },
  { category: 'managed', key: 'productivity' },
]

const TIME_ENTRIES_REPORT_PATHS: ReportPath[] = [
  { category: 'standard', key: 'time_entries' },
  { category: 'standard', key: 'time_entries_detail' },
  { category: 'managed', key: 'time_entries_detail' },
]

const REVENUE_DATE_KEY_PREFERENCES: string[][] = [
  ['payment', 'date'],
  ['collection', 'date'],
  ['collected', 'date'],
  ['deposit', 'date'],
  ['transaction', 'date'],
  ['activity', 'date'],
  ['invoice', 'date'],
  ['date'],
]

const ATTORNEY_KEY_PREFERENCES: string[][] = [
  ['timekeeper'],
  ['user'],
  ['attorney'],
  ['responsible', 'attorney'],
  ['originating', 'attorney'],
  ['billing', 'attorney'],
  ['lawyer'],
  ['name'],
]

const TIME_DATE_KEY_PREFERENCES: string[][] = [
  ['entry', 'date'],
  ['activity', 'date'],
  ['work', 'date'],
  ['date'],
  ['month'],
]

const REVENUE_VALUE_INCLUDE = ['collect', 'payment', 'receipt', 'paid', 'deposit', 'revenue']
const REVENUE_VALUE_EXCLUDE = ['uncollect', 'unpaid', 'outstanding', 'balance', 'writeoff', 'discount', 'unbilled']
const HOURS_INCLUDE = ['hour']
const HOURS_EXCLUDE = ['rate', 'target', 'percent', 'percentage', 'utilization', 'budget', 'capacity', 'goal']

const HOURS_COLUMN_PREFERENCES: string[][] = [
  ['billable', 'hours'],
  ['billed', 'hours'],
  ['hours', 'billed'],
  ['hours', 'worked'],
  ['worked', 'hours'],
  ['recorded', 'hours'],
  ['hours'],
]

class ClioService {
  async getDashboardData(): Promise<DashboardData> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    try {
      const [revenueCsv, productivityCsv, timeEntriesCsv] = await Promise.all([
        this.fetchReportForRange('revenue', REVENUE_REPORT_PATHS, { start: startOfYear, end: now }, [
          {},
          { 'filters[date_range][name]': 'payment_date' },
        ]),
        this.fetchReportForRange('productivity', PRODUCTIVITY_REPORT_PATHS, { start: startOfMonth, end: now }),
        this.fetchReportForRange('time entries', TIME_ENTRIES_REPORT_PATHS, { start: startOfYear, end: now }, [
          {},
          { detail: 'true' },
          { 'filters[group_by]': 'entry' },
        ]),
      ])

      const revenueRows = this.parseCsv(revenueCsv)
      const productivityRows = this.parseCsv(productivityCsv)
      const timeEntriesRows = this.parseCsv(timeEntriesCsv)

      const revenueMetrics = this.calculateRevenueMetrics(revenueRows, now)

      const attorneySourceRows = productivityRows.length > 0 ? productivityRows : timeEntriesRows
      const attorneyBillableHours = this.calculateAttorneyBillableHours(attorneySourceRows)

      const ytdTimeSourceRows = timeEntriesRows.length > 0 ? timeEntriesRows : productivityRows
      const ytdTime = this.calculateYTDTime(ytdTimeSourceRows, now)

      return {
        monthlyDeposits: revenueMetrics.monthlyDeposits,
        attorneyBillableHours,
        weeklyRevenue: revenueMetrics.weeklyRevenue,
        ytdTime,
        ytdRevenue: revenueMetrics.ytdRevenue,
      }
    } catch (error) {
      console.error('Failed to load dashboard data from Clio reports CSV', error)
      throw error
    }
  }

  private async fetchReportForRange(
    label: string,
    paths: ReportPath[],
    range: DateRange,
    paramExtras: Record<string, string>[] = [{}]
  ): Promise<string> {
    const dateVariants = this.buildDateRangeParamVariants(range.start, range.end)
    const paramVariants = this.combineParamVariants(dateVariants, paramExtras)

    for (const path of paths) {
      for (const params of paramVariants) {
        try {
          return await this.fetchReportCsv(path, params)
        } catch (err) {
          if (this.shouldRetryWithNextConfig(err)) {
            continue
          }
          throw err
        }
      }
    }

    throw new Error(
      `Unable to fetch ${label} report from Clio. Tried ${paths
        .map((p) => `${p.category}/${p.key}`)
        .join(', ')}`
    )
  }

  private async fetchReportCsv(path: ReportPath, params: Record<string, string>): Promise<string> {
    const response = await clioApi.get<string>(`/reports/${path.category}/${path.key}.csv`, {
      params,
      responseType: 'text',
      headers: {
        Accept: 'text/csv',
      },
    })

    return response.data
  }

  private buildDateRangeParamVariants(start: Date, end: Date): Record<string, string>[] {
    const startStr = this.formatDateParam(start)
    const endStr = this.formatDateParam(end)

    const variants: Record<string, string>[] = [
      { 'filters[date_range][start]': startStr, 'filters[date_range][end]': endStr },
      { 'filters[date][start]': startStr, 'filters[date][end]': endStr },
      { 'filters[date_range][from]': startStr, 'filters[date_range][to]': endStr },
      { 'date[start]': startStr, 'date[end]': endStr },
      { start_date: startStr, end_date: endStr },
      { from: startStr, to: endStr },
      { 'filters[start_date]': startStr, 'filters[end_date]': endStr },
    ]

    const seen = new Set<string>()
    return variants.filter((variant) => {
      const key = JSON.stringify(Object.entries(variant).sort(([a], [b]) => a.localeCompare(b)))
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  private combineParamVariants(
    dateVariants: Record<string, string>[],
    extras: Record<string, string>[]
  ): Record<string, string>[] {
    const combinations: Record<string, string>[] = []

    for (const base of dateVariants) {
      for (const extra of extras) {
        combinations.push({ ...extra, ...base })
      }
    }

    const seen = new Set<string>()
    return combinations.filter((params) => {
      const key = JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)))
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  private shouldRetryWithNextConfig(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false
    }

    const status = error.response?.status
    return status === 404 || status === 400 || status === 422
  }

  private formatDateParam(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  private parseCsv(csvText: string): CsvRow[] {
    const rows: string[][] = []
    let currentRow: string[] = []
    let currentField = ''
    let inQuotes = false

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i]

      if (char === '"') {
        if (inQuotes && csvText[i + 1] === '"') {
          currentField += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField)
        currentField = ''
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && csvText[i + 1] === '\n') {
          i += 1
        }
        currentRow.push(currentField)
        rows.push(currentRow)
        currentRow = []
        currentField = ''
      } else {
        currentField += char
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField)
      rows.push(currentRow)
    }

    if (rows.length === 0) {
      return []
    }

    const rawHeaders = rows[0].map((header) => header.trim())
    if (rawHeaders[0] && rawHeaders[0].charCodeAt(0) === 0xfeff) {
      rawHeaders[0] = rawHeaders[0].slice(1)
    }

    return rows
      .slice(1)
      .filter((row) => row.some((cell) => cell.trim().length > 0))
      .map((row) => {
        const record: CsvRow = {}
        rawHeaders.forEach((header, index) => {
          record[header] = (row[index] ?? '').trim()
        })
        return record
      })
  }

  private calculateRevenueMetrics(rows: CsvRow[], now: Date) {
    const weeklyTotals = new Map<string, number>()
    const monthlyTotals = new Map<string, number>()
    let currentMonthTotal = 0
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthKeys = this.buildMonthKeyRange(startOfYear, now)

    if (rows.length === 0) {
      return {
        monthlyDeposits: currentMonthTotal,
        weeklyRevenue: this.buildWeeklySeries(weeklyTotals, now),
        ytdRevenue: monthKeys.map((date) => ({ date, amount: 0 })),
      }
    }

    const dateKey = this.findKeyAcrossRows(rows, REVENUE_DATE_KEY_PREFERENCES)
    const revenueColumns = this.findColumnsByKeywords(rows, REVENUE_VALUE_INCLUDE, REVENUE_VALUE_EXCLUDE)

    rows.forEach((row) => {
      const date = dateKey ? this.parseDateValue(row[dateKey]) : null
      if (!date) {
        return
      }

      const amount = this.sumColumnsByKeys(row, revenueColumns)
      if (!amount) {
        return
      }

      if (date >= startOfMonth && date <= now) {
        currentMonthTotal += amount
      }

      const weekStart = this.getWeekStart(date)
      const weekKey = this.formatKeyDate(weekStart)
      weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + amount)

      const monthKey = this.formatMonthKey(date)
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + amount)
    })

    const ytdRevenue = monthKeys.map((date) => ({
      date,
      amount: this.roundCurrency(monthlyTotals.get(date) || 0),
    }))

    return {
      monthlyDeposits: this.roundCurrency(currentMonthTotal),
      weeklyRevenue: this.buildWeeklySeries(weeklyTotals, now),
      ytdRevenue,
    }
  }

  private calculateAttorneyBillableHours(rows: CsvRow[]): { name: string; hours: number }[] {
    if (rows.length === 0) {
      return []
    }

    const nameKey = this.findKeyAcrossRows(rows, ATTORNEY_KEY_PREFERENCES)
    if (!nameKey) {
      return []
    }

    const hourColumns = this.findColumnsByKeywords(rows, HOURS_INCLUDE, HOURS_EXCLUDE)
    if (hourColumns.length === 0) {
      return []
    }

    const { totals } = this.selectAttorneyHourColumn(rows, nameKey, hourColumns)
    if (totals.size === 0) {
      return []
    }

    return Array.from(totals.entries())
      .map(([name, hours]) => ({ name, hours: this.roundHours(hours) }))
      .sort((a, b) => b.hours - a.hours)
  }

  private calculateYTDTime(rows: CsvRow[], now: Date): { date: string; hours: number }[] {
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const monthKeys = this.buildMonthKeyRange(startOfYear, now)

    if (rows.length === 0) {
      return monthKeys.map((date) => ({ date, hours: 0 }))
    }

    const dateKey = this.findKeyAcrossRows(rows, TIME_DATE_KEY_PREFERENCES)
    if (!dateKey) {
      return monthKeys.map((date) => ({ date, hours: 0 }))
    }

    const timeColumns = this.determineTimeColumns(rows)
    if (timeColumns.length === 0) {
      return monthKeys.map((date) => ({ date, hours: 0 }))
    }

    const monthlyTotals = new Map<string, number>()

    rows.forEach((row) => {
      const date = this.parseDateValue(row[dateKey])
      if (!date) {
        return
      }

      const monthKey = this.formatMonthKey(date)
      const hours = this.sumColumnsByKeys(row, timeColumns)
      if (!hours) {
        return
      }

      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + hours)
    })

    return monthKeys.map((date) => ({
      date,
      hours: this.roundHours(monthlyTotals.get(date) || 0),
    }))
  }

  private determineTimeColumns(rows: CsvRow[]): string[] {
    const hourColumns = this.findColumnsByKeywords(rows, HOURS_INCLUDE, HOURS_EXCLUDE)
    if (hourColumns.length > 0) {
      return hourColumns
    }

    return this.findColumnsByKeywords(rows, ['duration', 'quantity'], [
      'rate',
      'target',
      'percent',
      'percentage',
      'utilization',
      'amount',
      'value',
    ])
  }

  private findKeyAcrossRows(rows: CsvRow[], preferences: string[][]): string | undefined {
    const keys = new Set<string>()
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key) {
          keys.add(key)
        }
      })
    })

    return this.findFirstMatchingKey(Array.from(keys), preferences)
  }

  private findColumnsByKeywords(
    rows: CsvRow[],
    includeKeywords: string[],
    excludeKeywords: string[] = []
  ): string[] {
    const columns = new Set<string>()
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (key) {
          columns.add(key)
        }
      })
    })

    const include = includeKeywords.map((keyword) => this.normalizeKey(keyword))
    const exclude = excludeKeywords.map((keyword) => this.normalizeKey(keyword))

    return Array.from(columns).filter((column) => {
      const normalized = this.normalizeKey(column)
      const matchesInclude = include.some((keyword) => normalized.includes(keyword))
      if (!matchesInclude) {
        return false
      }
      const matchesExclude = exclude.some((keyword) => normalized.includes(keyword))
      return !matchesExclude
    })
  }

  private selectAttorneyHourColumn(
    rows: CsvRow[],
    nameKey: string,
    hourColumns: string[]
  ): { column: string; totals: Map<string, number> } {
    const orderedColumns = this.orderColumnsByPreference(hourColumns, HOURS_COLUMN_PREFERENCES)
    const evaluationCache = new Map<string, { totals: Map<string, number>; hasData: boolean; hasVariance: boolean }>()

    const evaluateColumn = (column: string) => {
      if (evaluationCache.has(column)) {
        return evaluationCache.get(column)!
      }

      const totals = this.aggregateHoursByColumn(rows, nameKey, column)
      const values = Array.from(totals.values())
      const nonZeroValues = values.filter((value) => Math.abs(value) > 0.01)
      const hasData = nonZeroValues.length > 0
      let hasVariance = false

      if (nonZeroValues.length > 1) {
        const min = Math.min(...nonZeroValues)
        const max = Math.max(...nonZeroValues)
        hasVariance = Math.abs(max - min) > 0.01
      }

      const evaluation = { totals, hasData, hasVariance }
      evaluationCache.set(column, evaluation)
      return evaluation
    }

    for (const column of orderedColumns) {
      const evaluation = evaluateColumn(column)
      if (evaluation.hasVariance) {
        return { column, totals: evaluation.totals }
      }
    }

    for (const column of orderedColumns) {
      const evaluation = evaluateColumn(column)
      if (evaluation.hasData) {
        return { column, totals: evaluation.totals }
      }
    }

    const fallbackColumn = orderedColumns[0]
    return { column: fallbackColumn, totals: evaluateColumn(fallbackColumn).totals }
  }

  private aggregateHoursByColumn(rows: CsvRow[], nameKey: string, column: string): Map<string, number> {
    const totals = new Map<string, number>()

    rows.forEach((row) => {
      const name = row[nameKey]?.trim()
      if (!name) {
        return
      }

      const value = this.parseNumericValue(row[column])
      if (!value) {
        return
      }

      totals.set(name, (totals.get(name) || 0) + value)
    })

    return totals
  }

  private orderColumnsByPreference(columns: string[], preferences: string[][]): string[] {
    if (columns.length <= 1) {
      return columns
    }

    const remaining = [...columns]
    const ordered: string[] = []

    preferences.forEach((tokens) => {
      const normalizedTokens = tokens.map((token) => this.normalizeKey(token))
      const index = remaining.findIndex((column) => {
        const normalizedColumn = this.normalizeKey(column)
        return normalizedTokens.every((token) => normalizedColumn.includes(token))
      })

      if (index !== -1) {
        ordered.push(remaining.splice(index, 1)[0])
      }
    })

    ordered.push(...remaining)
    return ordered
  }

  private findFirstMatchingKey(keys: string[], preferences: string[][]): string | undefined {
    const normalizedKeys = keys.map((key) => ({ key, normalized: this.normalizeKey(key) }))

    for (const tokens of preferences) {
      const normalizedTokens = tokens.map((token) => this.normalizeKey(token))
      const match = normalizedKeys.find(({ normalized }) =>
        normalizedTokens.every((token) => normalized.includes(token))
      )
      if (match) {
        return match.key
      }
    }

    return undefined
  }

  private sumColumnsByKeys(row: CsvRow, columns: string[]): number {
    return columns.reduce((total, column) => total + this.parseNumericValue(row[column]), 0)
  }

  private parseNumericValue(value: string | undefined): number {
    if (!value) {
      return 0
    }

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

  private parseDateValue(value: string | undefined): Date | null {
    if (!value) {
      return null
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}-01`)
    }

    const isoMatch = trimmed.match(/\d{4}-\d{2}-\d{2}/)
    if (isoMatch) {
      return new Date(isoMatch[0])
    }

    const slashMatch = trimmed.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)
    if (slashMatch) {
      const normalized = slashMatch[0]
      const parts = normalized.split('/')
      if (parts.length === 3) {
        const [month, day, year] = parts.map((part) => Number.parseInt(part, 10))
        const fullYear = year < 100 ? 2000 + year : year
        return new Date(fullYear, month - 1, day)
      }
    }

    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed)
    }

    return null
  }

  private getWeekStart(date: Date): Date {
    const result = new Date(date)
    const day = result.getDay()
    result.setHours(0, 0, 0, 0)
    result.setDate(result.getDate() - day)
    return result
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

  private normalizeKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }

  private roundHours(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }

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
