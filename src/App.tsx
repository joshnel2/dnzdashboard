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
      const token = localStorage.getItem('clio_access_token')
      try {
        console.info('[CLIO][app] init', {
          hasToken: !!token,
          tokenLast4: token ? token.slice(-4) : null,
          tokenLength: token ? token.length : 0,
        })
      } catch (_e) {
        // ignore logging failures
      }
      
      if (!token) {
        console.warn('[CLIO][app] No access token found, requiring auth')
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      
      try {
        console.info('[CLIO][app] Fetching dashboard data...')
        const dashboardData = await clioService.getDashboardData()
        console.info('[CLIO][app] Dashboard data fetched', {
          monthlyDeposits: dashboardData.monthlyDeposits,
          attorneyBillableHoursCount: dashboardData.attorneyBillableHours.length,
          weeklyRevenueWeeks: dashboardData.weeklyRevenue.length,
          ytdTimeMonths: dashboardData.ytdTime.length,
          ytdRevenueMonths: dashboardData.ytdRevenue.length,
        })
        setData(dashboardData)
        setLoading(false)
      } catch (err: any) {
        if (err.response?.status === 401) {
          console.warn('[CLIO][app] API returned 401 - clearing token and requiring auth')
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
          setLoading(false)
        } else {
          // Just use sample data if API fails
          try {
            console.error('[CLIO][app] API error - using sample data', {
              status: err?.response?.status,
              message: err?.message,
              isNetworkError: !err?.response,
            })
          } catch (_e) {
            // ignore logging failures
          }
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
    console.info('[CLIO][app] Rendering AuthButton (needsAuth)')
    return <AuthButton />
  }

  if (!data) {
    console.warn('[CLIO][app] No data to render yet')
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
