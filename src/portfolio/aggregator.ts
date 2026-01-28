/**
 * Portfolio Aggregation Service
 * Combines normalized data across exchanges
 */

import {
  UnifiedBalance,
  UnifiedPosition,
  UnifiedOrder,
  UnifiedTrade,
  PortfolioSnapshot,
  AssetAllocation,
  ExchangeAllocation,
} from '../types';

export class PortfolioAggregator {
  /**
   * Aggregate balances across exchanges
   */
  aggregateBalances(balances: UnifiedBalance[]): UnifiedBalance[] {
    const balanceMap = new Map<string, UnifiedBalance>();

    balances.forEach((balance) => {
      const key = `${balance.exchange}:${balance.asset}`;
      const existing = balanceMap.get(key);

      if (existing) {
        // If same exchange and asset, merge
        existing.total += balance.total;
        existing.available += balance.available;
        existing.usdValue += balance.usdValue;
      } else {
        balanceMap.set(key, { ...balance });
      }
    });

    return Array.from(balanceMap.values());
  }

  /**
   * Calculate asset allocation by coin
   */
  calculateAssetAllocation(balances: UnifiedBalance[]): AssetAllocation[] {
    const assetMap = new Map<string, { totalUsdValue: number; exchanges: Map<string, number> }>();

    balances.forEach((balance) => {
      if (balance.usdValue <= 0) return;

      const existing = assetMap.get(balance.asset);
      if (existing) {
        existing.totalUsdValue += balance.usdValue;
        const exchangeValue = existing.exchanges.get(balance.exchange) || 0;
        existing.exchanges.set(balance.exchange, exchangeValue + balance.usdValue);
      } else {
        const exchanges = new Map<string, number>();
        exchanges.set(balance.exchange, balance.usdValue);
        assetMap.set(balance.asset, {
          totalUsdValue: balance.usdValue,
          exchanges,
        });
      }
    });

    const totalUsd = Array.from(assetMap.values()).reduce(
      (sum, asset) => sum + asset.totalUsdValue,
      0
    );

    return Array.from(assetMap.entries())
      .map(([asset, data]) => ({
        asset,
        totalUsdValue: data.totalUsdValue,
        percentage: totalUsd > 0 ? (data.totalUsdValue / totalUsd) * 100 : 0,
        exchanges: Array.from(data.exchanges.entries()).map(([exchange, usdValue]) => ({
          exchange,
          usdValue,
        })),
      }))
      .sort((a, b) => b.totalUsdValue - a.totalUsdValue);
  }

  /**
   * Calculate exchange allocation
   */
  calculateExchangeAllocation(balances: UnifiedBalance[]): ExchangeAllocation[] {
    const exchangeMap = new Map<string, number>();

    balances.forEach((balance) => {
      const existing = exchangeMap.get(balance.exchange) || 0;
      exchangeMap.set(balance.exchange, existing + balance.usdValue);
    });

    const totalUsd = Array.from(exchangeMap.values()).reduce((sum, val) => sum + val, 0);

    return Array.from(exchangeMap.entries())
      .map(([exchange, totalUsdValue]) => ({
        exchange,
        totalUsdValue,
        percentage: totalUsd > 0 ? (totalUsdValue / totalUsd) * 100 : 0,
      }))
      .sort((a, b) => b.totalUsdValue - a.totalUsdValue);
  }

  /**
   * Calculate total net equity (USD)
   */
  calculateTotalNetEquity(balances: UnifiedBalance[]): number {
    return balances.reduce((sum, balance) => sum + balance.usdValue, 0);
  }

  /**
   * Calculate total unrealized PnL
   */
  calculateTotalUnrealizedPnl(positions: UnifiedPosition[]): number {
    return positions.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  }

  /**
   * Create portfolio snapshot
   */
  createSnapshot(
    balances: UnifiedBalance[],
    positions: UnifiedPosition[],
    orders: UnifiedOrder[] = [],
    trades: UnifiedTrade[] = [],
    previousSnapshot?: PortfolioSnapshot
  ): PortfolioSnapshot {
    const aggregatedBalances = this.aggregateBalances(balances);
    const totalNetEquity = this.calculateTotalNetEquity(aggregatedBalances);
    const totalUnrealizedPnl = this.calculateTotalUnrealizedPnl(positions);
    const assetAllocation = this.calculateAssetAllocation(aggregatedBalances);
    const exchangeAllocation = this.calculateExchangeAllocation(aggregatedBalances);

    // Calculate 24h change if previous snapshot exists
    let change24h: number | undefined;
    if (previousSnapshot) {
      const timeDiff = Date.now() - previousSnapshot.timestamp;
      if (timeDiff <= 24 * 60 * 60 * 1000) {
        // Within 24 hours
        const change = totalNetEquity - previousSnapshot.totalNetEquity;
        change24h = previousSnapshot.totalNetEquity > 0
          ? (change / previousSnapshot.totalNetEquity) * 100
          : 0;
      }
    }

    return {
      timestamp: Date.now(),
      totalNetEquity,
      totalUnrealizedPnl,
      assetAllocation,
      exchangeAllocation,
      positions,
      balances: aggregatedBalances,
      change24h,
    };
  }

  /**
   * Get portfolio summary statistics
   */
  getPortfolioSummary(snapshot: PortfolioSnapshot): {
    totalEquity: number;
    totalPnl: number;
    topAssets: AssetAllocation[];
    topExchanges: ExchangeAllocation[];
    openPositions: number;
    openOrders: number;
  } {
    return {
      totalEquity: snapshot.totalNetEquity,
      totalPnl: snapshot.totalUnrealizedPnl,
      topAssets: snapshot.assetAllocation.slice(0, 10),
      topExchanges: snapshot.exchangeAllocation,
      openPositions: snapshot.positions.length,
      openOrders: 0, // Would need orders passed separately
    };
  }
}
