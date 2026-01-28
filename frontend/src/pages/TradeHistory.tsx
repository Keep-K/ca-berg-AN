import React, { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import './TradeHistory.css';

interface UnifiedTrade {
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  realizedPnl: number;
  fee: number;
  timestamp: number;
  exchange: string;
  tradeId: string;
}

function TradeHistory() {
  const [trades, setTrades] = useState<UnifiedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    exchange: '',
    symbol: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      const response = await fetch('/api/trade/trades?limit=100');
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      
      if (!response.ok) {
        console.error('Failed to fetch trades:', data.error || 'Unknown error');
        setTrades([]);
        setLoading(false);
        return;
      }
      
      setTrades(data.trades || []);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch trades:', err);
      setTrades([]);
      setLoading(false);
    }
  };

  const filteredTrades = trades.filter((trade) => {
    if (filters.exchange && trade.exchange !== filters.exchange) return false;
    if (filters.symbol && !trade.symbol.includes(filters.symbol.toUpperCase())) return false;
    if (filters.startDate && trade.timestamp < new Date(filters.startDate).getTime()) return false;
    if (filters.endDate && trade.timestamp > new Date(filters.endDate).getTime()) return false;
    return true;
  });

  const columns = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (item: UnifiedTrade) =>
        new Date(item.timestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: UnifiedTrade) => (
        <span style={{ textTransform: 'uppercase', fontSize: '11px' }}>{item.exchange}</span>
      ),
    },
    {
      key: 'symbol',
      header: 'Symbol',
      render: (item: UnifiedTrade) => (
        <span style={{ fontWeight: 500 }}>{item.symbol}</span>
      ),
    },
    {
      key: 'side',
      header: 'Side',
      render: (item: UnifiedTrade) => (
        <span className={item.side === 'buy' ? 'text-green' : 'text-red'}>
          {item.side.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (item: UnifiedTrade) => `$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (item: UnifiedTrade) => item.quantity.toFixed(4),
    },
    {
      key: 'realizedPnl',
      header: 'Realized PnL',
      render: (item: UnifiedTrade) => (
        <span className={item.realizedPnl >= 0 ? 'text-green' : 'text-red'}>
          ${item.realizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'fee',
      header: 'Fee',
      render: (item: UnifiedTrade) => `$${item.fee.toFixed(2)}`,
    },
  ];

  return (
    <div className="trade-history-page">
      <div className="page-header">
        <h1>Trade History</h1>
      </div>
      <div className="filters">
        <input
          type="text"
          placeholder="Filter by exchange..."
          value={filters.exchange}
          onChange={(e) => setFilters({ ...filters, exchange: e.target.value })}
          className="filter-input"
        />
        <input
          type="text"
          placeholder="Filter by symbol..."
          value={filters.symbol}
          onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}
          className="filter-input"
        />
        <input
          type="date"
          placeholder="Start date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          className="filter-input"
        />
        <input
          type="date"
          placeholder="End date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          className="filter-input"
        />
      </div>
      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <DataTable columns={columns} data={filteredTrades} emptyMessage="No trades found" />
      )}
    </div>
  );
}

export default TradeHistory;
