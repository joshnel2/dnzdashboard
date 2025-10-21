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
      try {
        const dashboardData = await clioService.getDashboardData()
        console.log('[App] Dashboard data loaded', {
          monthlyDeposits: dashboardData.monthlyDeposits,
          attorneys: dashboardData.attorneyBillableHours.length,
          weeklyRevenueWeeks: dashboardData.weeklyRevenue.length,
          ytdTimeMonths: dashboardData.ytdTime.length,
          ytdRevenueMonths: dashboardData.ytdRevenue.length,
        })
        setData(dashboardData)
        setLoading(false)
      } catch (err: any) {
        if (err.response?.status === 401) {
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
          console.warn('[App] 401 from API - Clio auth required')
          setLoading(false)
        } else {
          // Just use sample data if API fails
          console.error('[App] Failed to load dashboard data, using sample data', {
            status: err.response?.status,
            data: err.response?.data,
            message: err.message,
          })
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
