import React from 'react';
import './StatCard.css';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: string;
}

function StatCard({ title, value, change, icon }: StatCardProps) {
  const changeClass = change !== undefined 
    ? (change >= 0 ? 'positive' : 'negative')
    : '';

  return (
    <div className="stat-card">
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-content">
        <div className="stat-title">{title}</div>
        <div className="stat-value">{value}</div>
        {change !== undefined && (
          <div className={`stat-change ${changeClass}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
