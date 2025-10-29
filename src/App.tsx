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
      // eslint-disable-next-line no-console
      console.log('[App] Starting data fetch...')
      const token = localStorage.getItem('clio_access_token')
      // eslint-disable-next-line no-console
      console.log('[App] Access token in localStorage:', token ? 'YES' : 'NO')
      
      if (!token) {
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      
      try {
        // eslint-disable-next-line no-console
        console.log('[App] Fetching dashboard data...')
        const dashboardData = await clioService.getDashboardData()
        setData(dashboardData)
        setLoading(false)
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[App] ✗ Error loading dashboard data:', err?.message || err)
        if (err.response?.status === 401) {
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
          setLoading(false)
        } else {
          // eslint-disable-next-line no-console
          console.error('[App] API Error:', err?.message || 'Unknown error', err?.response || '')
          // Just use sample data if API fails
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
