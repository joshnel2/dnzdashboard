import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { YTDTimeEntry } from '../types'
import './ChartSection.css'

interface YTDTimeProps {
  data: YTDTimeEntry[]
}

function YTDTime({ data }: YTDTimeProps) {
  console.log('📊 [YTDTime] Rendering with data:', {
    dataLength: data?.length || 0,
    data: data
  })
  
  const formatMonth = (dateStr: string) => {
    const [year, month] = dateStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short' })
  }

  const formattedData = data.map(entry => ({
    ...entry,
    monthLabel: formatMonth(entry.date),
  }))

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2 className="chart-title">YTD Time Tracking</h2>
        <p className="chart-subtitle">Total billable hours by month</p>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="monthLabel"
              tick={{ fill: '#666', fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fill: '#666' } }}
              tick={{ fill: '#666', fontSize: 12 }}
            />
            <Tooltip
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return `${payload[0].payload.monthLabel} ${payload[0].payload.date.split('-')[0]}`
                }
                return label
              }}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
            <Bar
              dataKey="hours"
              fill="#4facfe"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default YTDTime
