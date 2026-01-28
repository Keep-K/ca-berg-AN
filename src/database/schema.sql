-- Portfolio Monitor Database Schema

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  exchange VARCHAR(50) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  status VARCHAR(20) NOT NULL,
  filled_quantity DECIMAL(20, 8) DEFAULT 0,
  remaining_quantity DECIMAL(20, 8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  timestamp BIGINT,
  UNIQUE(order_id, exchange)
);

CREATE INDEX idx_orders_exchange ON orders(exchange);
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Trades table (fills)
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  trade_id VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  exchange VARCHAR(50) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) DEFAULT 0,
  fee_asset VARCHAR(20),
  timestamp BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(trade_id, exchange)
);

CREATE INDEX idx_trades_exchange ON trades(exchange);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_order_id ON trades(order_id);
CREATE INDEX idx_trades_created_at ON trades(created_at);
