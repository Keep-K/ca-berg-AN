/**
 * Portfolio Manager
 * Orchestrates data collection and aggregation across exchanges
 */

import { ExchangeConnector, RawBalance, RawPosition, UnifiedBalance, UnifiedPosition } from '../types';
import { PortfolioAggregator } from './aggregator';
import { PortfolioSnapshot } from '../types';
import { BaseNormalizer } from '../normalizer';

export class PortfolioManager {
  private connectors: Map<string, ExchangeConnector>;
  private aggregator: PortfolioAggregator;
  private normalizer: BaseNormalizer;
  private snapshots: PortfolioSnapshot[] = [];
  private maxSnapshots: number = 1000; // Keep last 1000 snapshots

  constructor() {
    this.connectors = new Map();
    this.aggregator = new PortfolioAggregator();
    this.normalizer = new BaseNormalizer();
  }

  /**
   * Register an exchange connector
   */
  registerConnector(connector: ExchangeConnector): void {
    this.connectors.set(connector.exchangeName, connector);
  }

  /**
   * Remove an exchange connector
   */
  removeConnector(exchangeName: string): void {
    const connector = this.connectors.get(exchangeName);
    if (connector) {
      connector.unsubscribeRealtimeUpdates();
      this.connectors.delete(exchangeName);
    }
  }

  /**
   * Get USD price for an asset (simplified - USDT = 1.0, others need price API)
   */
  private getUsdPrice(asset: string): number {
    const assetUpper = asset.toUpperCase();
    
    // Stablecoins
    if (['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD'].includes(assetUpper)) {
      return 1.0;
    }
    
    // For now, return 0 for other assets (would need price API)
    // TODO: Fetch prices from exchange API (e.g., Binance ticker price)
    // For BTC, ETH, etc., we'd need to fetch from /api/v3/ticker/price
    console.warn(`[PortfolioManager] No USD price available for ${asset}, usdValue will be 0`);
    return 0;
  }

  /**
   * Fetch current portfolio snapshot from all exchanges
   */
  async fetchPortfolioSnapshot(): Promise<PortfolioSnapshot> {
    const allBalances: UnifiedBalance[] = [];
    const allPositions: UnifiedPosition[] = [];
    const allOrders: any[] = [];
    const allTrades: any[] = [];

    console.log(`[PortfolioManager] Fetching snapshot from ${this.connectors.size} exchange(s)...`);

    // Fetch data from all connectors in parallel
    const promises = Array.from(this.connectors.values()).map(async (connector) => {
      try {
        console.log(`[PortfolioManager] Fetching data from ${connector.exchangeName}...`);
        
        const [rawBalances, rawPositions, orders] = await Promise.all([
          connector.fetchBalances(),
          connector.fetchPositions(),
          connector.fetchOpenOrders(),
        ]);

        console.log(`[PortfolioManager] ${connector.exchangeName}: ${rawBalances.length} balances, ${rawPositions.length} positions, ${orders.length} orders`);

        // Normalize balances
        rawBalances.forEach((rawBalance: RawBalance) => {
          const usdPrice = this.getUsdPrice(rawBalance.asset);
          const normalized = this.normalizer.normalizeBalance(rawBalance, connector.exchangeName, usdPrice);
          
          console.log(`[PortfolioManager] Normalized balance: ${rawBalance.asset} = ${normalized.total} (price: ${usdPrice}, usdValue: $${normalized.usdValue.toFixed(2)})`);
          
          allBalances.push(normalized);
          
          // Log all balances (not just significant ones)
          if (normalized.total > 0) {
            console.log(`[PortfolioManager] ✓ ${connector.exchangeName} ${rawBalance.asset}: ${normalized.total} total, ${normalized.available} available ($${normalized.usdValue.toFixed(2)})`);
          }
        });

        // Normalize positions
        rawPositions.forEach((rawPosition: RawPosition) => {
          const normalized = this.normalizer.normalizePosition(rawPosition, connector.exchangeName);
          allPositions.push(normalized);
          console.log(`[PortfolioManager] ${connector.exchangeName} Position: ${normalized.symbol} ${normalized.side} ${normalized.size} @ $${normalized.entryPrice}`);
        });

        // Normalize orders (for now, just add exchange)
        orders.forEach((o: any) => {
          allOrders.push({ ...o, exchange: connector.exchangeName });
        });
      } catch (error: any) {
        console.error(`[PortfolioManager] Error fetching from ${connector.exchangeName}:`, error.message || error);
      }
    });

    await Promise.all(promises);

    console.log(`[PortfolioManager] Total before aggregation: ${allBalances.length} balances, ${allPositions.length} positions`);
    
    // Log all balances for debugging
    allBalances.forEach((b) => {
      console.log(`[PortfolioManager] Balance: ${b.asset} = ${b.total} (usdValue: $${b.usdValue.toFixed(2)}, exchange: ${b.exchange})`);
    });

    // Get previous snapshot for 24h change calculation
    const previousSnapshot =
      this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : undefined;

    // Create aggregated snapshot
    const snapshot = this.aggregator.createSnapshot(
      allBalances,
      allPositions,
      allOrders,
      allTrades,
      previousSnapshot
    );
    
    console.log(`[PortfolioManager] Snapshot created: ${snapshot.balances.length} balances, ${snapshot.positions.length} positions, totalEquity: $${snapshot.totalNetEquity.toFixed(2)}`);

    // Store snapshot
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift(); // Remove oldest
    }

    return snapshot;
  }

  /**
   * Get latest portfolio snapshot
   */
  getLatestSnapshot(): PortfolioSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /**
   * Get portfolio snapshots within time range
   */
  getSnapshotsInRange(startTime: number, endTime: number): PortfolioSnapshot[] {
    return this.snapshots.filter(
      (snapshot) => snapshot.timestamp >= startTime && snapshot.timestamp <= endTime
    );
  }

  /**
   * Get registered exchange names
   */
  getRegisteredExchanges(): string[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Get a connector by exchange name
   */
  getConnector(exchangeName: string): ExchangeConnector | undefined {
    return this.connectors.get(exchangeName.toLowerCase());
  }
}
