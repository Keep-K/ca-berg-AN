/**
 * Normalization Engine
 * Converts raw exchange data into unified schema
 */

import {
  RawBalance,
  RawPosition,
  RawOrder,
  RawTrade,
  UnifiedBalance,
  UnifiedPosition,
  UnifiedOrder,
  UnifiedTrade,
} from '../types';

export interface Normalizer {
  normalizeBalance(raw: RawBalance, exchange: string, usdPrice?: number): UnifiedBalance;
  normalizePosition(raw: RawPosition, exchange: string): UnifiedPosition;
  normalizeOrder(raw: RawOrder, exchange: string): UnifiedOrder;
  normalizeTrade(raw: RawTrade, exchange: string): UnifiedTrade;
}

export class BaseNormalizer implements Normalizer {
  normalizeBalance(raw: RawBalance, exchange: string, usdPrice: number = 0): UnifiedBalance {
    const total = (raw.free || 0) + (raw.locked || 0);
    const available = raw.free || 0;
    const usdValue = total * usdPrice;

    return {
      asset: raw.asset.toUpperCase(),
      total,
      available,
      usdValue,
      exchange,
      timestamp: Date.now(),
      accountType: raw.accountType,
    };
  }

  normalizePosition(raw: RawPosition, exchange: string): UnifiedPosition {
    const side = raw.side === 'both' ? (raw.size >= 0 ? 'long' : 'short') : raw.side;
    const size = Math.abs(raw.size);
    const unrealizedPnl = (raw.markPrice - raw.entryPrice) * size * (side === 'long' ? 1 : -1);

    return {
      symbol: raw.symbol,
      side: side as 'long' | 'short',
      size,
      entryPrice: raw.entryPrice,
      markPrice: raw.markPrice,
      unrealizedPnl,
      leverage: raw.leverage || 1,
      exchange,
      timestamp: Date.now(),
    };
  }

  normalizeOrder(raw: RawOrder, exchange: string): UnifiedOrder {
    return {
      symbol: raw.symbol,
      side: raw.side,
      price: raw.price,
      quantity: raw.quantity,
      status: raw.status.toLowerCase(),
      timestamp: raw.timestamp,
      exchange,
      orderId: raw.orderId,
    };
  }

  normalizeTrade(raw: RawTrade, exchange: string): UnifiedTrade {
    // Realized PnL calculation depends on position tracking
    // For now, set to 0 if not provided
    const realizedPnl = (raw as any).realizedPnl || 0;

    return {
      symbol: raw.symbol,
      side: raw.side,
      price: raw.price,
      quantity: raw.quantity,
      realizedPnl,
      fee: raw.fee,
      timestamp: raw.timestamp,
      exchange,
      tradeId: raw.tradeId,
    };
  }
}

// Exchange-specific normalizers can extend BaseNormalizer
export class BinanceNormalizer extends BaseNormalizer {
  // Override methods if Binance-specific normalization is needed
}

export class BybitNormalizer extends BaseNormalizer {
  // Override methods if Bybit-specific normalization is needed
}

export class OKXNormalizer extends BaseNormalizer {
  // Override methods if OKX-specific normalization is needed
}

export class CoinbaseNormalizer extends BaseNormalizer {
  // Override methods if Coinbase-specific normalization is needed
}
