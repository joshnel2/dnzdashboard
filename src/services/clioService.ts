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
    try {
      const now = new Date()
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      console.log('Clio API Request:', {
        baseURL: API_BASE_URL,
        token: getAccessToken() ? 'Token present (***' + getAccessToken().slice(-4) + ')' : 'NO TOKEN',
        startOfYear: startOfYear.toISOString()
      })

      // Fetch time entries for billable hours
      const timeEntriesResponse = await clioApi.get<{ data: ClioTimeEntry[] }>('/time_entries', {
        params: {
          since: startOfYear.toISOString(),
          fields: 'user{id,name},date,quantity,price',
        },
      })

      console.log('Time entries fetched:', timeEntriesResponse.data.data?.length || 0, 'entries')

      // Fetch activities for deposits and revenue
      const activitiesResponse = await clioApi.get<{ data: ClioActivity[] }>('/activities', {
        params: {
          since: startOfYear.toISOString(),
          type: 'Payment',
        },
      })

      console.log('Activities fetched:', activitiesResponse.data.data?.length || 0, 'activities')

      return this.transformData(timeEntriesResponse.data.data, activitiesResponse.data.data)
    } catch (error: any) {
      console.error('Clio API Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      })
      throw error
    }
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
