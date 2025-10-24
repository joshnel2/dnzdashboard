import axios from 'axios'
import type { DashboardData, ClioTimeEntry, ClioBillPayment } from '../types'

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
    // Fetch data from last 2 years to ensure we get something
    const twoYearsAgo = new Date(now.getFullYear() - 2, 0, 1)
    
    console.log('[ClioService] getDashboardData() START', {
      since: twoYearsAgo.toISOString(),
      currentDate: now.toISOString(),
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      baseUrl: API_BASE_URL,
    })

    try {
      // Try bill_payments endpoint first for actual payment/deposit data
      console.log('[ClioService] Making API requests to Clio...')
      console.log('[ClioService] Attempting /bill_payments.json endpoint...')
      
      let paymentsResponse: any
      try {
        paymentsResponse = await clioApi.get<{ data: ClioBillPayment[] }>('/bill_payments.json', {
          params: {
            since: twoYearsAgo.toISOString(),
            fields: 'id,date,amount,applied_date,created_at',
          },
        })
        console.log('[ClioService] /bill_payments.json succeeded')
      } catch (billPaymentError: any) {
        console.warn('[ClioService] /bill_payments.json failed, trying /activities.json as fallback', {
          status: billPaymentError.response?.status,
          message: billPaymentError.message,
        })
        // Fallback to activities endpoint
        paymentsResponse = await clioApi.get<{ data: any[] }>('/activities.json', {
          params: {
            since: twoYearsAgo.toISOString(),
            type: 'Payment',
            fields: 'id,date,total,amount,price,occurred_at,created_at',
          },
        })
        console.log('[ClioService] /activities.json fallback succeeded')
      }
      
      const timeEntriesResponse = await clioApi.get<{ data: ClioTimeEntry[] }>('/time_entries.json', {
        params: {
          since: twoYearsAgo.toISOString(),
          fields: 'id,user{id,name},date,quantity,price,occurred_at,duration,created_at',
        },
      })
      
      console.log('[ClioService] All API requests completed successfully')

      const timeEntriesRaw = timeEntriesResponse.data?.data || []
      const paymentsRaw = paymentsResponse.data?.data || []
      const timeCount = timeEntriesRaw.length
      const paymentCount = paymentsRaw.length
      
      console.log('[ClioService] Raw API response structure:', {
        timeEntriesResponse: {
          hasData: !!timeEntriesResponse.data,
          hasDataArray: !!timeEntriesResponse.data?.data,
          count: timeCount,
          fullResponse: timeEntriesResponse.data,
        },
        paymentsResponse: {
          hasData: !!paymentsResponse.data,
          hasDataArray: !!paymentsResponse.data?.data,
          count: paymentCount,
          fullResponse: paymentsResponse.data,
        },
      })
      
      // Log the full raw response to see structure
      console.log('🔍 FULL TIME ENTRIES RESPONSE:', timeEntriesResponse.data)
      console.log('🔍 FULL PAYMENTS RESPONSE:', paymentsResponse.data)
      
      console.log('==============================================')
      console.log('📊 API RESPONSE SUMMARY')
      console.log('==============================================')
      console.log('⏰ Time Entries Count:', timeCount)
      console.log('💰 Payments Count:', paymentCount)
      console.log('==============================================')
      
      if (timeCount > 0) {
        console.log('📝 Time Entry Samples (first 3):')
        timeEntriesRaw.slice(0, 3).forEach((e: any, i: number) => {
          console.log(`  Entry ${i + 1}:`, {
            date: e.date,
            occurred_at: e.occurred_at,
            created_at: e.created_at,
            quantity: e.quantity,
            duration: e.duration,
            user: e.user?.name,
            allKeys: Object.keys(e),
          })
        })
      } else {
        console.warn('⚠️ NO TIME ENTRIES returned from API')
      }
      
      if (paymentCount > 0) {
        console.log('💵 Payment Samples (first 3):')
        paymentsRaw.slice(0, 3).forEach((p: any, i: number) => {
          console.log(`  Payment ${i + 1}:`, {
            date: p.date,
            applied_date: p.applied_date,
            created_at: p.created_at,
            amount: p.amount,
            total: p.total,
            price: p.price,
            allKeys: Object.keys(p),
            fullObject: p,
          })
        })
      } else {
        console.warn('⚠️ NO PAYMENTS returned from API')
      }
      console.log('==============================================')
      
      // Normalize payments data (handle both bill_payments and activities response)
      const normalizedPayments = paymentsRaw.map((p: any) => ({
        id: p.id,
        date: p.date,
        applied_date: p.applied_date || p.occurred_at,
        created_at: p.created_at,
        amount: p.amount || p.total || p.price || 0,
      }))
      
      console.log('[ClioService] Normalized payments sample:', normalizedPayments.slice(0, 3))

      const transformedData = this.transformData(timeEntriesResponse.data.data || [], normalizedPayments)
      console.log('[ClioService] Data transformation complete:', {
        monthlyDeposits: transformedData.monthlyDeposits,
        attorneyCount: transformedData.attorneyBillableHours.length,
        weeklyRevenueCount: transformedData.weeklyRevenue.length,
        ytdTimeCount: transformedData.ytdTime.length,
        ytdRevenueCount: transformedData.ytdRevenue.length,
      })
      
      return transformedData
    } catch (error: any) {
      console.error('[ClioService] ERROR in getDashboardData:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
      })
      throw error
    }
  }

  transformData(timeEntries: ClioTimeEntry[], payments: ClioBillPayment[]): DashboardData {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    console.log('[ClioService] transformData()', {
      timeEntries: timeEntries.length,
      payments: payments.length,
      currentMonth: currentMonth + 1,
      currentYear,
    })

    // Calculate monthly deposits from bill_payments
    console.log('[ClioService] Processing monthly deposits...', {
      totalPayments: payments.length,
      targetMonth: currentMonth + 1,
      targetYear: currentYear,
    })
    
    const currentMonthPayments = payments.filter(payment => {
      const effectiveDateStr = payment.applied_date || payment.date || payment.created_at
      const paymentDate = effectiveDateStr ? new Date(effectiveDateStr) : new Date(NaN)
      const isCurrentMonth = paymentDate.getMonth() === currentMonth && 
             paymentDate.getFullYear() === currentYear
      
      if (isCurrentMonth) {
        console.log('[ClioService] Payment in current month:', {
          date: effectiveDateStr,
          amount: payment.amount,
        })
      }
      
      return isCurrentMonth
    })
    
    const monthlyDeposits = currentMonthPayments.reduce((sum, payment) => {
      const amount = typeof payment.amount === 'number' ? payment.amount : 0
      return sum + amount
    }, 0)
    
    console.log('[ClioService] Monthly deposits (current month)', { 
      monthlyDeposits,
      paymentsInMonth: currentMonthPayments.length,
    })

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
    const weeklyRevenue = this.calculateWeeklyRevenue(payments)
    console.log('[ClioService] Weekly revenue weeks', weeklyRevenue.length)

    // Calculate YTD time entries
    const ytdTime = this.calculateYTDTime(timeEntries)
    console.log('[ClioService] YTD time months', ytdTime.length)

    // Calculate YTD revenue
    const ytdRevenue = this.calculateYTDRevenue(payments)
    console.log('[ClioService] YTD revenue months', ytdRevenue.length)

    return {
      monthlyDeposits,
      attorneyBillableHours,
      weeklyRevenue,
      ytdTime,
      ytdRevenue,
    }
  }

  calculateWeeklyRevenue(payments: ClioBillPayment[]) {
    const weeklyMap = new Map<string, number>()
    const now = new Date()

    payments.forEach(payment => {
      const effectiveDateStr = payment.applied_date || payment.date || payment.created_at
      const paymentDate = effectiveDateStr ? new Date(effectiveDateStr) : new Date(NaN)
      
      if (isNaN(paymentDate.getTime())) return // Skip invalid dates
      
      const weekStart = this.getWeekStart(paymentDate)
      const weekKey = this.formatDate(weekStart)
      
      const amount = typeof payment.amount === 'number' ? payment.amount : 0
      const current = weeklyMap.get(weekKey) || 0
      weeklyMap.set(weekKey, current + amount)
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

  calculateYTDRevenue(payments: ClioBillPayment[]) {
    const monthlyMap = new Map<string, number>()

    payments.forEach(payment => {
      const effectiveDateStr = payment.applied_date || payment.date || payment.created_at
      const date = effectiveDateStr ? new Date(effectiveDateStr) : new Date(NaN)
      
      if (isNaN(date.getTime())) return // Skip invalid dates
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      const amount = typeof payment.amount === 'number' ? payment.amount : 0
      const current = monthlyMap.get(monthKey) || 0
      monthlyMap.set(monthKey, current + amount)
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
