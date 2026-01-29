import { useMemo } from 'react';

interface MarketBarProps {
  symbol: string;
  onSymbolChange: (value: string) => void;
  exchanges: string[];
  selectedExchange: string;
  onExchangeChange: (value: string) => void;
  market: 'spot' | 'futures';
  onMarketChange: (value: 'spot' | 'futures') => void;
  stats: {
    last: string;
    change24h: string;
    high: string;
    low: string;
    vol: string;
  };
  symbolOptions?: string[];
}

export default function MarketBar({
  symbol,
  onSymbolChange,
  exchanges,
  selectedExchange,
  onExchangeChange,
  market,
  onMarketChange,
  stats,
  symbolOptions = [],
}: MarketBarProps) {
  const options = useMemo(() => {
    const base = symbolOptions.length > 0 ? symbolOptions : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
    return Array.from(new Set(base.map((s) => s.toUpperCase())));
  }, [symbolOptions]);

  return (
    <div className="market-bar">
      <div className="market-bar-left">
        <div className="market-field symbol-field">
          <label>Symbol</label>
          <input
            list="symbol-options"
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
            placeholder="BTCUSDT"
          />
          <div className="symbol-meta">
            <span className="tag">{market === 'futures' ? 'Perp' : 'Spot'}</span>
            <span className="muted">Index: --</span>
          </div>
          <datalist id="symbol-options">
            {options.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        </div>

        <div className="market-field">
          <label>Exchange</label>
          <select value={selectedExchange} onChange={(e) => onExchangeChange(e.target.value)}>
            <option value="">Select</option>
            {exchanges.map((ex) => (
              <option key={ex} value={ex}>
                {ex.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="market-field toggle-field">
          <label>Market</label>
          <div className="toggle-group">
            <button
              type="button"
              className={`toggle-btn ${market === 'spot' ? 'active' : ''}`}
              onClick={() => onMarketChange('spot')}
            >
              Spot
            </button>
            <button
              type="button"
              className={`toggle-btn ${market === 'futures' ? 'active' : ''}`}
              onClick={() => onMarketChange('futures')}
            >
              Futures
            </button>
          </div>
        </div>
      </div>

      <div className="market-bar-right">
        <div className="stat">
          <span className="label">Last</span>
          <span className="value">{stats.last}</span>
        </div>
        <div className="stat">
          <span className="label">24h</span>
          <span className={`value ${stats.change24h.startsWith('-') ? 'down' : 'up'}`}>
            {stats.change24h}
          </span>
        </div>
        <div className="stat">
          <span className="label">High</span>
          <span className="value">{stats.high}</span>
        </div>
        <div className="stat">
          <span className="label">Low</span>
          <span className="value">{stats.low}</span>
        </div>
        <div className="stat">
          <span className="label">Vol</span>
          <span className="value">{stats.vol}</span>
        </div>
      </div>
    </div>
  );
}
