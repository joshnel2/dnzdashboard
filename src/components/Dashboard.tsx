import MonthlyDepositsBar from './MonthlyDepositsBar'
import AttorneyBillableHours from './AttorneyBillableHours'
import WeeklyRevenue from './WeeklyRevenue'
import YTDTime from './YTDTime'
import YTDRevenue from './YTDRevenue'
import type { DashboardData } from '../types'
import './Dashboard.css'

interface DashboardProps {
  data: DashboardData
}

function Dashboard({ data }: DashboardProps) {
  try {
    if (!data) {
      console.warn('[CLIO][ui] Dashboard rendered with no data')
    } else {
      console.info('[CLIO][ui] Dashboard render', {
        monthlyDeposits: data.monthlyDeposits,
        hours: data.attorneyBillableHours.length,
        weeks: data.weeklyRevenue.length,
        ytdTime: data.ytdTime.length,
        ytdRevenue: data.ytdRevenue.length,
      })
    }
  } catch (_e) {}
  return (
    <div className="dashboard">
      <div className="dashboard-left">
        <MonthlyDepositsBar amount={data.monthlyDeposits} />
      </div>
      <div className="dashboard-right">
        <div className="dashboard-section">
          <AttorneyBillableHours data={data.attorneyBillableHours} />
        </div>
        <div className="dashboard-section">
          <WeeklyRevenue data={data.weeklyRevenue} />
        </div>
        <div className="dashboard-section">
          <YTDTime data={data.ytdTime} />
        </div>
        <div className="dashboard-section">
          <YTDRevenue data={data.ytdRevenue} />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
