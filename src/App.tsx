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
        
        // Check if we have a token in localStorage (from OAuth)
        const localToken = localStorage.getItem('clio_access_token')
        
        console.log('Auth check:', {
          hasLocalToken: !!localToken,
          tokenPreview: localToken ? '***' + localToken.slice(-4) : 'none'
        })
        
        if (!localToken) {
          // No token - check if we need OAuth
          const configResponse = await fetch('/api/config')
          const config = await configResponse.json()
          
          console.log('Server config:', config)
          
          if (config.hasAccessToken) {
            // Server has permanent token, frontend doesn't need one
            console.log('Server has permanent access token')
          } else if (config.hasClientId) {
            // Need to authenticate via OAuth
            console.log('Need to authenticate via OAuth')
            setNeedsAuth(true)
            setLoading(false)
            return
          } else {
            // No credentials at all - use sample data
            console.log('No Clio credentials found. Using sample data.')
            setData(clioService.getSampleData())
            setError('No Clio API credentials configured. Using sample data for demonstration.')
            setLoading(false)
            return
          }
        }
        
        // Try to fetch real data
        console.log('Fetching dashboard data from Clio API...')
        const dashboardData = await clioService.getDashboardData()
        console.log('Dashboard data received:', dashboardData)
        setData(dashboardData)
        setError(null)
        setNeedsAuth(false)
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err)
        
        // Check if it's an auth error
        if (err.response?.status === 401) {
          // Token is invalid/expired - need to re-authenticate
          localStorage.removeItem('clio_access_token')
          
          // Check if we can re-auth
          const configResponse = await fetch('/api/config')
          const config = await configResponse.json()
          
          if (config.hasClientId) {
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
