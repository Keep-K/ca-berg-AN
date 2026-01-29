import { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import { FilterBar } from '../components/FilterBar';
import { apiClient } from '../services/api';
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
  const [exchangeFilter, setExchangeFilter] = useState('');
  const [marketTypeFilter, setMarketTypeFilter] = useState('');

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      const data = await apiClient.getTradeHistory({ limit: 100 });
      setTrades(data.trades || []);
    } catch (err: any) {
      console.error('Failed to fetch trades:', err);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = trades;
    if (exchangeFilter) list = list.filter((t) => t.exchange === exchangeFilter);
    return list;
  }, [trades, exchangeFilter]);

  const columns = [
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: UnifiedTrade) => (
        <span style={{ textTransform: 'uppercase', fontSize: '12px' }}>{item.exchange}</span>
      ),
    },
    {
      key: 'symbol',
      header: 'Symbol',
      render: (item: UnifiedTrade) => <strong>{item.symbol}</strong>,
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
      render: (item: UnifiedTrade) =>
        `$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (item: UnifiedTrade) => item.quantity.toFixed(4),
    },
    {
      key: 'fee',
      header: 'Fee',
      render: (item: UnifiedTrade) => `$${(item.fee ?? 0).toFixed(2)}`,
    },
    {
      key: 'realizedPnl',
      header: 'Realized PnL',
      render: (item: UnifiedTrade) => (
        <span className={(item.realizedPnl ?? 0) >= 0 ? 'text-green' : 'text-red'}>
          ${(item.realizedPnl ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'timestamp',
      header: 'Time',
      render: (item: UnifiedTrade) =>
        item.timestamp
          ? new Date(item.timestamp).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
    },
  ];

  return (
    <div className="trade-history-page">
      <div className="page-header">
        <h1>Trade History</h1>
      </div>
      <FilterBar
        exchange={exchangeFilter}
        onExchangeChange={setExchangeFilter}
        marketType={marketTypeFilter}
        onMarketTypeChange={setMarketTypeFilter}
        showMarketType
      />
      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="No trades found" />
      )}
    </div>
  );
}

export default TradeHistory;
