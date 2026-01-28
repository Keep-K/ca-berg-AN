import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import DataTable from '../components/DataTable';
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

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPositions = async () => {
    try {
      // Try latest snapshot first, if 404 then fetch new snapshot
      let snapshot;
      try {
        snapshot = await apiClient.getLatestSnapshot();
      } catch (err: any) {
        if (err.response?.status === 404) {
          // No snapshot exists, fetch a new one
          console.log('[Positions] No snapshot found, fetching new snapshot...');
          snapshot = await apiClient.getPortfolioSnapshot();
        } else {
          throw err;
        }
      }
      
      setPositions(snapshot?.positions || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch positions:', err);
      setLoading(false);
    }
  };

  const columns = [
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
      key: 'markPrice',
      header: 'Mark Price',
      render: (item: Position) => `$${item.markPrice.toFixed(2)}`,
    },
    {
      key: 'unrealizedPnl',
      header: 'Unrealized PnL',
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
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: Position) => item.exchange.toUpperCase(),
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
      <DataTable columns={columns} data={positions} emptyMessage="No open positions" />
    </div>
  );
}

export default Positions;
