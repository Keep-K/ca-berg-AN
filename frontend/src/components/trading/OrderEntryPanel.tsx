import { useMemo } from 'react';

interface OrderFormState {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  market: 'spot' | 'futures';
  leverage: number;
  quantity: string;
  price: string;
  reduceOnly: boolean;
  postOnly: boolean;
}

interface OrderEntryPanelProps {
  orderForm: OrderFormState;
  setOrderForm: (next: OrderFormState) => void;
  onSubmit: () => void;
  loading: boolean;
}

const QUICK_PCTS = [25, 50, 75, 100];

export default function OrderEntryPanel({ orderForm, setOrderForm, onSubmit, loading }: OrderEntryPanelProps) {
  const total = useMemo(() => {
    const qty = parseFloat(orderForm.quantity || '0');
    const price = parseFloat(orderForm.price || '0');
    if (!qty || !price) return '';
    return (qty * price).toFixed(2);
  }, [orderForm.price, orderForm.quantity]);

  const handlePct = (pct: number) => {
    // TODO: Replace with available balance-based sizing.
    const base = orderForm.market === 'futures' ? 0.1 : 1;
    const qty = ((base * pct) / 100).toFixed(4);
    setOrderForm({ ...orderForm, quantity: qty });
  };

  const submitLabel =
    orderForm.market === 'futures'
      ? orderForm.side === 'buy'
        ? 'Buy / Long'
        : 'Sell / Short'
      : orderForm.side === 'buy'
        ? 'Buy'
        : 'Sell';

  return (
    <div className="panel order-entry">
      <div className="panel-header">
        <h3>Order Entry</h3>
        <span className="badge">{orderForm.market === 'spot' ? 'Spot' : 'Futures'}</span>
      </div>

      {orderForm.market === 'futures' && (
        <div className="field leverage-row">
          <label>Leverage</label>
          <div className="leverage-controls">
            <select
              value={`${orderForm.leverage}`}
              aria-label="Leverage"
              onChange={(e) => setOrderForm({ ...orderForm, leverage: parseInt(e.target.value, 10) })}
            >
              {[1, 2, 3, 5, 10, 20, 50, 100].map((lv) => (
                <option key={lv} value={lv}>
                  {lv}x
                </option>
              ))}
            </select>
            <span className="hint">Applied on futures order</span>
          </div>
        </div>
      )}

      <div className="segment">
        <button
          type="button"
          className={`segment-btn ${orderForm.side === 'buy' ? 'active buy' : ''}`}
          onClick={() => setOrderForm({ ...orderForm, side: 'buy' })}
        >
          Buy
        </button>
        <button
          type="button"
          className={`segment-btn ${orderForm.side === 'sell' ? 'active sell' : ''}`}
          onClick={() => setOrderForm({ ...orderForm, side: 'sell' })}
        >
          Sell
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${orderForm.type === 'limit' ? 'active' : ''}`}
          onClick={() => setOrderForm({ ...orderForm, type: 'limit' })}
        >
          Limit
        </button>
        <button
          type="button"
          className={`tab ${orderForm.type === 'market' ? 'active' : ''}`}
          onClick={() => setOrderForm({ ...orderForm, type: 'market' })}
        >
          Market
        </button>
        <button type="button" className="tab disabled" disabled>
          Stop
        </button>
      </div>

      <div className="form-grid">
        <div className="field">
          <label>Symbol</label>
          <input
            value={orderForm.symbol}
            placeholder="BTCUSDT"
            onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
          />
        </div>

        {orderForm.type === 'limit' && (
          <div className="field">
            <label>Price</label>
            <input
              type="number"
              value={orderForm.price}
              placeholder="0.00"
              onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
            />
          </div>
        )}

        <div className="field">
          <label>Quantity</label>
          <input
            type="number"
            value={orderForm.quantity}
            placeholder="0.00"
            onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Total</label>
          <input value={total} placeholder="0.00" readOnly />
        </div>
      </div>

      <div className="quick-pct">
        {QUICK_PCTS.map((pct) => (
          <button key={pct} type="button" onClick={() => handlePct(pct)}>
            {pct}%
          </button>
        ))}
      </div>

      <div className="options">
        <label>
          <input
            type="checkbox"
            checked={orderForm.reduceOnly}
            onChange={(e) => setOrderForm({ ...orderForm, reduceOnly: e.target.checked })}
          />
          Reduce-only
        </label>
        <label>
          <input
            type="checkbox"
            checked={orderForm.postOnly}
            onChange={(e) => setOrderForm({ ...orderForm, postOnly: e.target.checked })}
          />
          Post-only
        </label>
      </div>

      <button
        className={`submit-btn ${orderForm.side === 'buy' ? 'buy' : 'sell'}`}
        onClick={onSubmit}
        disabled={loading || !orderForm.symbol || !orderForm.quantity}
      >
        {loading ? 'Submitting...' : submitLabel}
      </button>
    </div>
  );
}
