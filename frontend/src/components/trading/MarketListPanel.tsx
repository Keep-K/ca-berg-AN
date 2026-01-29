import { useMemo } from 'react';

interface MarketRow {
  symbol: string;
  last: number;
  change: number;
}

const MOCK_MARKETS: MarketRow[] = [
  { symbol: 'BTC/USDT', last: 87950.8, change: -1.52 },
  { symbol: 'ETH/USDT', last: 2948.1, change: -1.49 },
  { symbol: 'BNB/USDT', last: 904.7, change: 0.12 },
  { symbol: 'SOL/USDT', last: 196.4, change: -0.84 },
  { symbol: 'XRP/USDT', last: 0.5123, change: -2.17 },
  { symbol: 'DOGE/USDT', last: 0.0781, change: -3.09 },
  { symbol: 'ADA/USDT', last: 0.5144, change: -2.41 },
  { symbol: 'AVAX/USDT', last: 37.4, change: -1.22 },
  { symbol: 'MATIC/USDT', last: 0.825, change: -0.88 },
  { symbol: 'LINK/USDT', last: 18.2, change: 0.64 },
];

export default function MarketListPanel() {
  const rows = useMemo(() => MOCK_MARKETS, []);

  return (
    <div className="panel marketlist-panel">
      <div className="panel-header">
        <h3>Markets</h3>
        <span className="panel-note">Mock · TODO: WS/REST</span>
      </div>
      <div className="marketlist-controls">
        <div className="marketlist-tabs">
          <button type="button" className="active">
            USDT
          </button>
          <button type="button">USDC</button>
          <button type="button">FDUSD</button>
        </div>
        <input className="marketlist-search" placeholder="Search" />
      </div>
      <div className="panel-body table dense scroll">
        <div className="row header">
          <span>Pair</span>
          <span>Last</span>
          <span>24h</span>
        </div>
        {rows.map((m) => (
          <div key={m.symbol} className="row">
            <span>{m.symbol}</span>
            <span className="mono">{m.last.toFixed(2)}</span>
            <span className={m.change >= 0 ? 'text-green' : 'text-red'}>
              {m.change >= 0 ? '+' : ''}
              {m.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
