import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import DataTable from '../components/DataTable';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchExchanges();
    if (selectedExchange) {
      fetchOpenOrders();
      const interval = setInterval(fetchOpenOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedExchange]);

  const fetchExchanges = async () => {
    try {
      // Get trading-enabled exchanges
      const response = await fetch('/api/trade/exchanges');
      const data = await response.json();
      const tradingExchanges = data.exchanges || [];
      
      // Fallback to all exchanges if no trading exchanges
      if (tradingExchanges.length === 0) {
        const allData = await apiClient.getExchanges();
        setExchanges(allData.exchanges || []);
      } else {
        setExchanges(tradingExchanges);
      }
      
      if (tradingExchanges.length > 0 && !selectedExchange) {
        setSelectedExchange(tradingExchanges[0]);
      }
    } catch (err) {
      console.error('Failed to fetch exchanges:', err);
      // Fallback to regular exchanges API
      try {
        const data = await apiClient.getExchanges();
        setExchanges(data.exchanges || []);
        if (data.exchanges && data.exchanges.length > 0 && !selectedExchange) {
          setSelectedExchange(data.exchanges[0]);
        }
      } catch (fallbackErr) {
        console.error('Failed to fetch exchanges (fallback):', fallbackErr);
      }
    }
  };

  const fetchOpenOrders = async () => {
    if (!selectedExchange) return;
    try {
      const response = await fetch(`/api/trade/open-orders?exchange=${selectedExchange}`);
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      
      if (!response.ok) {
        setError(data.error || 'Failed to fetch open orders');
        setOpenOrders([]);
        return;
      }
      
      setOpenOrders(data.orders || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch open orders:', err);
      setError(`Network error: ${err.message || 'Failed to fetch open orders'}`);
      setOpenOrders([]);
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

      const response = await fetch('/api/trade/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderParams),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || result.details || 'Failed to place order';
        console.error('Order placement error:', result);
        throw new Error(errorMessage);
      }

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
      const response = await fetch('/api/trade/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: selectedExchange,
          orderId,
          symbol,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel order');
      }

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

        {/* Open Orders Table */}
        <div className="open-orders">
          <div className="section-header">
            <h3>Open Orders</h3>
            {selectedExchange && (
              <button
                className="btn-secondary btn-sm"
                onClick={() => {
                  if (confirm('Cancel all open orders?')) {
                    fetch('/api/trade/cancel-all', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ exchange: selectedExchange }),
                    })
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
  );
}

export default Trading;
