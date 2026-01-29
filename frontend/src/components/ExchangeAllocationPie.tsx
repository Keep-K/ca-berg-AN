import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ExchangeAllocation } from '../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

interface ExchangeAllocationPieProps {
  data: ExchangeAllocation[];
}

function ExchangeAllocationPie({ data }: ExchangeAllocationPieProps) {
  const chartData = data.map((item) => ({
    name: item.exchange.toUpperCase(),
    value: item.totalUsdValue,
    percentage: item.percentage,
  }));

  if (chartData.length === 0) {
    return (
      <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '13px' }}>
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1a1d29',
            border: '1px solid #2a2d3a',
            borderRadius: '4px',
            color: '#e4e7eb',
            fontSize: '12px',
          }}
          formatter={(value: number, name: string, props: any) => [
            `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${(props.payload.percentage ?? 0).toFixed(1)}%)`,
            name,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default ExchangeAllocationPie;
