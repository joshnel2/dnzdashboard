import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { WeeklyRevenue as WeeklyData } from "../types";
import "./ChartSection.css";

interface WeeklyRevenueProps {
  data: WeeklyData[];
}

function WeeklyRevenue({ data }: WeeklyRevenueProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2 className="chart-title">Weekly Revenue</h2>
        <p className="chart-subtitle">Last 12 weeks</p>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week" tick={{ fill: "#666", fontSize: 12 }} />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fill: "#666", fontSize: 12 }}
              width={80}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <Bar
              dataKey="amount"
              fill="#43e97b"
              radius={[8, 8, 0, 0]}
              minPointSize={6}
            >
              <LabelList
                dataKey="amount"
                position="top"
                formatter={(value: number) => formatCurrency(value)}
                fill="#2f855a"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default WeeklyRevenue;
