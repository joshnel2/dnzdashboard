import { useEffect, useState, useCallback } from 'react'
import Dashboard from './components/Dashboard'
import AuthButton from './components/AuthButton'
import { clioService } from './services/clioService'
import type { DashboardData } from './types'

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('clio_access_token')
    
    if (!token) {
      setNeedsAuth(true)
      setLoading(false)
      return
    }
    
    try {
      // Fetch real data from Clio API
      const dashboardData = await clioService.getDashboardData()
      setData(dashboardData)
      setError(null)
      setLoading(false)
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('clio_access_token')
        setNeedsAuth(true)
        setLoading(false)
      } else {
        console.error('Error fetching dashboard data:', err)
        setError(err.message || 'Failed to fetch dashboard data')
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
        Loading your dashboard...
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
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '20px',
        padding: '20px'
      }}>
        <div style={{ fontSize: '24px', color: '#d32f2f' }}>
          Error Loading Dashboard
        </div>
        <div style={{ fontSize: '16px', color: '#666', maxWidth: '600px', textAlign: 'center' }}>
          {error}
        </div>
        <button
          onClick={() => {
            setError(null)
            setLoading(true)
            fetchData()
          }}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
        <button
          onClick={() => {
            localStorage.removeItem('clio_access_token')
            setNeedsAuth(true)
            setError(null)
          }}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Re-authenticate
        </button>
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
        Loading...
      </div>
    )
  }

  return <Dashboard data={data} />
}

export default App
