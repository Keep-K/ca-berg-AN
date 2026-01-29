-- Migration: Add auth tables and user_id to orders/trades (run if you have existing DB without auth)
-- Run this after schema.sql has been updated, or run manually for existing deployments.

-- Users (skip if exists)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Exchange accounts (skip if exists)
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
CREATE INDEX IF NOT EXISTS idx_exchange_accounts_user_id ON exchange_accounts(user_id);

-- Ensure at least one user exists for existing orders/trades (placeholder; change password after login)
INSERT INTO users (email, password_hash) VALUES ('migration_default@local', '$2b$10$placeholder')
ON CONFLICT (email) DO NOTHING;

-- Add user_id to orders if column missing (existing DB)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id') THEN
    ALTER TABLE orders ADD COLUMN user_id INTEGER;
    UPDATE orders SET user_id = (SELECT id FROM users LIMIT 1) WHERE user_id IS NULL;
    ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX idx_orders_user_id ON orders(user_id);
  END IF;
END $$;

-- Add user_id to trades if column missing (existing DB)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'user_id') THEN
    ALTER TABLE trades ADD COLUMN user_id INTEGER;
    UPDATE trades SET user_id = (SELECT id FROM users LIMIT 1) WHERE user_id IS NULL;
    ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE trades ADD CONSTRAINT fk_trades_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX idx_trades_user_id ON trades(user_id);
  END IF;
END $$;
