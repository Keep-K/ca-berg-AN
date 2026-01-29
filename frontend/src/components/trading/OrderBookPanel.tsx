import { useEffect, useMemo, useRef, useState } from 'react';

interface Row {
  side: 'bid' | 'ask';
  price: number;
  size: number;
  total: number;
}

const ROWS = 24;
const UPDATE_MS = 500;

function generateRows(mid: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < ROWS; i += 1) {
    const isAsk = i < ROWS / 2;
    const delta = (ROWS / 2 - i) * (mid * 0.0005);
    const price = isAsk ? mid + delta : mid - delta;
    const size = Math.max(0.01, Math.random() * 2);
    rows.push({
      side: isAsk ? 'ask' : 'bid',
      price,
      size,
      total: price * size,
    });
  }
  return rows;
}

export default function OrderBookPanel() {
  const [rows, setRows] = useState<Row[]>(() => generateRows(65000));
  const lastUpdate = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdate.current < UPDATE_MS) return;
      lastUpdate.current = now;
      const mid = 65000 + (Math.random() - 0.5) * 200;
      setRows(generateRows(mid));
    }, UPDATE_MS);
    return () => clearInterval(interval);
  }, []);

  const { asks, bids, mid } = useMemo(() => {
    const sliced = rows.slice(0, 30);
    const half = Math.floor(sliced.length / 2);
    const askRows = sliced.slice(0, half).reverse();
    const bidRows = sliced.slice(half);
    const midPrice = sliced.length > 0 ? sliced[half]?.price ?? sliced[0].price : 0;
    return { asks: askRows, bids: bidRows, mid: midPrice };
  }, [rows]);

  return (
    <div className="panel orderbook-panel">
      <div className="panel-header">
        <h3>Order Book</h3>
        <span className="panel-note">Mock · TODO: WS/REST</span>
      </div>
      <div className="panel-body table dense scroll">
        <div className="row header">
          <span>Price</span>
          <span>Size</span>
          <span>Total</span>
        </div>
        {asks.map((r, idx) => (
          <div key={`ask-${idx}`} className="row ask">
            <span>{r.price.toFixed(2)}</span>
            <span>{r.size.toFixed(4)}</span>
            <span>{r.total.toFixed(2)}</span>
          </div>
        ))}
        <div className="row mid">
          <span className="mid-price">{mid.toFixed(2)}</span>
          <span>—</span>
          <span>—</span>
        </div>
        {bids.map((r, idx) => (
          <div key={`bid-${idx}`} className="row bid">
            <span>{r.price.toFixed(2)}</span>
            <span>{r.size.toFixed(4)}</span>
            <span>{r.total.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
