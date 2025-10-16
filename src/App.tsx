import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import AuthButton from './components/AuthButton'
import { clioService } from './services/clioService'
import type { DashboardData } from './types'

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Check if we have OAuth token in localStorage
        const token = localStorage.getItem('clio_access_token')
        
        if (!token) {
          // No token - need to authenticate
          setNeedsAuth(true)
          setLoading(false)
          return
        }
        
        // Fetch real data from Clio
        const dashboardData = await clioService.getDashboardData()
        setData(dashboardData)
        setNeedsAuth(false)
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err)
        
        // If auth error, clear token and show auth button
        if (err.response?.status === 401) {
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
        } else {
          setError('Failed to load data from Clio API')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
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

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '24px',
        color: '#e74c3c'
      }}>
        {error}
      </div>
    )
  }

  return <Dashboard data={data!} />
}

export default App
