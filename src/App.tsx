import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import AuthButton from './components/AuthButton'
import { clioService } from './services/clioService'
import type { DashboardData } from './types'

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      console.log('[App] Starting data fetch...')
      try {
        const dashboardData = await clioService.getDashboardData()
        console.log('[App] Dashboard data loaded successfully!', {
          monthlyDeposits: dashboardData.monthlyDeposits,
          attorneys: dashboardData.attorneyBillableHours.length,
          weeklyRevenueWeeks: dashboardData.weeklyRevenue.length,
          ytdTimeMonths: dashboardData.ytdTime.length,
          ytdRevenueMonths: dashboardData.ytdRevenue.length,
        })
        
        // Check if we got any data at all
        const hasAnyData = 
          dashboardData.monthlyDeposits > 0 ||
          dashboardData.attorneyBillableHours.length > 0 ||
          dashboardData.weeklyRevenue.some(w => w.amount > 0) ||
          dashboardData.ytdTime.some(t => t.hours > 0) ||
          dashboardData.ytdRevenue.some(r => r.amount > 0)
        
        console.log('[App] Data check:', {
          hasAnyData,
          isEmpty: !hasAnyData,
        })
        
        if (!hasAnyData) {
          console.warn('[App] WARNING: API returned but all data is empty/zero. Using sample data instead.')
          setData(clioService.getSampleData())
        } else {
          setData(dashboardData)
        }
        setLoading(false)
      } catch (err: any) {
        console.error('[App] ERROR fetching data:', {
          name: err.name,
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          responseData: err.response?.data,
          url: err.config?.url,
          stack: err.stack,
        })
        
        if (err.response?.status === 401) {
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
          console.warn('[App] 401 from API - Clio auth required')
          setLoading(false)
        } else {
          // Just use sample data if API fails
          console.error('[App] Failed to load dashboard data, using sample data')
          setData(clioService.getSampleData())
          setLoading(false)
        }
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '24px',
        color: '#666'
      }}>
        Loading dashboard...
      </div>
    )
  }

  if (needsAuth) {
    return <AuthButton />
  }

  if (!data) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '24px',
        color: '#666'
      }}>
        Loading...
      </div>
    )
  }

  return <Dashboard data={data} />
}

export default App
