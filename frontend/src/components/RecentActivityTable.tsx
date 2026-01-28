import React from 'react';
import DataTable from './DataTable';

// Mock data - replace with real data from API
const mockActivity = [
  {
    time: '14:32:15',
    exchange: 'Binance',
    symbol: 'BTC/USDT',
    action: 'Buy',
    size: '0.5',
    price: '42,350.00',
  },
  {
    time: '14:28:42',
    exchange: 'Bybit',
    symbol: 'ETH/USDT',
    action: 'Sell',
    size: '2.0',
    price: '2,450.00',
  },
  {
    time: '14:15:08',
    exchange: 'OKX',
    symbol: 'SOL/USDT',
    action: 'Open',
    size: '100',
    price: '98.50',
  },
];

function RecentActivityTable() {
  const columns = [
    { key: 'time', header: 'Time' },
    { key: 'exchange', header: 'Exchange' },
    { key: 'symbol', header: 'Symbol' },
    {
      key: 'action',
      header: 'Action',
      render: (item: any) => (
        <span className={item.action === 'Buy' || item.action === 'Open' ? 'text-green' : 'text-red'}>
          {item.action}
        </span>
      ),
    },
    { key: 'size', header: 'Size' },
    { key: 'price', header: 'Price' },
  ];

  return <DataTable columns={columns} data={mockActivity} emptyMessage="No recent activity" />;
}

export default RecentActivityTable;
