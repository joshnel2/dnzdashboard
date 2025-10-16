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
  }
  return config;
})

class ClioService {
  async getDashboardData(): Promise<DashboardData> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    
    const token = getAccessToken()
    console.log('🔑 Using token:', token ? '***' + token.slice(-4) : 'NO TOKEN')
    console.log('🌐 API Base URL:', API_BASE_URL)

    // Fetch time entries for billable hours
    console.log('📊 Fetching time entries...')
    const timeEntriesResponse = await clioApi.get<{ data: ClioTimeEntry[] }>('/time_entries.json', {
      params: {
        since: startOfYear.toISOString(),
        fields: 'user{id,name},date,quantity,price',
      },
    })
    console.log('✅ Time entries received:', timeEntriesResponse.data.data?.length || 0, 'entries')

    // Fetch activities for deposits and revenue
    console.log('💰 Fetching activities...')
    const activitiesResponse = await clioApi.get<{ data: ClioActivity[] }>('/activities.json', {
      params: {
        since: startOfYear.toISOString(),
        type: 'Payment',
      },
    })
    console.log('✅ Activities received:', activitiesResponse.data.data?.length || 0, 'activities')

    const transformedData = this.transformData(timeEntriesResponse.data.data, activitiesResponse.data.data)
    console.log('🔄 Transformed data:', transformedData)
    
    return transformedData
  }

  transformData(timeEntries: ClioTimeEntry[], activities: ClioActivity[]): DashboardData {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // Calculate monthly deposits
    const monthlyDeposits = activities
      .filter(activity => {
        const activityDate = new Date(activity.date)
        return activityDate.getMonth() === currentMonth && 
               activityDate.getFullYear() === currentYear
      })
      .reduce((sum, activity) => sum + activity.total, 0)

    // Group billable hours by attorney (CURRENT MONTH ONLY)
    const attorneyHoursMap = new Map<string, number>()
    timeEntries
      .filter(entry => {
        const entryDate = new Date(entry.date)
        return entryDate.getMonth() === currentMonth && 
               entryDate.getFullYear() === currentYear
      })
      .forEach(entry => {
        const name = entry.user.name
        const hours = attorneyHoursMap.get(name) || 0
        attorneyHoursMap.set(name, hours + entry.quantity)
      })
    const attorneyBillableHours = Array.from(attorneyHoursMap.entries())
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)

    // Calculate weekly revenue (last 12 weeks)
    const weeklyRevenue = this.calculateWeeklyRevenue(activities)

    // Calculate YTD time entries
    const ytdTime = this.calculateYTDTime(timeEntries)

    // Calculate YTD revenue
    const ytdRevenue = this.calculateYTDRevenue(activities)

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
      const activityDate = new Date(activity.date)
      const weekStart = this.getWeekStart(activityDate)
      const weekKey = this.formatDate(weekStart)
      
      const current = weeklyMap.get(weekKey) || 0
      weeklyMap.set(weekKey, current + activity.total)
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
      const date = new Date(activity.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      const current = monthlyMap.get(monthKey) || 0
      monthlyMap.set(monthKey, current + activity.total)
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
}

export const clioService = new ClioService()
