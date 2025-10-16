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
        console.log('Token in localStorage:', token ? 'EXISTS' : 'MISSING')
        
        if (!token) {
          console.log('No token - showing auth button')
          setNeedsAuth(true)
          setLoading(false)
          return
        }
        
        console.log('Token found - fetching dashboard data...')
        const dashboardData = await clioService.getDashboardData()
        console.log('Setting dashboard data to state:', dashboardData)
        setData(dashboardData)
        setLoading(false)
        console.log('Dashboard should now display!')
      } catch (err: any) {
        console.error('Error fetching data:', err)
        if (err.response?.status === 401) {
          console.log('401 error - token invalid')
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
        } else {
          console.error('API Error:', err.response || err.message)
          setError('Error loading data: ' + (err.response?.data?.error || err.message))
        }
        setLoading(false)
      }
    }

    console.log('App mounted - starting fetch')
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
