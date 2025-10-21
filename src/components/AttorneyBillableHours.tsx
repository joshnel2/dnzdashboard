import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { AttorneyBillableHours as AttorneyData } from '../types'
import { useEffect } from 'react'
import './ChartSection.css'

interface AttorneyBillableHoursProps {
  data: AttorneyData[]
}

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140']

function AttorneyBillableHours({ data }: AttorneyBillableHoursProps) {
  useEffect(() => {
    console.log('[UI] AttorneyBillableHours data', { count: data?.length || 0, sample: data?.slice(0, 3) })
  }, [data])
  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2 className="chart-title">Attorney Billable Hours</h2>
        <p className="chart-subtitle">Current month performance</p>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fill: '#666', fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fill: '#666' } }}
              tick={{ fill: '#666' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
            <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
              {data.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default AttorneyBillableHours
