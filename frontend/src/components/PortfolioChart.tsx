import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data - replace with real data from API
const mockData = [
  { time: '00:00', value: 100000 },
  { time: '04:00', value: 102500 },
  { time: '08:00', value: 101200 },
  { time: '12:00', value: 103800 },
  { time: '16:00', value: 104500 },
  { time: '20:00', value: 105200 },
];

function PortfolioChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={mockData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis
          dataKey="time"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1a1d29',
            border: '1px solid #2a2d3a',
            borderRadius: '4px',
            color: '#e4e7eb',
          }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default PortfolioChart;
