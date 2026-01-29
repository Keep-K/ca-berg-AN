import { useEffect, useState, useMemo } from 'react';
import DataTable from '../components/DataTable';
import { FilterBar } from '../components/FilterBar';
import { apiClient } from '../services/api';
import './Orders.css';

interface Order {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  status: string;
  price: number;
  quantity: number;
  timestamp: number;
  exchange: string;
  market?: 'spot' | 'futures';
}

function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeFilter, setExchangeFilter] = useState('');
  const [marketTypeFilter, setMarketTypeFilter] = useState('');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await apiClient.getOrderHistory({ limit: 100 });
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = orders;
    if (exchangeFilter) list = list.filter((o) => o.exchange === exchangeFilter);
    if (marketTypeFilter && list.some((o) => (o as Order).market)) {
      list = list.filter((o) => (o as Order).market === marketTypeFilter);
    }
    return list;
  }, [orders, exchangeFilter, marketTypeFilter]);

  const columns = [
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: Order) => (item.exchange || '—').toUpperCase(),
    },
    {
      key: 'symbol',
      header: 'Symbol',
      render: (item: Order) => <strong>{item.symbol}</strong>,
    },
    {
      key: 'side',
      header: 'Side',
      render: (item: Order) => (
        <span className={item.side === 'buy' ? 'text-green' : 'text-red'}>
          {item.side.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: Order) => (item.type || '—').toUpperCase(),
    },
    {
      key: 'price',
      header: 'Price',
      render: (item: Order) => (item.price ? `$${item.price.toFixed(2)}` : '—'),
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (item: Order) => item.quantity.toFixed(4),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Order) => (
        <span className={`order-status order-status-${(item.status || '').toLowerCase()}`}>
          {item.status || '—'}
        </span>
      ),
    },
    {
      key: 'timestamp',
      header: 'Time',
      render: (item: Order) =>
        item.timestamp ? new Date(item.timestamp).toLocaleString() : '—',
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
    <div className="orders-page">
      <div className="page-header">
        <h1>Order History</h1>
      </div>
      <FilterBar
        exchange={exchangeFilter}
        onExchangeChange={setExchangeFilter}
        marketType={marketTypeFilter}
        onMarketTypeChange={setMarketTypeFilter}
        showMarketType
      />
      <DataTable columns={columns} data={filtered} emptyMessage="No orders found" />
    </div>
  );
}

export default Orders;
