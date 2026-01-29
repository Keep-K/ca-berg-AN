/**
 * Core Type Definitions for Multi-Exchange Portfolio Monitor
 */

// ==================== Raw Exchange Data Types ====================

export interface RawBalance {
  asset: string;
  free: number;
  locked: number;
  accountType?: 'spot' | 'futures';
  [key: string]: any; // Exchange-specific fields
}

export interface RawPosition {
  symbol: string;
  side: 'long' | 'short' | 'both';
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage?: number;
  [key: string]: any; // Exchange-specific fields
}

export interface RawOrder {
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  price: number;
  quantity: number;
  status: string;
  orderId: string;
  timestamp: number;
  [key: string]: any; // Exchange-specific fields
}

export interface RawTrade {
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  fee: number;
  feeAsset: string;
  timestamp: number;
  tradeId: string;
  [key: string]: any; // Exchange-specific fields
}

// ==================== Unified Data Models ====================

export interface UnifiedBalance {
  asset: string;
  total: number;
  available: number;
  usdValue: number;
  exchange: string;
  timestamp: number;
  accountType?: 'spot' | 'futures';
}

export interface UnifiedPosition {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  exchange: string;
  timestamp: number;
}

export interface UnifiedOrder {
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  status: string;
  timestamp: number;
  exchange: string;
  orderId: string;
}

export interface UnifiedTrade {
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  realizedPnl: number;
  fee: number;
  timestamp: number;
  exchange: string;
  tradeId: string;
}

// ==================== Exchange Connector Interface ====================

export interface RealtimeUpdate {
  type: 'balance' | 'position' | 'order' | 'trade';
  data: UnifiedBalance | UnifiedPosition | UnifiedOrder | UnifiedTrade;
}

export type RealtimeCallback = (update: RealtimeUpdate) => void;

export interface ExchangeConnector {
  /**
   * Exchange identifier (e.g., 'binance', 'bybit')
   */
  readonly exchangeName: string;

  /**
   * Fetch current balances from exchange
   */
  fetchBalances(): Promise<RawBalance[]>;

  /**
   * Fetch current positions from exchange
   */
  fetchPositions(): Promise<RawPosition[]>;

  /**
   * Fetch open orders from exchange
   */
  fetchOpenOrders(): Promise<RawOrder[]>;

  /**
   * Fetch trade history within time range
   */
  fetchTradeHistory(startTime: number, endTime: number): Promise<RawTrade[]>;

  /**
   * Subscribe to real-time updates via WebSocket
   */
  subscribeRealtimeUpdates(callback: RealtimeCallback): Promise<void>;

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeRealtimeUpdates(): Promise<void>;

  /**
   * Test connection to exchange
   */
  testConnection(): Promise<boolean>;
}

// ==================== Portfolio Aggregation Types ====================

export interface PortfolioSnapshot {
  timestamp: number;
  totalNetEquity: number; // USD
  totalUnrealizedPnl: number; // USD
  assetAllocation: AssetAllocation[];
  exchangeAllocation: ExchangeAllocation[];
  positions: UnifiedPosition[];
  balances: UnifiedBalance[];
  change24h?: number; // Percentage change from 24h ago
}

export interface AssetAllocation {
  asset: string;
  totalUsdValue: number;
  percentage: number;
  exchanges: {
    exchange: string;
    usdValue: number;
  }[];
}

export interface ExchangeAllocation {
  exchange: string;
  totalUsdValue: number;
  percentage: number;
}

// ==================== Alert Types ====================

export interface AlertEvent {
  type: 'large_balance_change' | 'large_position_opening' | 'rapid_drawdown' | 'connection_lost';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  exchange?: string;
  timestamp: number;
  data?: any;
}

export type AlertCallback = (alert: AlertEvent) => void;

// ==================== API Key Management ====================

export interface ExchangeCredentials {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // For OKX, Coinbase Pro
  sandbox?: boolean;
}

export interface EncryptedCredentials {
  exchange: string;
  encryptedApiKey: string;
  encryptedApiSecret: string;
  encryptedPassphrase?: string;
  sandbox?: boolean;
}

// ==================== Trading Execution Types ====================

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  market?: 'spot' | 'futures';
  leverage?: number;
  reduceOnly?: boolean;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  stopPrice?: number;
  postOnly?: boolean;
}

export interface OrderResult {
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
  clientOrderId?: string;
}

export interface TradeFill {
  tradeId: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  fee: number;
  feeAsset: string;
  timestamp: number;
  exchange: string;
}

export interface TradingConnector {
  /**
   * Place a new order
   */
  placeOrder(params: OrderParams): Promise<OrderResult>;

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string, symbol: string): Promise<void>;

  /**
   * Cancel all open orders for a symbol (or all symbols)
   */
  cancelAllOrders(symbol?: string): Promise<void>;

  /**
   * Get order status
   */
  getOrderStatus(orderId: string, symbol: string): Promise<OrderResult>;

  /**
   * Get all open orders
   */
  getOpenOrders(symbol?: string): Promise<OrderResult[]>;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  warnings?: string[];
}

export interface RiskLimits {
  maxOrderSize: number;
  maxPositionSize: number;
  maxDrawdown: number; // -0.1 = -10%
  minBalance: number;
}
