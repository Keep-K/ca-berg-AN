import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../services/api';
import DataTable from '../components/DataTable';
import { FilterBar, HideSmallBalances } from '../components/FilterBar';
import './Portfolio.css';

const SMALL_BALANCE_THRESHOLD = 10;

interface Balance {
  asset: string;
  total: number;
  available: number;
  usdValue: number;
  exchange: string;
  accountType?: 'spot' | 'futures';
}

/** Grouped row: one asset, aggregated or expanded per-exchange */
interface AssetRow {
  asset: string;
  totalBalance: number;
  usdValue: number;
  exchange: string;
  type: 'Spot' | 'Futures';
  isAggregate: boolean;
  expandable?: boolean;
  showCollapse?: boolean;
  children?: Balance[];
}

function Portfolio() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeFilter, setExchangeFilter] = useState('');
  const [hideSmall, setHideSmall] = useState(true);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPortfolio = async () => {
    try {
      let snapshot;
      try {
        snapshot = await apiClient.getLatestSnapshot();
      } catch (err: any) {
        if (err.response?.status === 404) {
          snapshot = await apiClient.getPortfolioSnapshot();
        } else throw err;
      }
      setBalances(snapshot?.balances || []);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBalances = useMemo(() => {
    let list = balances;
    if (exchangeFilter) list = list.filter((b) => b.exchange === exchangeFilter);
    if (hideSmall) list = list.filter((b) => b.usdValue >= SMALL_BALANCE_THRESHOLD);
    return list;
  }, [balances, exchangeFilter, hideSmall]);

  const tableRows = useMemo((): AssetRow[] => {
    const byAsset = new Map<string, Balance[]>();
    filteredBalances.forEach((b) => {
      const key = `${b.asset}:${b.accountType || 'spot'}`;
      if (!byAsset.has(key)) byAsset.set(key, []);
      byAsset.get(key)!.push(b);
    });
    const rows: AssetRow[] = [];
    byAsset.forEach((items, key) => {
      const [asset, typeRaw] = key.split(':');
      const type = typeRaw === 'futures' ? 'Futures' : 'Spot';
      const totalBalance = items.reduce((s, i) => s + i.total, 0);
      const usdValue = items.reduce((s, i) => s + i.usdValue, 0);
      const isMulti = items.length > 1;
      const expanded = expandedAssets.has(asset);
      if (isMulti && !expanded) {
        rows.push({
          asset,
          totalBalance,
          usdValue,
          exchange: '—',
          type,
          isAggregate: true,
          expandable: true,
          children: items,
        });
      } else if (isMulti && expanded) {
        items.forEach((b, i) =>
          rows.push({
            asset: b.asset,
            totalBalance: b.total,
            usdValue: b.usdValue,
            exchange: b.exchange,
            type,
            isAggregate: false,
            expandable: true,
            showCollapse: i === 0,
          })
        );
      } else {
        rows.push({
          asset: items[0].asset,
          totalBalance: items[0].total,
          usdValue: items[0].usdValue,
          exchange: items[0].exchange,
          type,
          isAggregate: false,
        });
      }
    });
    return rows.sort((a, b) => b.usdValue - a.usdValue);
  }, [filteredBalances, expandedAssets]);

  const toggleExpand = (asset: string) => {
    setExpandedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(asset)) next.delete(asset);
      else next.add(asset);
      return next;
    });
  };

  const columns = [
    {
      key: 'asset',
      header: 'Asset',
      render: (item: AssetRow) => (
        <span className="portfolio-asset">
          {item.expandable && item.isAggregate ? (
            <button
              type="button"
              className="expand-btn"
              onClick={() => toggleExpand(item.asset)}
              title="Expand"
            >
              ▶
            </button>
          ) : item.expandable && item.showCollapse ? (
            <button
              type="button"
              className="expand-btn expanded"
              onClick={() => toggleExpand(item.asset)}
              title="Collapse"
            >
              ▼
            </button>
          ) : item.expandable ? (
            <span className="expand-btn-placeholder" />
          ) : null}
          <strong>{item.asset}</strong>
        </span>
      ),
    },
    {
      key: 'totalBalance',
      header: 'Total Balance',
      render: (item: AssetRow) => item.totalBalance.toFixed(4),
    },
    {
      key: 'usdValue',
      header: 'USD Value',
      render: (item: AssetRow) => `$${item.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: AssetRow) => item.exchange === '—' ? '—' : item.exchange.toUpperCase(),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: AssetRow) => item.type,
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
      <div className="portfolio-filters">
        <FilterBar exchange={exchangeFilter} onExchangeChange={setExchangeFilter} />
        <HideSmallBalances checked={hideSmall} onChange={setHideSmall} threshold={SMALL_BALANCE_THRESHOLD} />
      </div>
      <DataTable columns={columns} data={tableRows} emptyMessage="No balances found" />
    </div>
  );
}

export default Portfolio;
