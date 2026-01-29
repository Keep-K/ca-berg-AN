import { memo } from 'react';
import TradingViewWidget from '../TradingViewWidget';

interface ChartPanelProps {
  symbol: string;
  interval?: string;
  theme?: 'dark' | 'light';
}

function ChartPanel({ symbol, interval = '60', theme = 'dark' }: ChartPanelProps) {
  return (
    <div className="chart-panel">
      <div className="chart-header">
        <div className="chart-title">
          <h3>Chart</h3>
          <span className="chart-symbol">{symbol}</span>
        </div>
        <div className="chart-actions">
          <button className="chip">Time</button>
          <button className="chip ghost">1m</button>
          <button className="chip ghost">5m</button>
          <button className="chip ghost">15m</button>
          <button className="chip">1h</button>
          <button className="chip ghost">4h</button>
          <button className="chip ghost">1d</button>
        </div>
      </div>
      <div className="chart-toolbar">
        <button className="toolbar-btn active">Original</button>
        <button className="toolbar-btn">Trading View</button>
        <button className="toolbar-btn ghost">Depth</button>
        <span className="toolbar-note">Indicators</span>
      </div>
      <div className="chart-body">
        <TradingViewWidget symbol={symbol} interval={interval} theme={theme} />
      </div>
    </div>
  );
}

export default memo(ChartPanel);
