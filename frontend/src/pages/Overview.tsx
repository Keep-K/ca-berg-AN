import React from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import StatCard from '../components/StatCard';
import PortfolioChart from '../components/PortfolioChart';
import AssetAllocationChart from '../components/AssetAllocationChart';
import ExchangeDistributionChart from '../components/ExchangeDistributionChart';
import RecentActivityTable from '../components/RecentActivityTable';
import './Overview.css';

function Overview() {
  const { snapshot, loading } = usePortfolio();

  if (loading && !snapshot) {
    return (
      <div className="page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="page">
        <div className="empty-state">No portfolio data available</div>
      </div>
    );
  }

  const totalEquity = snapshot.totalNetEquity || 0;
  const totalPnl = snapshot.totalUnrealizedPnl || 0;
  const change24h = snapshot.change24h || 0;
  const exchangeCount = snapshot.exchangeAllocation?.length || 0;

  return (
    <div className="overview-page">
      <div className="page-header">
        <h1>Overview</h1>
      </div>

      {/* Section A: Portfolio Summary Cards */}
      <div className="overview-cards">
        <StatCard
          title="Total Net Equity"
          value={`$${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={change24h}
          icon="💰"
        />
        <StatCard
          title="Total Unrealized PnL"
          value={`$${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon="📈"
        />
        <StatCard
          title="24h Portfolio Change"
          value={`${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`}
          icon="📊"
        />
        <StatCard
          title="Connected Exchanges"
          value={exchangeCount}
          icon="🔌"
        />
      </div>

      {/* Section B: Charts Row */}
      <div className="overview-charts">
        <div className="chart-panel">
          <div className="chart-header">
            <h3>Portfolio Value</h3>
            <div className="chart-controls">
              <button className="chart-btn active">1D</button>
              <button className="chart-btn">7D</button>
              <button className="chart-btn">30D</button>
            </div>
          </div>
          <PortfolioChart />
        </div>
        <div className="chart-panel">
          <div className="chart-header">
            <h3>Asset Allocation</h3>
          </div>
          <AssetAllocationChart data={snapshot.assetAllocation || []} />
        </div>
      </div>

      {/* Section C: Exchange Distribution */}
      <div className="overview-section">
        <h3 className="section-title">Exchange Distribution</h3>
        <ExchangeDistributionChart data={snapshot.exchangeAllocation || []} />
      </div>

      {/* Section D: Recent Activity */}
      <div className="overview-section">
        <h3 className="section-title">Recent Activity</h3>
        <RecentActivityTable />
      </div>
    </div>
  );
}

export default Overview;
