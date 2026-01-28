import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import DataTable from '../components/DataTable';
import './Portfolio.css';

interface Balance {
  asset: string;
  total: number;
  available: number;
  usdValue: number;
  exchange: string;
}

function Portfolio() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPortfolio = async () => {
    try {
      // Try latest snapshot first, if 404 then fetch new snapshot
      let snapshot;
      try {
        snapshot = await apiClient.getLatestSnapshot();
      } catch (err: any) {
        if (err.response?.status === 404) {
          // No snapshot exists, fetch a new one
          console.log('[Portfolio] No snapshot found, fetching new snapshot...');
          snapshot = await apiClient.getPortfolioSnapshot();
        } else {
          throw err;
        }
      }
      
      setBalances(snapshot?.balances || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
      setLoading(false);
    }
  };

  const columns = [
    {
      key: 'asset',
      header: 'Asset',
      render: (item: Balance) => <strong>{item.asset}</strong>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (item: Balance) => item.total.toFixed(4),
    },
    {
      key: 'available',
      header: 'Available',
      render: (item: Balance) => item.available.toFixed(4),
    },
    {
      key: 'usdValue',
      header: 'USD Value',
      render: (item: Balance) => `$${item.usdValue.toFixed(2)}`,
    },
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: Balance) => item.exchange.toUpperCase(),
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
    <div className="portfolio-page">
      <div className="page-header">
        <h1>Portfolio</h1>
      </div>
      <DataTable columns={columns} data={balances} emptyMessage="No balances found" />
    </div>
  );
}

export default Portfolio;
