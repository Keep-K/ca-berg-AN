import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { AssetAllocation } from '../types';

interface AssetAllocationChartProps {
  data: AssetAllocation[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function AssetAllocationChart({ data }: AssetAllocationChartProps) {
  const chartData = data.slice(0, 7).map((item) => ({
    name: item.asset,
    value: item.totalUsdValue,
    percentage: item.percentage,
  }));

  if (chartData.length === 0) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1a1d29',
            border: '1px solid #2a2d3a',
            borderRadius: '4px',
            color: '#e4e7eb',
          }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default AssetAllocationChart;
