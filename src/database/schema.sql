-- Portfolio Monitor Database Schema

-- Users table (authentication)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Exchange accounts (per-user API keys)
CREATE TABLE IF NOT EXISTS exchange_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange VARCHAR(50) NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  encrypted_api_secret TEXT NOT NULL,
  encrypted_passphrase TEXT,
  sandbox BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, exchange)
);

CREATE INDEX idx_exchange_accounts_user_id ON exchange_accounts(user_id);

-- Orders table (add user_id)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_exchange ON orders(exchange);
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Trades table (add user_id)
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_exchange ON trades(exchange);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_order_id ON trades(order_id);
CREATE INDEX idx_trades_created_at ON trades(created_at);
