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
        
        console.log('Token check:', token ? 'Token found (***' + token.slice(-4) + ')' : 'No token')
        
        if (!token) {
          // No token - need to authenticate
          console.log('No token, showing auth button')
          setNeedsAuth(true)
          setLoading(false)
          return
        }
        
        // Try to fetch real data from Clio
        console.log('Fetching dashboard data from Clio...')
        const dashboardData = await clioService.getDashboardData()
        console.log('Dashboard data received:', dashboardData)
        setData(dashboardData)
        setError(null)
        setNeedsAuth(false)
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err)
        
        // If fetch fails, check if it's auth error
        console.error('Error fetching data:', err)
        
        if (err.response?.status === 401 || err.message?.includes('401')) {
          // Token expired or invalid - need to re-authenticate
          console.log('Token expired, clearing and showing auth')
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
        } else {
          // Other error - show sample data
          setError('Failed to load dashboard data. Using sample data.')
          setData(clioService.getSampleData())
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

  return (
    <>
      {error && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff3cd',
          color: '#856404',
          padding: '12px',
          textAlign: 'center',
          zIndex: 1000,
          borderBottom: '1px solid #ffc107'
        }}>
          {error}
        </div>
      )}
      <Dashboard data={data!} />
    </>
  )
}

export default App
