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
        
        // Check if we have credentials
        const hasApiKey = import.meta.env.VITE_CLIO_API_KEY || localStorage.getItem('clio_access_token')
        const hasClientId = import.meta.env.VITE_CLIO_CLIENT_ID
        
        if (!hasApiKey && !hasClientId) {
          // No credentials at all - use sample data
          console.log('No Clio credentials found. Using sample data.')
          setData(clioService.getSampleData())
          setError('No Clio API credentials configured. Using sample data for demonstration.')
          setLoading(false)
          return
        }
        
        if (!hasApiKey && hasClientId) {
          // Has Client ID but no token yet - need to authenticate
          setNeedsAuth(true)
          setLoading(false)
          return
        }
        
        // Try to fetch real data
        const dashboardData = await clioService.getDashboardData()
        setData(dashboardData)
        setError(null)
        setNeedsAuth(false)
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err)
        
        // Check if it's an auth error
        if (err.response?.status === 401) {
          // Token is invalid/expired - need to re-authenticate
          if (import.meta.env.VITE_CLIO_CLIENT_ID) {
            localStorage.removeItem('clio_access_token')
            setNeedsAuth(true)
          } else {
            setError('Invalid or expired Clio API token. Using sample data.')
            setData(clioService.getSampleData())
          }
        } else {
          setError('Failed to load dashboard data. Using sample data for demonstration.')
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
