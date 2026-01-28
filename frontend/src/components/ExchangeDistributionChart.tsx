import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ExchangeAllocation } from '../types';

interface ExchangeDistributionChartProps {
  data: ExchangeAllocation[];
}

function ExchangeDistributionChart({ data }: ExchangeDistributionChartProps) {
  const chartData = data.map((item) => ({
    exchange: item.exchange.toUpperCase(),
    value: item.totalUsdValue,
    percentage: item.percentage,
  }));

  if (chartData.length === 0) {
    return (
      <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis
          dataKey="exchange"
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
          formatter={(value: number, name: string, props: any) => [
            `$${value.toLocaleString()} (${props.payload.percentage.toFixed(1)}%)`,
            'Value',
          ]}
        />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default ExchangeDistributionChart;
