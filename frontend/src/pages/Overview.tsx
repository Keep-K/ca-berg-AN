import React, { useMemo, useState } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import StatCard from '../components/StatCard';
import AssetAllocationChart from '../components/AssetAllocationChart';
import ExchangeAllocationPie from '../components/ExchangeAllocationPie';
import RecentActivityTable from '../components/RecentActivityTable';
import type { PortfolioSnapshot, AssetAllocation, ExchangeAllocation } from '../types';
import './Overview.css';

export type OverviewTab = 'all' | 'spot' | 'futures';

function computeFilteredSnapshot(
  snapshot: PortfolioSnapshot,
  tab: OverviewTab
): {
  totalNetEquity: number;
  totalUnrealizedPnl: number;
  change24h: number | undefined;
  assetAllocation: AssetAllocation[];
  exchangeAllocation: ExchangeAllocation[];
  exchangeCount: number;
} {
  const { balances, positions, change24h } = snapshot;

  if (tab === 'spot') {
    const totalNetEquity = balances.reduce((s, b) => s + b.usdValue, 0);
    const byExchange = new Map<string, number>();
    const byAsset = new Map<string, { usd: number; byEx: Map<string, number> }>();
    balances.forEach((b) => {
      if (b.usdValue <= 0) return;
      byExchange.set(b.exchange, (byExchange.get(b.exchange) ?? 0) + b.usdValue);
      const cur = byAsset.get(b.asset);
      if (cur) {
        cur.usd += b.usdValue;
        cur.byEx.set(b.exchange, (cur.byEx.get(b.exchange) ?? 0) + b.usdValue);
      } else {
        const byEx = new Map<string, number>();
        byEx.set(b.exchange, b.usdValue);
        byAsset.set(b.asset, { usd: b.usdValue, byEx });
      }
    });
    const totalUsd = totalNetEquity || 1;
    const exchangeAllocation: ExchangeAllocation[] = Array.from(byExchange.entries())
      .map(([exchange, totalUsdValue]) => ({
        exchange,
        totalUsdValue,
        percentage: (totalUsdValue / totalUsd) * 100,
      }))
      .sort((a, b) => b.totalUsdValue - a.totalUsdValue);
    const assetAllocation: AssetAllocation[] = Array.from(byAsset.entries())
      .map(([asset, data]) => ({
        asset,
        totalUsdValue: data.usd,
        percentage: (data.usd / totalUsd) * 100,
        exchanges: Array.from(data.byEx.entries()).map(([exchange, usdValue]) => ({ exchange, usdValue })),
      }))
      .sort((a, b) => b.totalUsdValue - a.totalUsdValue);
    return {
      totalNetEquity,
      totalUnrealizedPnl: 0,
      change24h,
      assetAllocation,
      exchangeAllocation,
      exchangeCount: exchangeAllocation.length,
    };
  }

  if (tab === 'futures') {
    const totalUnrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
    const totalNotional = positions.reduce((s, p) => s + p.size * p.markPrice, 0);
    const totalNetEquity = totalNotional + totalUnrealizedPnl;
    const byExchange = new Map<string, number>();
    const byAsset = new Map<string, { usd: number; byEx: Map<string, number> }>();
    positions.forEach((p) => {
      const notional = p.size * p.markPrice;
      byExchange.set(p.exchange, (byExchange.get(p.exchange) ?? 0) + notional);
      const base = p.symbol.replace(/USDT|BUSD|USD$/i, '') || p.symbol;
      const cur = byAsset.get(base);
      if (cur) {
        cur.usd += notional;
        cur.byEx.set(p.exchange, (cur.byEx.get(p.exchange) ?? 0) + notional);
      } else {
        const byEx = new Map<string, number>();
        byEx.set(p.exchange, notional);
        byAsset.set(base, { usd: notional, byEx });
      }
    });
    const totalUsd = totalNotional || 1;
    const exchangeAllocation: ExchangeAllocation[] = Array.from(byExchange.entries())
      .map(([exchange, totalUsdValue]) => ({
        exchange,
        totalUsdValue,
        percentage: (totalUsdValue / totalUsd) * 100,
      }))
      .sort((a, b) => b.totalUsdValue - a.totalUsdValue);
    const assetAllocation: AssetAllocation[] = Array.from(byAsset.entries())
      .map(([asset, data]) => ({
        asset,
        totalUsdValue: data.usd,
        percentage: (data.usd / totalUsd) * 100,
        exchanges: Array.from(data.byEx.entries()).map(([exchange, usdValue]) => ({ exchange, usdValue })),
      }))
      .sort((a, b) => b.totalUsdValue - a.totalUsdValue);
    return {
      totalNetEquity,
      totalUnrealizedPnl,
      change24h,
      assetAllocation,
      exchangeAllocation,
      exchangeCount: exchangeAllocation.length,
    };
  }

  return {
    totalNetEquity: snapshot.totalNetEquity ?? 0,
    totalUnrealizedPnl: snapshot.totalUnrealizedPnl ?? 0,
    change24h: snapshot.change24h,
    assetAllocation: snapshot.assetAllocation ?? [],
    exchangeAllocation: snapshot.exchangeAllocation ?? [],
    exchangeCount: snapshot.exchangeAllocation?.length ?? 0,
  };
}

function Overview() {
  const { snapshot, loading } = usePortfolio();
  const [tab, setTab] = useState<OverviewTab>('all');

  const filtered = useMemo(() => {
    if (!snapshot) return null;
    return computeFilteredSnapshot(snapshot, tab);
  }, [snapshot, tab]);

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

  const totalEquity = filtered?.totalNetEquity ?? 0;
  const totalPnl = filtered?.totalUnrealizedPnl ?? 0;
  const change24h = filtered?.change24h ?? 0;
  const exchangeCount = filtered?.exchangeCount ?? 0;
  const assetAllocation = filtered?.assetAllocation ?? [];
  const exchangeAllocation = filtered?.exchangeAllocation ?? [];

  return (
    <div className="overview-page">
      <div className="page-header overview-header">
        <h1>Overview</h1>
        <div className="overview-tabs">
          <button
            type="button"
            className={`overview-tab ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            ALL
          </button>
          <button
            type="button"
            className={`overview-tab ${tab === 'spot' ? 'active' : ''}`}
            onClick={() => setTab('spot')}
          >
            SPOT
          </button>
          <button
            type="button"
            className={`overview-tab ${tab === 'futures' ? 'active' : ''}`}
            onClick={() => setTab('futures')}
          >
            FUTURES
          </button>
        </div>
      </div>

      <div className="overview-cards">
        <StatCard
          title="Total Net Equity"
          value={`$${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={change24h}
        />
        <StatCard
          title="Unrealized PnL"
          value={`$${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard
          title="24h Change"
          value={`${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`}
          change={change24h}
        />
        <StatCard title="Exchanges" value={exchangeCount} />
      </div>

      <div className="overview-charts">
        <div className="chart-panel">
          <div className="chart-header">
            <h3>Exchange Allocation</h3>
          </div>
          <ExchangeAllocationPie data={exchangeAllocation} />
        </div>
        <div className="chart-panel">
          <div className="chart-header">
            <h3>Asset Allocation</h3>
          </div>
          <AssetAllocationChart data={assetAllocation} />
        </div>
      </div>

      <div className="overview-section">
        <h3 className="section-title">Recent Activity</h3>
        <RecentActivityTable />
      </div>
    </div>
  );
}

export default Overview;
