import { useEffect, useMemo, useRef, useState } from 'react';

interface TradeRow {
  side: 'buy' | 'sell';
  price: number;
  size: number;
  time: string;
}

const ROWS = 24;
const UPDATE_MS = 500;

function makeTrades(base: number): TradeRow[] {
  return Array.from({ length: ROWS }).map(() => {
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const price = base + (Math.random() - 0.5) * 120;
    const size = Math.max(0.001, Math.random() * 0.8);
    return {
      side,
      price,
      size,
      time: new Date().toLocaleTimeString(),
    };
  });
}

export default function RecentTradesPanel() {
  const [rows, setRows] = useState<TradeRow[]>(() => makeTrades(65000));
  const lastUpdate = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdate.current < UPDATE_MS) return;
      lastUpdate.current = now;
      const base = 65000 + (Math.random() - 0.5) * 200;
      setRows(makeTrades(base));
    }, UPDATE_MS);
    return () => clearInterval(interval);
  }, []);

  const displayRows = useMemo(() => rows.slice(0, 30), [rows]);

  return (
    <div className="panel trades-panel">
      <div className="panel-header">
        <h3>Recent Trades</h3>
        <span className="panel-note">Mock · TODO: WS/REST</span>
      </div>
      <div className="panel-body table dense scroll">
        <div className="row header">
          <span>Price</span>
          <span>Size</span>
          <span>Time</span>
        </div>
        {displayRows.map((r, idx) => (
          <div key={`${r.side}-${idx}`} className={`row ${r.side}`}>
            <span>{r.price.toFixed(2)}</span>
            <span>{r.size.toFixed(4)}</span>
            <span>{r.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
