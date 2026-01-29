import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import DataTable from '../components/DataTable';
import TradingViewWidget from '../components/TradingViewWidget';
import './Trading.css';

interface OrderResult {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  status: string;
  price: number;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  timestamp: number;
  exchange: string;
}

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  exchange: string;
}

interface TradeFill {
  tradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  realizedPnl: number;
  fee: number;
  timestamp: number;
  exchange: string;
}

function Trading() {
  const [exchanges, setExchanges] = useState<string[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<string>('');
  const [orderForm, setOrderForm] = useState({
    symbol: '',
    side: 'buy' as 'buy' | 'sell',
    type: 'limit' as 'market' | 'limit',
    market: 'spot' as 'spot' | 'futures',
    quantity: '',
    price: '',
    reduceOnly: false,
    postOnly: false,
  });
  const [openOrders, setOpenOrders] = useState<OrderResult[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderResult[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeFill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchExchanges();
    if (!selectedExchange) return;

    fetchOpenOrders();
    fetchPositions();
    fetchOrderHistory();
    fetchTradeHistory();

    const openOrdersInterval = setInterval(fetchOpenOrders, 5000);
    const snapshotInterval = setInterval(fetchPositions, 10000);
    const historyInterval = setInterval(() => {
      fetchOrderHistory();
      fetchTradeHistory();
    }, 15000);

    return () => {
      clearInterval(openOrdersInterval);
      clearInterval(snapshotInterval);
      clearInterval(historyInterval);
    };
  }, [selectedExchange]);

  const fetchExchanges = async () => {
    try {
      const data = await apiClient.getTradeExchanges();
      const tradingExchanges = data.exchanges || [];
      if (tradingExchanges.length > 0) {
        setExchanges(tradingExchanges);
        if (!selectedExchange) setSelectedExchange(tradingExchanges[0]);
      } else {
        const allData = await apiClient.getExchanges();
        const list = allData.exchanges || [];
        setExchanges(list);
        if (list.length > 0 && !selectedExchange) setSelectedExchange(list[0]);
      }
    } catch (err) {
      console.error('Failed to fetch exchanges:', err);
      try {
        const allData = await apiClient.getExchanges();
        setExchanges(allData.exchanges || []);
        if (allData.exchanges?.length > 0 && !selectedExchange) {
          setSelectedExchange(allData.exchanges[0]);
        }
      } catch (fallbackErr) {
        console.error('Failed to fetch exchanges (fallback):', fallbackErr);
      }
    }
  };

  const fetchOpenOrders = async () => {
    if (!selectedExchange) return;
    try {
      const data = await apiClient.getOpenOrders(selectedExchange);
      setOpenOrders(data.orders || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch open orders:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch open orders');
      setOpenOrders([]);
    }
  };

  const fetchPositions = async () => {
    try {
      // Try latest snapshot first, fallback to fresh snapshot
      let snapshot: any;
      try {
        snapshot = await apiClient.getLatestSnapshot();
      } catch (err: any) {
        if (err.response?.status === 404) {
          snapshot = await apiClient.getPortfolioSnapshot();
        } else {
          throw err;
        }
      }

      const allPositions = snapshot?.positions || [];
      const filtered = allPositions.filter(
        (p: Position) => !selectedExchange || p.exchange === selectedExchange
      );
      setPositions(filtered);
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    }
  };

  const fetchOrderHistory = async () => {
    if (!selectedExchange) return;
    try {
      const data = await apiClient.getOrderHistory({ exchange: selectedExchange, limit: 50 });
      setOrderHistory(data.orders || []);
    } catch (err: any) {
      console.error('Failed to fetch order history:', err);
      setOrderHistory([]);
    }
  };

  const fetchTradeHistory = async () => {
    if (!selectedExchange) return;
    try {
      const data = await apiClient.getTradeHistory({ exchange: selectedExchange, limit: 50 });
      setTradeHistory(data.trades || []);
    } catch (err: any) {
      console.error('Failed to fetch trade history:', err);
      setTradeHistory([]);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedExchange || !orderForm.symbol || !orderForm.quantity) {
      setError('Please fill in all required fields');
      return;
    }

    if (orderForm.type === 'limit' && !orderForm.price) {
      setError('Price is required for limit orders');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const orderParams: any = {
        exchange: selectedExchange,
        symbol: orderForm.symbol,
        side: orderForm.side,
        type: orderForm.type,
        market: orderForm.market,
        quantity: parseFloat(orderForm.quantity),
      };

      if (orderForm.type === 'limit') {
        orderParams.price = parseFloat(orderForm.price);
      }

      if (orderForm.reduceOnly) {
        orderParams.reduceOnly = true;
      }

      if (orderForm.postOnly) {
        orderParams.postOnly = true;
      }

      const result = await apiClient.placeOrder(orderParams);

      const successMsg = `✅ Order placed successfully! 
        Order ID: ${result.orderId}
        Symbol: ${result.symbol}
        Side: ${result.side.toUpperCase()}
        Type: ${result.type.toUpperCase()}
        Quantity: ${result.quantity}
        ${result.price > 0 ? `Price: $${result.price}` : ''}
        Status: ${result.status}`;
      
      setSuccess(successMsg);
      setError(null);
      
      // Clear form
      setOrderForm({
        symbol: '',
        side: 'buy',
        type: 'limit',
        market: 'spot',
        quantity: '',
        price: '',
        reduceOnly: false,
        postOnly: false,
      });
      
      // Immediately fetch open orders to show the new order
      await fetchOpenOrders();
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string, symbol: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      await apiClient.cancelOrder(selectedExchange, orderId, symbol);

      setSuccess(`✅ Order canceled successfully! Order ID: ${orderId}`);
      setError(null);
      
      // Immediately fetch open orders to remove canceled order
      await fetchOpenOrders();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order');
    }
  };

  const handleClosePosition = async (position: Position) => {
    if (!confirm(`Close ${position.symbol} ${position.side.toUpperCase()} position?`)) {
      return;
    }

    try {
      const closeSide = position.side === 'long' ? 'sell' : 'buy';

      await apiClient.placeOrder({
        exchange: selectedExchange,
        symbol: position.symbol,
        side: closeSide,
        type: 'market',
        market: 'futures',
        quantity: position.size,
        reduceOnly: true,
      });

      setSuccess(`✅ Position closed: ${position.symbol} (${position.side})`);
      setError(null);
      await fetchPositions();
      await fetchOpenOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to close position');
    }
  };

  const orderColumns = [
    {
      key: 'symbol',
      header: 'Symbol',
      render: (item: OrderResult) => <strong>{item.symbol}</strong>,
    },
    {
      key: 'side',
      header: 'Side',
      render: (item: OrderResult) => (
        <span className={item.side === 'buy' ? 'text-green' : 'text-red'}>
          {item.side.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: OrderResult) => item.type.toUpperCase(),
    },
    {
      key: 'price',
      header: 'Price',
      render: (item: OrderResult) => `$${item.price.toFixed(2)}`,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (item: OrderResult) => item.quantity.toFixed(4),
    },
    {
      key: 'filledQuantity',
      header: 'Filled',
      render: (item: OrderResult) => item.filledQuantity.toFixed(4),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: OrderResult) => (
        <span className={`order-status order-status-${item.status.toLowerCase()}`}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: OrderResult) => (
        <button
          className="btn-cancel"
          onClick={() => handleCancelOrder(item.orderId, item.symbol)}
          disabled={item.status === 'FILLED' || item.status === 'CANCELED'}
        >
          Cancel
        </button>
      ),
    },
  ];

  const positionColumns = [
    {
      key: 'symbol',
      header: 'Symbol',
      render: (item: Position) => <strong>{item.symbol}</strong>,
    },
    {
      key: 'side',
      header: 'Side',
      render: (item: Position) => (
        <span className={item.side === 'long' ? 'text-green' : 'text-red'}>
          {item.side.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (item: Position) => item.size.toFixed(4),
    },
    {
      key: 'entryPrice',
      header: 'Entry',
      render: (item: Position) => `$${item.entryPrice.toFixed(2)}`,
    },
    {
      key: 'markPrice',
      header: 'Mark',
      render: (item: Position) => `$${item.markPrice.toFixed(2)}`,
    },
    {
      key: 'unrealizedPnl',
      header: 'Unrealized PnL',
      render: (item: Position) => (
        <span className={item.unrealizedPnl >= 0 ? 'text-green' : 'text-red'}>
          ${item.unrealizedPnl.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Position) => (
        <button className="btn-close" onClick={() => handleClosePosition(item)}>
          Close
        </button>
      ),
    },
  ];

  const historyOrderColumns = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (item: OrderResult) => new Date(item.timestamp).toLocaleString(),
    },
    {
      key: 'symbol',
      header: 'Symbol',
    },
    {
      key: 'side',
      header: 'Side',
      render: (item: OrderResult) => (
        <span className={item.side === 'buy' ? 'text-green' : 'text-red'}>
          {item.side.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: OrderResult) => item.status.toUpperCase(),
    },
  ];

  const tradeColumns = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (item: TradeFill) => new Date(item.timestamp).toLocaleString(),
    },
    {
      key: 'symbol',
      header: 'Symbol',
    },
    {
      key: 'side',
      header: 'Side',
      render: (item: TradeFill) => (
        <span className={item.side === 'buy' ? 'text-green' : 'text-red'}>
          {item.side.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (item: TradeFill) => `$${item.price.toFixed(2)}`,
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (item: TradeFill) => item.quantity.toFixed(4),
    },
  ];

  const chartSymbol = orderForm.symbol
    ? `BINANCE:${orderForm.symbol.replace('/', '')}`
    : positions.length > 0
      ? `BINANCE:${positions[0].symbol.replace('/', '')}`
      : 'BINANCE:BTCUSDT';

  return (
    <div className="trading-page">
      <div className="page-header">
        <h1>Trading</h1>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="trading-layout">
        {/* Order Ticket Panel */}
        <div className="order-ticket">
          <h3>Place Order</h3>
          <div className="form-group">
            <label>Exchange</label>
            {exchanges.length === 0 ? (
              <div className="exchange-warning">
                <p>No trading exchanges available. Please connect an exchange first.</p>
                <a href="/exchanges" className="link-primary">Go to Exchanges</a>
              </div>
            ) : (
              <select
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value)}
                className="form-select"
                disabled={exchanges.length === 0}
              >
                <option value="">Select Exchange</option>
                {exchanges.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex.toUpperCase()}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label>Symbol</label>
            <input
              type="text"
              value={orderForm.symbol}
              onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
              placeholder="BTCUSDT"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Side</label>
            <div className="side-toggle">
              <button
                className={`side-btn ${orderForm.side === 'buy' ? 'active buy' : ''}`}
                onClick={() => setOrderForm({ ...orderForm, side: 'buy' })}
              >
                BUY
              </button>
              <button
                className={`side-btn ${orderForm.side === 'sell' ? 'active sell' : ''}`}
                onClick={() => setOrderForm({ ...orderForm, side: 'sell' })}
              >
                SELL
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Type</label>
            <select
              value={orderForm.type}
              onChange={(e) => setOrderForm({ ...orderForm, type: e.target.value as 'market' | 'limit' })}
              className="form-select"
            >
              <option value="limit">Limit</option>
              <option value="market">Market</option>
            </select>
          </div>

          <div className="form-group">
            <label>Market</label>
            <select
              value={orderForm.market}
              onChange={(e) => setOrderForm({ ...orderForm, market: e.target.value as 'spot' | 'futures' })}
              className="form-select"
            >
              <option value="spot">Spot</option>
              <option value="futures">Futures</option>
            </select>
          </div>

          <div className="form-group">
            <label>Quantity</label>
            <input
              type="number"
              value={orderForm.quantity}
              onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
              placeholder="0.00"
              step="0.0001"
              className="form-input"
            />
          </div>

          {orderForm.type === 'limit' && (
            <div className="form-group">
              <label>Price</label>
              <input
                type="number"
                value={orderForm.price}
                onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
                placeholder="0.00"
                step="0.01"
                className="form-input"
              />
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={orderForm.reduceOnly}
                onChange={(e) => setOrderForm({ ...orderForm, reduceOnly: e.target.checked })}
              />
              <span>Reduce Only</span>
            </label>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={orderForm.postOnly}
                onChange={(e) => setOrderForm({ ...orderForm, postOnly: e.target.checked })}
              />
              <span>Post Only (Maker)</span>
            </label>
          </div>

          <button
            className={`btn-place-order ${orderForm.side === 'buy' ? 'buy' : 'sell'}`}
            onClick={handlePlaceOrder}
            disabled={loading || !selectedExchange || !orderForm.symbol || !orderForm.quantity}
          >
            {loading ? 'Placing...' : `${orderForm.side === 'buy' ? 'BUY' : 'SELL'} ${orderForm.symbol || 'ORDER'}`}
          </button>
        </div>

        <div className="trading-right">
          <div className="chart-panel">
            <div className="chart-header">
              <h3>Chart (TradingView)</h3>
              <div className="chart-meta">{chartSymbol}</div>
            </div>
            <div className="chart-body">
              <TradingViewWidget symbol={chartSymbol} interval="60" theme="dark" />
            </div>
          </div>

        {/* Open Orders Table */}
        <div className="open-orders">
          <div className="section-header">
            <h3>Open Orders</h3>
            {selectedExchange && (
              <button
                className="btn-secondary btn-sm"
                onClick={() => {
                  if (confirm('Cancel all open orders?')) {
                    apiClient.cancelAllOrders(selectedExchange)
                      .then(() => fetchOpenOrders())
                      .catch(console.error);
                  }
                }}
              >
                Cancel All
              </button>
            )}
          </div>
          {selectedExchange ? (
            <>
              {openOrders.length === 0 ? (
                <div className="empty-state">
                  <p>No open orders</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    Place an order above to see it here
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={orderColumns}
                  data={openOrders}
                  emptyMessage="No open orders"
                />
              )}
            </>
          ) : (
            <div className="empty-state">Select an exchange to view orders</div>
          )}
        </div>
        </div>
      </div>

      <div className="trading-panels">
        <div className="panel">
          <div className="section-header">
            <h3>Positions</h3>
          </div>
          <DataTable columns={positionColumns} data={positions} emptyMessage="No open positions" />
        </div>

        <div className="panel">
          <div className="section-header">
            <h3>Order History</h3>
          </div>
          <DataTable columns={historyOrderColumns} data={orderHistory} emptyMessage="No order history" />
        </div>

        <div className="panel">
          <div className="section-header">
            <h3>Trade History</h3>
          </div>
          <DataTable columns={tradeColumns} data={tradeHistory} emptyMessage="No trade history" />
        </div>
      </div>
    </div>
  );
}

export default Trading;
