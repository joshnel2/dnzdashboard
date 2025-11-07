import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import AuthButton from './components/AuthButton'
import { clioService } from './services/clioService'
import type { DashboardData } from './types'

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('clio_access_token')
      
      if (!token) {
        console.log('No auth token found, showing auth button')
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      
      console.log('🚀 Starting dashboard data fetch...')
      
      try {
        const dashboardData = await clioService.getDashboardData()
        console.log('✅ Dashboard data loaded successfully:', dashboardData)
        setData(dashboardData)
        setError(null)
        setLoading(false)
      } catch (err: any) {
        console.error('❌ Error loading dashboard data:', err)
        
        if (err.response?.status === 401) {
          console.log('Authentication failed, clearing token')
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
          setLoading(false)
        } else {
          // Show error but use sample data as fallback
          const errorMsg = err.response?.data?.error || err.message || 'Failed to load data from Clio'
          console.warn('⚠️  Using sample data as fallback due to error:', errorMsg)
          setError(errorMsg)
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
          padding: '12px 20px',
          borderBottom: '1px solid #ffeeba',
          zIndex: 1000,
          textAlign: 'center',
        }}>
          ⚠️ Using sample data: {error}. Check console for details.
        </div>
      )}
      <Dashboard data={data} />
    </>
  )
}

export default App
