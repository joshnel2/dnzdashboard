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
      console.log('[App] Starting data fetch...');
      const token = localStorage.getItem('clio_access_token')
      
      console.log('[App] Access token in localStorage:', token ? 'YES' : 'NO');
      
      if (!token) {
        console.log('[App] No token found, showing auth screen');
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      
      try {
        console.log('[App] Fetching dashboard data...');
        const dashboardData = await clioService.getDashboardData()
        console.log('[App] ✓ Dashboard data loaded successfully');
        setData(dashboardData)
        setError(null)
        setLoading(false)
      } catch (err: any) {
        console.error('[App] ✗ Error loading dashboard data:', err);
        
        if (err.response?.status === 401) {
          console.log('[App] 401 Unauthorized - clearing token and showing auth screen');
          localStorage.removeItem('clio_access_token')
          localStorage.removeItem('clio_refresh_token')
          setNeedsAuth(true)
          setLoading(false)
        } else {
          // Show the actual error instead of falling back silently
          const errorMessage = err.response?.data?.message || err.message || 'Unknown error loading data'
          console.error('[App] API Error:', errorMessage, err.response?.data);
          setError(errorMessage)
          // Still show sample data but with error message
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
          backgroundColor: '#ff4444',
          color: 'white',
          padding: '15px 20px',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>⚠️ API Error:</strong> {error} (showing sample data)
          </div>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'transparent',
              border: '1px solid white',
              color: 'white',
              padding: '5px 15px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <Dashboard data={data} />
    </>
  )
}

export default App
