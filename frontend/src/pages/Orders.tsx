import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import DataTable from '../components/DataTable';
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
}

function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/trade/history?limit=100');
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      
      if (!response.ok) {
        console.error('Failed to fetch orders:', data.error || 'Unknown error');
        setOrders([]);
        setLoading(false);
        return;
      }
      
      setOrders(data.orders || []);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      setOrders([]);
      setLoading(false);
    }
  };

  const columns = [
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
      render: (item: Order) => item.type.toUpperCase(),
    },
    {
      key: 'price',
      header: 'Price',
      render: (item: Order) => `$${item.price.toFixed(2)}`,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (item: Order) => item.quantity.toFixed(4),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Order) => (
        <span className={`order-status order-status-${item.status.toLowerCase()}`}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'timestamp',
      header: 'Time',
      render: (item: Order) => new Date(item.timestamp).toLocaleString(),
    },
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: Order) => item.exchange.toUpperCase(),
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
      <DataTable columns={columns} data={orders} emptyMessage="No orders found" />
    </div>
  );
}

export default Orders;
