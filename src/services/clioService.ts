import axios from 'axios'
import type { DashboardData, ClioTimeEntry, ClioActivity } from '../types'

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
    console.log('🔐 [ClioAPI] Request to:', config.url, {
      hasAuth: true,
      tokenPreview: `${token.substring(0, 15)}...`,
      params: config.params
    })
  } else {
    console.warn('⚠️  [ClioAPI] No access token found for request:', config.url)
  }
  return config;
})

// Add response interceptor to log responses
clioApi.interceptors.response.use(
  (response) => {
    console.log('✅ [ClioAPI] Response from:', response.config.url, {
      status: response.status,
      dataKeys: Object.keys(response.data || {})
    })
    return response
  },
  (error) => {
    console.error('❌ [ClioAPI] Request failed:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    })
    return Promise.reject(error)
  }
)

class ClioService {
  // Fetch all paginated data from Clio API
  async fetchAllPaginated<T>(
    endpoint: string,
    params: any
  ): Promise<T[]> {
    console.log(`📄 [ClioService] Fetching paginated data from ${endpoint}...`)
    
    let allData: T[] = []
    let page = 1
    let hasMore = true
    const limit = 200 // Clio's max per page
    
    while (hasMore) {
      try {
        console.log(`📄 Fetching page ${page}...`)
        
        const response = await clioApi.get<{ data: T[], meta?: any }>(endpoint, {
          params: {
            ...params,
            limit,
            offset: (page - 1) * limit,
          },
        })
        
        console.log(`📄 Page ${page} response:`, {
          status: response.status,
          dataCount: response.data?.data?.length || 0,
          meta: response.data?.meta
        })
        
        const pageData = response.data.data || []
        allData = [...allData, ...pageData]
        
        // Check if there's more data
        // Clio might use different pagination indicators
        const hasNextPage = pageData.length === limit
        const totalFromMeta = response.data?.meta?.records
        
        if (totalFromMeta) {
          hasMore = allData.length < totalFromMeta
          console.log(`📊 Progress: ${allData.length} / ${totalFromMeta}`)
        } else {
          hasMore = hasNextPage
          console.log(`📊 Loaded ${allData.length} records so far...`)
        }
        
        if (!hasMore) {
          console.log(`✅ All pages fetched. Total: ${allData.length} records`)
        }
        
        page++
        
        // Safety limit to prevent infinite loops
        if (page > 100) {
          console.warn('⚠️  Reached page limit (100), stopping pagination')
          break
        }
        
      } catch (error: any) {
        console.error(`❌ Error fetching page ${page}:`, {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        })
        throw error
      }
    }
    
    return allData
  }

  async getDashboardData(): Promise<DashboardData> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    
    console.log('🔍 [ClioService] Fetching dashboard data...')
    console.log('📅 Date range:', {
      startOfYear: startOfYear.toISOString(),
      now: now.toISOString(),
      year: now.getFullYear(),
      month: now.getMonth() + 1
    })

    try {
      // Fetch time entries
      console.log('⏱️  Requesting time entries with params:', {
        since: startOfYear.toISOString(),
        fields: 'user{id,name},date,quantity,price'
      })
      
      const timeEntries = await this.fetchAllPaginated<ClioTimeEntry>('/time_entries.json', {
        since: startOfYear.toISOString(),
        fields: 'user{id,name},date,quantity,price',
      })
      
      console.log('⏱️  Time entries received:', {
        count: timeEntries.length,
        sample: timeEntries.slice(0, 3),
        allDates: timeEntries.map(e => e.date).slice(0, 20)
      })
      
      // Try to fetch activities/payments - try multiple endpoints if needed
      let activities: ClioActivity[] = []
      
      try {
        console.log('💰 Trying activities endpoint with type=Payment...')
        activities = await this.fetchAllPaginated<ClioActivity>('/activities.json', {
          since: startOfYear.toISOString(),
          type: 'Payment',
        })
        
        if (activities.length === 0) {
          console.warn('⚠️  Activities endpoint returned no data. Trying alternative approaches...')
          
          // Try without type filter
          console.log('💰 Trying activities endpoint without type filter...')
          activities = await this.fetchAllPaginated<ClioActivity>('/activities.json', {
            since: startOfYear.toISOString(),
          })
          
          if (activities.length > 0) {
            console.log('✅ Got activities without type filter:', {
              total: activities.length,
              types: [...new Set(activities.map(a => a.type))],
              sample: activities.slice(0, 3)
            })
            // Filter for payment-related activities
            activities = activities.filter(a => 
              a.type && (
                a.type.toLowerCase().includes('payment') || 
                a.type.toLowerCase().includes('deposit') ||
                a.type.toLowerCase().includes('revenue')
              )
            )
            console.log(`💰 Filtered to ${activities.length} payment-related activities`)
          }
        }
        
        // If still no data, try bill_payments endpoint
        if (activities.length === 0) {
          try {
            console.log('💰 Trying bill_payments endpoint...')
            const billPayments = await this.fetchAllPaginated<any>('/bill_payments.json', {
              created_since: startOfYear.toISOString(),
            })
            console.log(`💰 Bill payments endpoint returned ${billPayments.length} records`)
            
            // Transform bill_payments to activities format
            activities = billPayments.map(bp => ({
              id: bp.id,
              date: bp.date || bp.created_at,
              total: bp.amount || bp.total || 0,
              type: 'Payment'
            }))
          } catch (billPaymentError: any) {
            console.warn('⚠️  bill_payments endpoint failed:', billPaymentError.message)
          }
        }
      } catch (activityError: any) {
        console.error('❌ Error fetching activities:', activityError.message)
        // Continue with empty activities array
      }
      
      console.log('✅ [ClioService] All data fetched')
      console.log('📊 [ClioService] Total data counts:', {
        timeEntries: timeEntries.length,
        activities: activities.length
      })
      
      if (timeEntries.length > 0) {
        console.log('⏱️  Sample time entries:', timeEntries.slice(0, 3))
        console.log('⏱️  Last time entry:', timeEntries[timeEntries.length - 1])
      } else {
        console.warn('⚠️  No time entries found!')
      }
      
      if (activities.length > 0) {
        console.log('💰 Sample activities:', activities.slice(0, 3))
        console.log('💰 Last activity:', activities[activities.length - 1])
      } else {
        console.warn('⚠️  No activities found!')
      }

      return this.transformData(timeEntries, activities)
    } catch (error: any) {
      console.error('❌ [ClioService] Error fetching dashboard data:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          params: error.config?.params
        }
      })
      throw error
    }
  }

  transformData(timeEntries: ClioTimeEntry[], activities: ClioActivity[]): DashboardData {
    console.log('🔄 [ClioService] Starting data transformation...')
    console.log('📥 RAW INPUT DATA:', {
      timeEntriesCount: timeEntries.length,
      activitiesCount: activities.length,
      firstTimeEntry: timeEntries[0],
      lastTimeEntry: timeEntries[timeEntries.length - 1],
      firstActivity: activities[0],
      lastActivity: activities[activities.length - 1]
    })
    
    // Log ALL dates in time entries
    if (timeEntries.length > 0) {
      const timeEntryDates = timeEntries.map(e => e.date).sort()
      console.log('📅 Time Entry Date Range:', {
        earliest: timeEntryDates[0],
        latest: timeEntryDates[timeEntryDates.length - 1],
        sampleDates: timeEntryDates.slice(0, 10)
      })
    }
    
    // Log ALL dates in activities
    if (activities.length > 0) {
      const activityDates = activities.map(a => a.date).sort()
      console.log('📅 Activity Date Range:', {
        earliest: activityDates[0],
        latest: activityDates[activityDates.length - 1],
        sampleDates: activityDates.slice(0, 10)
      })
    }
    
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    console.log('📅 Current period (what we are filtering for):', {
      month: currentMonth + 1,
      year: currentYear,
      monthName: new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long' }),
      todayDate: now.toISOString()
    })

    // Calculate monthly deposits
    const currentMonthActivities = activities.filter(activity => {
      const activityDate = new Date(activity.date)
      return activityDate.getMonth() === currentMonth && 
             activityDate.getFullYear() === currentYear
    })
    
    const monthlyDeposits = currentMonthActivities.reduce((sum, activity) => sum + activity.total, 0)
    
    console.log('💰 Monthly Deposits Calculation:', {
      totalActivities: activities.length,
      currentMonthActivities: currentMonthActivities.length,
      monthlyDeposits,
      sampleActivities: currentMonthActivities.slice(0, 3)
    })

    // Group billable hours by attorney (CURRENT MONTH ONLY)
    const attorneyHoursMap = new Map<string, number>()
    const currentMonthTimeEntries = timeEntries.filter(entry => {
      const entryDate = new Date(entry.date)
      return entryDate.getMonth() === currentMonth && 
             entryDate.getFullYear() === currentYear
    })
    
    currentMonthTimeEntries.forEach(entry => {
      const name = entry.user.name
      const hours = attorneyHoursMap.get(name) || 0
      attorneyHoursMap.set(name, hours + entry.quantity)
    })
    
    const attorneyBillableHours = Array.from(attorneyHoursMap.entries())
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
    
    console.log('👥 Attorney Billable Hours:', {
      totalTimeEntries: timeEntries.length,
      currentMonthEntries: currentMonthTimeEntries.length,
      uniqueAttorneys: attorneyHoursMap.size,
      attorneyHours: attorneyBillableHours
    })

    // Calculate weekly revenue (last 12 weeks)
    const weeklyRevenue = this.calculateWeeklyRevenue(activities)
    console.log('📈 Weekly Revenue:', {
      weeksCount: weeklyRevenue.length,
      data: weeklyRevenue
    })

    // Calculate YTD time entries
    const ytdTime = this.calculateYTDTime(timeEntries)
    console.log('⏱️  YTD Time:', {
      monthsCount: ytdTime.length,
      data: ytdTime
    })

    // Calculate YTD revenue
    const ytdRevenue = this.calculateYTDRevenue(activities)
    console.log('💵 YTD Revenue:', {
      monthsCount: ytdRevenue.length,
      data: ytdRevenue
    })

    const result = {
      monthlyDeposits,
      attorneyBillableHours,
      weeklyRevenue,
      ytdTime,
      ytdRevenue,
    }
    
    console.log('✅ [ClioService] Transformation complete:', {
      monthlyDeposits: result.monthlyDeposits,
      attorneyCount: result.attorneyBillableHours.length,
      weeklyDataPoints: result.weeklyRevenue.length,
      ytdTimeDataPoints: result.ytdTime.length,
      ytdRevenueDataPoints: result.ytdRevenue.length
    })
    
    return result
  }

  calculateWeeklyRevenue(activities: ClioActivity[]) {
    console.log('📊 Calculating weekly revenue...')
    const weeklyMap = new Map<string, number>()
    const now = new Date()

    activities.forEach(activity => {
      const activityDate = new Date(activity.date)
      const weekStart = this.getWeekStart(activityDate)
      const weekKey = this.formatDate(weekStart)
      
      const current = weeklyMap.get(weekKey) || 0
      weeklyMap.set(weekKey, current + activity.total)
    })
    
    console.log('📊 Weekly revenue map:', Array.from(weeklyMap.entries()).slice(0, 5))

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
    console.log('📊 Calculating YTD time...')
    const monthlyMap = new Map<string, number>()

    timeEntries.forEach(entry => {
      const date = new Date(entry.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      const current = monthlyMap.get(monthKey) || 0
      monthlyMap.set(monthKey, current + entry.quantity)
    })
    
    console.log('📊 Monthly time map:', Array.from(monthlyMap.entries()))

    const result = Array.from(monthlyMap.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    // Get last 12 months if we have more than that
    if (result.length > 12) {
      return result.slice(-12)
    }
    
    return result
  }

  calculateYTDRevenue(activities: ClioActivity[]) {
    console.log('📊 Calculating YTD revenue...')
    const monthlyMap = new Map<string, number>()

    activities.forEach(activity => {
      const date = new Date(activity.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      const current = monthlyMap.get(monthKey) || 0
      monthlyMap.set(monthKey, current + activity.total)
    })
    
    console.log('📊 Monthly revenue map:', Array.from(monthlyMap.entries()))

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
