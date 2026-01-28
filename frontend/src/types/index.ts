export interface UnifiedBalance {
  asset: string;
  total: number;
  available: number;
  usdValue: number;
  exchange: string;
  timestamp: number;
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

export interface PortfolioSnapshot {
  timestamp: number;
  totalNetEquity: number;
  totalUnrealizedPnl: number;
  assetAllocation: AssetAllocation[];
  exchangeAllocation: ExchangeAllocation[];
  positions: UnifiedPosition[];
  balances: UnifiedBalance[];
  change24h?: number;
}
