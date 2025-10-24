import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import AuthButton from './components/AuthButton'
import { clioService } from './services/clioService'
import type { DashboardData } from './types'

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      console.log('🚀 [App] Starting data fetch...')
      const token = localStorage.getItem('clio_access_token')
      
      console.log('🔑 [App] Token status:', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 10)}...` : 'none'
      })
      
      if (!token) {
        console.warn('⚠️  [App] No token found, needs authentication')
        setNeedsAuth(true)
        setLoading(false)
        return
      }
      
      try {
        console.log('📡 [App] Fetching dashboard data from Clio...')
        const dashboardData = await clioService.getDashboardData()
        
        console.log('✅ [App] Dashboard data received:', {
          hasData: !!dashboardData,
          monthlyDeposits: dashboardData.monthlyDeposits,
          attorneyCount: dashboardData.attorneyBillableHours?.length || 0,
          weeklyRevenuePoints: dashboardData.weeklyRevenue?.length || 0,
          ytdTimePoints: dashboardData.ytdTime?.length || 0,
          ytdRevenuePoints: dashboardData.ytdRevenue?.length || 0
        })
        
        setData(dashboardData)
        setLoading(false)
        
        console.log('🎉 [App] Dashboard rendered successfully')
      } catch (err: any) {
        console.error('❌ [App] Error fetching dashboard data:', {
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          data: err.response?.data,
          stack: err.stack
        })
        
        if (err.response?.status === 401) {
          console.warn('🔒 [App] Unauthorized - removing token and requesting re-auth')
          localStorage.removeItem('clio_access_token')
          setNeedsAuth(true)
          setLoading(false)
        } else {
          console.warn('⚠️  [App] API error - falling back to sample data')
          // Just use sample data if API fails
          const sampleData = clioService.getSampleData()
          console.log('📊 [App] Using sample data:', sampleData)
          setData(sampleData)
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

  return <Dashboard data={data} />
}

export default App
