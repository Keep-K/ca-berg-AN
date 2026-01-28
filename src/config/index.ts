/**
 * Configuration Management
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'portfolio_monitor',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres', // Default matches docker-compose.yml
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || '',
  },
  rateLimits: {
    binance: parseInt(process.env.BINANCE_RATE_LIMIT || '1200', 10),
    bybit: parseInt(process.env.BYBIT_RATE_LIMIT || '120', 10),
    okx: parseInt(process.env.OKX_RATE_LIMIT || '60', 10),
    coinbase: parseInt(process.env.COINBASE_RATE_LIMIT || '10000', 10),
  },
  alerts: {
    largeBalanceChangeThreshold: 10000, // USD
    largePositionThreshold: 50000, // USD
    rapidDrawdownThreshold: -0.05, // -5%
  },
};
