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
        setError(null)
        
        // Check if we have OAuth token in localStorage
        const token = localStorage.getItem('clio_access_token')
        console.log('🔍 Checking for token:', token ? '✅ Token found: ***' + token.slice(-4) : '❌ No token')
        
        if (!token) {
          console.log('⚠️ No token found - showing auth button')
          setNeedsAuth(true)
          setLoading(false)
          return
        }
        
        // Fetch real data from Clio
        console.log('📡 Fetching data from Clio API...')
        const dashboardData = await clioService.getDashboardData()
        console.log('✅ Data received from Clio:', dashboardData)
        
        setData(dashboardData)
        setNeedsAuth(false)
        console.log('🎉 Dashboard data loaded successfully!')
      } catch (err: any) {
        console.error('❌ Error fetching dashboard data:', err)
        console.error('Error details:', {
          message: err.message,
          response: err.response,
          status: err.response?.status
        })
        
        // If auth error, clear token and show auth button
        if (err.response?.status === 401) {
          console.log('🔒 401 Unauthorized - clearing token')
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
        } else {
          setError('Failed to load data from Clio API: ' + err.message)
        }
      } finally {
        setLoading(false)
      }
    }

    console.log('🚀 App mounted - starting data fetch')
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
