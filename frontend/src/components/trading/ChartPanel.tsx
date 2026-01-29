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
      </div>
      <div className="chart-body">
        <TradingViewWidget symbol={symbol} interval={interval} theme={theme} />
      </div>
    </div>
  );
}

export default memo(ChartPanel);
