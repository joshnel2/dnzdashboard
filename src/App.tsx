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
      console.log('=== APP START ===')
      
      try {
        setLoading(true)
        setError(null)
        
        // Check if we have OAuth token in localStorage
        const token = localStorage.getItem('clio_access_token')
        console.log('Token check:', token ? `Found: ${token.substring(0, 10)}...` : 'NOT FOUND')
        
        if (!token) {
          console.log('No token - showing auth button')
          setNeedsAuth(true)
          setLoading(false)
          return
        }
        
        // Fetch real data from Clio
        console.log('Calling clioService.getDashboardData()...')
        const dashboardData = await clioService.getDashboardData()
        console.log('GOT DATA:', JSON.stringify(dashboardData, null, 2))
        
        console.log('Setting data to state...')
        setData(dashboardData)
        setNeedsAuth(false)
        setLoading(false)
        console.log('=== DATA LOADED SUCCESSFULLY ===')
      } catch (err: any) {
        console.error('=== ERROR ===', err)
        
        // If auth error, clear token and show auth button
        if (err.response?.status === 401) {
          console.log('401 error - clearing token')
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
          setLoading(false)
        } else {
          console.error('Other error:', err.message)
          setError('Error: ' + err.message)
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
        No data available
      </div>
    )
  }

  console.log('🎨 Rendering Dashboard with data:', data)
  return <Dashboard data={data} />
}

export default App
