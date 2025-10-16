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
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      
      try {
        const dashboardData = await clioService.getDashboardData()
        console.log('Fetched Clio data:', dashboardData)
        setData(dashboardData)
        setLoading(false)
      } catch (err: any) {
        if (err.response?.status === 401) {
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
          setLoading(false)
        } else {
          // Log the actual error for debugging
          console.error('Error fetching Clio data:', err)
          console.error('Error response:', err.response?.data)
          console.error('Error status:', err.response?.status)
          
          // Set error state instead of showing fake data
          setError(`Failed to fetch Clio data: ${err.message}`)
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
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#d32f2f',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div>{error}</div>
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          Check the browser console for more details.
        </div>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Retry
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
