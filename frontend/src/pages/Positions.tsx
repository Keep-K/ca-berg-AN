import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../services/api';
import DataTable from '../components/DataTable';
import { FilterBar } from '../components/FilterBar';
import './Positions.css';

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  exchange: string;
}

function Positions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeFilter, setExchangeFilter] = useState('');
  const [marketTypeFilter, setMarketTypeFilter] = useState('');

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPositions = async () => {
    try {
      let snapshot;
      try {
        snapshot = await apiClient.getLatestSnapshot();
      } catch (err: any) {
        if (err.response?.status === 404) {
          snapshot = await apiClient.getPortfolioSnapshot();
        } else throw err;
      }
      setPositions(snapshot?.positions || []);
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = positions;
    if (exchangeFilter) list = list.filter((p) => p.exchange === exchangeFilter);
    if (marketTypeFilter === 'spot') list = []; // positions are futures only
    if (marketTypeFilter === 'futures') list = list; // all positions are futures
    return list;
  }, [positions, exchangeFilter, marketTypeFilter]);

  const columns = [
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: Position) => item.exchange.toUpperCase(),
    },
    {
      key: 'symbol',
      header: 'Symbol',
      render: (item: Position) => <strong>{item.symbol}</strong>,
    },
    {
      key: 'side',
      header: 'Side',
      render: (item: Position) => (
        <span className={item.side === 'long' ? 'text-green' : 'text-red'}>
          {item.side.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (item: Position) => item.size.toFixed(4),
    },
    {
      key: 'entryPrice',
      header: 'Entry Price',
      render: (item: Position) => `$${item.entryPrice.toFixed(2)}`,
    },
    {
      key: 'unrealizedPnl',
      header: 'PnL',
      render: (item: Position) => (
        <span className={item.unrealizedPnl >= 0 ? 'text-green' : 'text-red'}>
          ${item.unrealizedPnl.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'leverage',
      header: 'Leverage',
      render: (item: Position) => `${item.leverage}x`,
    },
  ];

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="positions-page">
      <div className="page-header">
        <h1>Positions</h1>
      </div>
      <FilterBar
        exchange={exchangeFilter}
        onExchangeChange={setExchangeFilter}
        marketType={marketTypeFilter}
        onMarketTypeChange={setMarketTypeFilter}
        showMarketType
      />
      <DataTable columns={columns} data={filtered} emptyMessage="No open positions" />
    </div>
  );
}

export default Positions;
