import React from 'react';
import './FilterBar.css';

const EXCHANGE_OPTIONS = ['', 'binance', 'bybit', 'okx', 'coinbase'];
const MARKET_OPTIONS = ['', 'spot', 'futures'];

interface FilterBarProps {
  /** Selected exchange (empty = All) */
  exchange: string;
  onExchangeChange: (v: string) => void;
  /** Selected market type (empty = All). Omit for pages that don't need it */
  marketType?: string;
  onMarketTypeChange?: (v: string) => void;
  /** Show market type dropdown */
  showMarketType?: boolean;
  /** Optional label prefix */
  label?: string;
}

export function FilterBar({
  exchange,
  onExchangeChange,
  marketType = '',
  onMarketTypeChange,
  showMarketType = false,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label className="filter-label">Exchange</label>
        <select
          className="filter-select"
          value={exchange}
          onChange={(e) => onExchangeChange(e.target.value)}
        >
          <option value="">All</option>
          {EXCHANGE_OPTIONS.filter(Boolean).map((ex) => (
            <option key={ex} value={ex}>
              {ex.charAt(0).toUpperCase() + ex.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {showMarketType && onMarketTypeChange && (
        <div className="filter-group">
          <label className="filter-label">Market Type</label>
          <select
            className="filter-select"
            value={marketType}
            onChange={(e) => onMarketTypeChange(e.target.value)}
          >
            <option value="">All</option>
            <option value="spot">Spot</option>
            <option value="futures">Futures</option>
          </select>
        </div>
      )}
    </div>
  );
}

interface HideSmallBalancesProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  threshold?: number;
}

export function HideSmallBalances({
  checked,
  onChange,
  threshold = 10,
}: HideSmallBalancesProps) {
  return (
    <label className="filter-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>Hide &lt; ${threshold}</span>
    </label>
  );
}
