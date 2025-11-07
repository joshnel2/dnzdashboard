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
  { category: 'managed', key: 'revenue_by_matter' },
  { category: 'billing', key: 'revenue' },
  { category: 'billing', key: 'payments' },
  { category: 'standard', key: 'revenue' },
  { category: 'standard', key: 'payments' },
  { category: 'standard', key: 'payments_received' },
]

const PRODUCTIVITY_REPORT_PATHS: ReportPath[] = [
  { category: 'managed', key: 'productivity_by_user' },
  { category: 'managed', key: 'productivity_user' },
  { category: 'managed', key: 'productivity' },
  { category: 'standard', key: 'productivity' },
  { category: 'standard', key: 'time_entries_by_user' },
]

const TIME_ENTRIES_REPORT_PATHS: ReportPath[] = [
  { category: 'standard', key: 'time_entries' },
  { category: 'standard', key: 'time_entries_detail' },
  { category: 'managed', key: 'time_entries_detail' },
  { category: 'managed', key: 'time_entries' },
  { category: 'billing', key: 'time_entries' },
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

const REVENUE_VALUE_INCLUDE = ['collect', 'payment', 'receipt', 'paid', 'deposit', 'revenue', 'amount', 'total']
const REVENUE_VALUE_EXCLUDE = ['uncollect', 'unpaid', 'outstanding', 'balance', 'writeoff', 'discount', 'unbilled', 'invoice', 'bill']
const HOURS_INCLUDE = ['hour', 'time']
const HOURS_EXCLUDE = ['rate', 'target', 'percent', 'percentage', 'utilization', 'budget', 'capacity', 'goal', 'value', 'amount']

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

    console.log('📊 Starting dashboard data fetch...')
    console.log('Date range:', {
      startOfYear: startOfYear.toISOString().split('T')[0],
      startOfMonth: startOfMonth.toISOString().split('T')[0],
      now: now.toISOString().split('T')[0],
    })

    try {
      // Fetch all reports with better error handling
      const [revenueCsv, productivityCsv, timeEntriesCsv] = await Promise.allSettled([
        this.fetchReportForRange('revenue', REVENUE_REPORT_PATHS, { start: startOfYear, end: now }, [
          {},
          { 'filters[date_range][name]': 'payment_date' },
          { 'filters[date_range][name]': 'collection_date' },
        ]),
        this.fetchReportForRange('productivity', PRODUCTIVITY_REPORT_PATHS, { start: startOfMonth, end: now }),
        this.fetchReportForRange('time entries', TIME_ENTRIES_REPORT_PATHS, { start: startOfYear, end: now }, [
          {},
          { detail: 'true' },
          { 'filters[group_by]': 'entry' },
        ]),
      ])

      const revenueCsvData = revenueCsv.status === 'fulfilled' ? revenueCsv.value : ''
      const productivityCsvData = productivityCsv.status === 'fulfilled' ? productivityCsv.value : ''
      const timeEntriesCsvData = timeEntriesCsv.status === 'fulfilled' ? timeEntriesCsv.value : ''

      console.log('✅ CSV fetch results:', {
        revenue: revenueCsv.status === 'fulfilled' ? `${revenueCsvData.length} chars` : `❌ ${revenueCsv.reason}`,
        productivity: productivityCsv.status === 'fulfilled' ? `${productivityCsvData.length} chars` : `❌ ${productivityCsv.reason}`,
        timeEntries: timeEntriesCsv.status === 'fulfilled' ? `${timeEntriesCsvData.length} chars` : `❌ ${timeEntriesCsv.reason}`,
      })

      const revenueRows = this.parseCsv(revenueCsvData)
      const productivityRows = this.parseCsv(productivityCsvData)
      const timeEntriesRows = this.parseCsv(timeEntriesCsvData)

      console.log('📋 Parsed rows:', {
        revenue: revenueRows.length,
        productivity: productivityRows.length,
        timeEntries: timeEntriesRows.length,
      })

      if (revenueRows.length > 0) {
        console.log('💰 Revenue CSV columns:', Object.keys(revenueRows[0]))
        console.log('💰 Sample revenue row:', revenueRows[0])
      }

      if (productivityRows.length > 0) {
        console.log('⚡ Productivity CSV columns:', Object.keys(productivityRows[0]))
        console.log('⚡ Sample productivity row:', productivityRows[0])
      }

      if (timeEntriesRows.length > 0) {
        console.log('⏱️  Time entries CSV columns:', Object.keys(timeEntriesRows[0]))
        console.log('⏱️  Sample time entry row:', timeEntriesRows[0])
      }

      const revenueMetrics = this.calculateRevenueMetrics(revenueRows, now)
      console.log('📈 Revenue metrics calculated:', {
        monthlyDeposits: revenueMetrics.monthlyDeposits,
        weeklyRevenuePoints: revenueMetrics.weeklyRevenue.length,
        ytdRevenuePoints: revenueMetrics.ytdRevenue.length,
      })

      const attorneySourceRows = productivityRows.length > 0 ? productivityRows : timeEntriesRows
      const attorneyBillableHours = this.calculateAttorneyBillableHours(attorneySourceRows)
      console.log('👥 Attorney hours calculated:', attorneyBillableHours.length, 'attorneys')

      const ytdTimeSourceRows = timeEntriesRows.length > 0 ? timeEntriesRows : productivityRows
      const ytdTime = this.calculateYTDTime(ytdTimeSourceRows, now)
      console.log('⏰ YTD time calculated:', ytdTime.length, 'months')

      const result = {
        monthlyDeposits: revenueMetrics.monthlyDeposits,
        attorneyBillableHours,
        weeklyRevenue: revenueMetrics.weeklyRevenue,
        ytdTime,
        ytdRevenue: revenueMetrics.ytdRevenue,
      }

      // Final summary
      console.log('\n📊 ========== DASHBOARD DATA SUMMARY ==========')
      console.log('💰 Monthly Deposits:', `$${result.monthlyDeposits.toLocaleString()}`)
      console.log('👥 Attorney Billable Hours:', `${result.attorneyBillableHours.length} attorneys`)
      if (result.attorneyBillableHours.length > 0) {
        const totalHours = result.attorneyBillableHours.reduce((sum, a) => sum + a.hours, 0)
        console.log('   Total hours:', totalHours.toFixed(1))
        console.log('   Top 3:', result.attorneyBillableHours.slice(0, 3).map(a => `${a.name} (${a.hours}h)`).join(', '))
      }
      console.log('📈 Weekly Revenue:', `${result.weeklyRevenue.length} weeks`)
      if (result.weeklyRevenue.length > 0) {
        const totalWeekly = result.weeklyRevenue.reduce((sum, w) => sum + w.amount, 0)
        console.log('   Total:', `$${totalWeekly.toLocaleString()}`)
      }
      console.log('📅 YTD Revenue:', `${result.ytdRevenue.length} months`)
      if (result.ytdRevenue.length > 0) {
        const totalYTD = result.ytdRevenue.reduce((sum, r) => sum + r.amount, 0)
        console.log('   Total:', `$${totalYTD.toLocaleString()}`)
      }
      console.log('⏱️  YTD Time:', `${result.ytdTime.length} months`)
      if (result.ytdTime.length > 0) {
        const totalTime = result.ytdTime.reduce((sum, t) => sum + t.hours, 0)
        console.log('   Total hours:', totalTime.toFixed(1))
      }
      console.log('==============================================\n')

      return result
    } catch (error) {
      console.error('❌ Failed to load dashboard data from Clio reports CSV', error)
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

    console.log(`🔍 Fetching ${label} report with ${paths.length} path(s) and ${paramVariants.length} parameter variant(s)`)

    const errors: string[] = []

    for (const path of paths) {
      for (const params of paramVariants) {
        try {
          console.log(`  → Trying ${path.category}/${path.key} with params:`, params)
          const csv = await this.fetchReportCsv(path, params)
          console.log(`  ✓ Success! Got ${csv.length} chars from ${path.category}/${path.key}`)
          return csv
        } catch (err) {
          const errorMsg = axios.isAxiosError(err) 
            ? `${err.response?.status}: ${err.response?.statusText || err.message}`
            : String(err)
          console.log(`  ✗ Failed ${path.category}/${path.key}: ${errorMsg}`)
          errors.push(`${path.category}/${path.key}: ${errorMsg}`)
          
          if (this.shouldRetryWithNextConfig(err)) {
            continue
          }
          throw err
        }
      }
    }

    const errorSummary = errors.slice(0, 5).join('; ')
    console.error(`❌ Unable to fetch ${label} report after ${errors.length} attempts. Sample errors: ${errorSummary}`)
    
    throw new Error(
      `Unable to fetch ${label} report from Clio. Tried ${paths
        .map((p) => `${p.category}/${p.key}`)
        .join(', ')}. Last error: ${errors[errors.length - 1] || 'unknown'}`
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
    if (!csvText || csvText.trim().length === 0) {
      console.log('⚠️  Empty CSV text provided')
      return []
    }

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
      console.log('⚠️  No rows parsed from CSV')
      return []
    }

    if (rows.length === 1) {
      console.log('⚠️  CSV has header only, no data rows')
      return []
    }

    const rawHeaders = rows[0].map((header) => header.trim())
    if (rawHeaders[0] && rawHeaders[0].charCodeAt(0) === 0xfeff) {
      rawHeaders[0] = rawHeaders[0].slice(1)
    }

    // Filter out empty headers
    const validHeaders = rawHeaders.filter((h) => h.length > 0)
    if (validHeaders.length === 0) {
      console.log('⚠️  No valid headers found in CSV')
      return []
    }

    const dataRows = rows
      .slice(1)
      .filter((row) => row.some((cell) => cell.trim().length > 0))
      .map((row) => {
        const record: CsvRow = {}
        rawHeaders.forEach((header, index) => {
          if (header) {
            record[header] = (row[index] ?? '').trim()
          }
        })
        return record
      })

    console.log(`✓ Parsed ${dataRows.length} data rows with ${validHeaders.length} columns`)
    return dataRows
  }

  private calculateRevenueMetrics(rows: CsvRow[], now: Date) {
    const weeklyTotals = new Map<string, number>()
    const monthlyTotals = new Map<string, number>()
    let currentMonthTotal = 0
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthKeys = this.buildMonthKeyRange(startOfYear, now)

    if (rows.length === 0) {
      console.log('⚠️  No revenue rows to process')
      return {
        monthlyDeposits: currentMonthTotal,
        weeklyRevenue: this.buildWeeklySeries(weeklyTotals, now),
        ytdRevenue: monthKeys.map((date) => ({ date, amount: 0 })),
      }
    }

    const dateKey = this.findKeyAcrossRows(rows, REVENUE_DATE_KEY_PREFERENCES)
    const revenueColumns = this.findColumnsByKeywords(rows, REVENUE_VALUE_INCLUDE, REVENUE_VALUE_EXCLUDE)
    
    console.log('💰 Revenue aggregation:', {
      dateKey,
      revenueColumns,
      totalRows: rows.length,
    })

    let processedRows = 0
    let skippedRows = 0
    let totalAmount = 0

    rows.forEach((row) => {
      const date = dateKey ? this.parseDateValue(row[dateKey]) : null
      if (!date) {
        skippedRows++
        return
      }

      const amount = this.sumColumnsByKeys(row, revenueColumns)
      if (!amount) {
        skippedRows++
        return
      }

      processedRows++
      totalAmount += amount

      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

      if (normalizedDate >= startOfMonth && normalizedDate <= today) {
        currentMonthTotal += amount
      }

      const weekStart = this.getWeekStart(date)
      const weekKey = this.formatKeyDate(weekStart)
      weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + amount)

      const monthKey = this.formatMonthKey(date)
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + amount)
    })

    console.log('💰 Revenue processing summary:', {
      processedRows,
      skippedRows,
      totalAmount: this.roundCurrency(totalAmount),
      currentMonthTotal: this.roundCurrency(currentMonthTotal),
    })

    const ytdRevenue = monthKeys.map((date) => ({
      date,
      amount: this.roundCurrency(monthlyTotals.get(date) || 0),
    }))

    const currentMonthKey = this.formatMonthKey(now)
    const monthKeyTotal = monthlyTotals.get(currentMonthKey) ?? 0
    const monthlyDepositsRaw = currentMonthTotal > 0 ? currentMonthTotal : monthKeyTotal

    return {
      monthlyDeposits: this.roundCurrency(monthlyDepositsRaw),
      weeklyRevenue: this.buildWeeklySeries(weeklyTotals, now),
      ytdRevenue,
    }
  }

  private calculateAttorneyBillableHours(rows: CsvRow[]): { name: string; hours: number }[] {
    if (rows.length === 0) {
      console.log('⚠️  No attorney data rows to process')
      return []
    }

    const nameKey = this.findKeyAcrossRows(rows, ATTORNEY_KEY_PREFERENCES)
    if (!nameKey) {
      console.log('⚠️  Could not find attorney name column in data')
      return []
    }

    const hourColumns = this.findColumnsByKeywords(rows, HOURS_INCLUDE, HOURS_EXCLUDE)
    if (hourColumns.length === 0) {
      console.log('⚠️  Could not find hours column in data')
      return []
    }

    console.log('👥 Attorney hours aggregation:', {
      nameKey,
      hourColumns,
      totalRows: rows.length,
    })

    const { column, totals } = this.selectAttorneyHourColumn(rows, nameKey, hourColumns)
    if (totals.size === 0) {
      console.log('⚠️  No attorney totals calculated')
      return []
    }

    console.log(`👥 Selected column "${column}" for attorney hours. Found ${totals.size} attorneys`)

    const result = Array.from(totals.entries())
      .map(([name, hours]) => ({ name, hours: this.roundHours(hours) }))
      .sort((a, b) => b.hours - a.hours)
    
    console.log('👥 Top attorneys:', result.slice(0, 3))
    return result
  }

  private calculateYTDTime(rows: CsvRow[], now: Date): { date: string; hours: number }[] {
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const monthKeys = this.buildMonthKeyRange(startOfYear, now)

    if (rows.length === 0) {
      console.log('⚠️  No time entry rows to process')
      return monthKeys.map((date) => ({ date, hours: 0 }))
    }

    const dateKey = this.findKeyAcrossRows(rows, TIME_DATE_KEY_PREFERENCES)
    if (!dateKey) {
      console.log('⚠️  Could not find date column in time entry data')
      return monthKeys.map((date) => ({ date, hours: 0 }))
    }

    const timeColumns = this.determineTimeColumns(rows)
    if (timeColumns.length === 0) {
      console.log('⚠️  Could not find time/hours column in data')
      return monthKeys.map((date) => ({ date, hours: 0 }))
    }

    console.log('⏱️  YTD time aggregation:', {
      dateKey,
      timeColumns,
      totalRows: rows.length,
    })

    const monthlyTotals = new Map<string, number>()
    let processedRows = 0
    let totalHours = 0

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

      processedRows++
      totalHours += hours
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + hours)
    })

    console.log('⏱️  YTD time processing summary:', {
      processedRows,
      totalHours: this.roundHours(totalHours),
      monthsWithData: monthlyTotals.size,
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

    const allKeys = Array.from(keys)
    const match = this.findFirstMatchingKey(allKeys, preferences)
    
    if (match) {
      return match
    }

    // Fallback: try to find any column that looks like it might be what we're looking for
    // For dates, look for columns with date-like values
    // For names, look for columns with text values
    console.log('⚠️  No preferred key found, checking column content...')
    
    const sampleRows = rows.slice(0, Math.min(10, rows.length))
    
    // Check if this is for dates by seeing if any preference contains 'date'
    const isDateSearch = preferences.some((pref) => pref.some((token) => token.includes('date')))
    
    if (isDateSearch) {
      // Find columns with date-like values
      for (const key of allKeys) {
        const values = sampleRows.map((row) => row[key]).filter((v) => v && v.trim())
        const dateValues = values.filter((v) => this.parseDateValue(v) !== null)
        if (dateValues.length > values.length * 0.7) {
          console.log(`Found date column: ${key}`)
          return key
        }
      }
    }

    // Check if this is for names/text
    const isNameSearch = preferences.some((pref) => 
      pref.some((token) => ['name', 'user', 'attorney', 'timekeeper'].includes(token))
    )
    
    if (isNameSearch) {
      // Find columns with text values (non-numeric, non-date)
      for (const key of allKeys) {
        const values = sampleRows.map((row) => row[key]).filter((v) => v && v.trim())
        const textValues = values.filter((v) => 
          v.length > 2 && 
          this.parseNumericValue(v) === 0 && 
          this.parseDateValue(v) === null
        )
        if (textValues.length > values.length * 0.7) {
          console.log(`Found name/text column: ${key}`)
          return key
        }
      }
    }

    console.log('⚠️  Could not find suitable column')
    return undefined
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

    const matches = Array.from(columns).filter((column) => {
      const normalized = this.normalizeKey(column)
      const matchesInclude = include.some((keyword) => normalized.includes(keyword))
      if (!matchesInclude) {
        return false
      }
      const matchesExclude = exclude.some((keyword) => normalized.includes(keyword))
      return !matchesExclude
    })

    // If we found matches, return them
    if (matches.length > 0) {
      return matches
    }

    // Fallback: look for numeric columns that might be what we're looking for
    console.log('⚠️  No columns matched keywords, looking for numeric columns...')
    const numericColumns: string[] = []
    
    // Sample first few rows to find columns with numeric data
    const sampleRows = rows.slice(0, Math.min(10, rows.length))
    Array.from(columns).forEach((column) => {
      const values = sampleRows.map((row) => row[column]).filter((v) => v && v.trim())
      const numericValues = values.filter((v) => this.parseNumericValue(v) !== 0)
      
      // If most values are numeric, consider it a numeric column
      if (numericValues.length > values.length * 0.5) {
        numericColumns.push(column)
      }
    })

    console.log('Found numeric columns:', numericColumns)
    return numericColumns
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
      const name = row[nameKey]?.replace(/\s+/g, ' ').trim()
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

    // Check if this is a negative value in parentheses
    const isNegative = (trimmed.startsWith('(') && trimmed.endsWith(')')) || trimmed.startsWith('-')

    // Remove all non-numeric characters except dots and digits
    let numericString = trimmed.replace(/[^0-9.\-]/g, '')
    
    // Handle multiple dots (keep only the last one for decimal separator)
    const dotCount = (numericString.match(/\./g) || []).length
    if (dotCount > 1) {
      // Assume the last dot is the decimal separator, remove others
      const parts = numericString.split('.')
      const integerPart = parts.slice(0, -1).join('')
      const decimalPart = parts[parts.length - 1]
      numericString = `${integerPart}.${decimalPart}`
    }

    // Remove leading/trailing dots
    numericString = numericString.replace(/^\.+|\.+$/g, '')

    if (!numericString || numericString === '-') {
      return 0
    }

    const parsed = Number.parseFloat(numericString)
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      return 0
    }

    return isNegative && parsed > 0 ? -parsed : parsed
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
