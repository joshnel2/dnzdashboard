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
        
        const token = localStorage.getItem('clio_access_token')
        
        if (!token) {
          setNeedsAuth(true)
          setLoading(false)
          return
        }
        
        const dashboardData = await clioService.getDashboardData()
        setData(dashboardData)
        setLoading(false)
      } catch (err: any) {
        if (err.response?.status === 401) {
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
        } else {
          setError('Error loading data')
        }
        setLoading(false)
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
