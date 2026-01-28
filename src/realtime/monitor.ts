/**
 * Real-Time Monitoring Engine
 * Detects anomalies and emits alerts
 */

import {
  UnifiedBalance,
  UnifiedPosition,
  PortfolioSnapshot,
  AlertEvent,
  AlertCallback,
} from '../types';
import { config } from '../config';

export class RealtimeMonitor {
  private alertCallbacks: AlertCallback[] = [];
  private previousBalances: Map<string, UnifiedBalance> = new Map();
  private previousPositions: Map<string, UnifiedPosition> = new Map();
  private previousEquity: number = 0;

  /**
   * Register alert callback
   */
  onAlert(callback: AlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove alert callback
   */
  removeAlertCallback(callback: AlertCallback): void {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Process portfolio snapshot and detect anomalies
   */
  processSnapshot(snapshot: PortfolioSnapshot): void {
    // Check for large balance changes
    this.checkBalanceChanges(snapshot.balances);

    // Check for large position openings
    this.checkLargePositions(snapshot.positions);

    // Check for rapid drawdown
    this.checkRapidDrawdown(snapshot);

    // Update previous state
    this.updatePreviousState(snapshot);
  }

  /**
   * Check for large balance changes
   */
  private checkBalanceChanges(balances: UnifiedBalance[]): void {
    balances.forEach((balance) => {
      const key = `${balance.exchange}:${balance.asset}`;
      const previous = this.previousBalances.get(key);

      if (previous) {
        const change = Math.abs(balance.usdValue - previous.usdValue);
        if (change >= config.alerts.largeBalanceChangeThreshold) {
          const changePercent =
            previous.usdValue > 0 ? (change / previous.usdValue) * 100 : 0;

          this.emitAlert({
            type: 'large_balance_change',
            severity: changePercent > 50 ? 'critical' : 'warning',
            message: `Large balance change detected: ${balance.asset} on ${balance.exchange}. Change: $${change.toFixed(2)} (${changePercent.toFixed(2)}%)`,
            exchange: balance.exchange,
            timestamp: Date.now(),
            data: {
              asset: balance.asset,
              previousValue: previous.usdValue,
              currentValue: balance.usdValue,
              change,
              changePercent,
            },
          });
        }
      }

      this.previousBalances.set(key, { ...balance });
    });
  }

  /**
   * Check for large position openings
   */
  private checkLargePositions(positions: UnifiedPosition[]): void {
    positions.forEach((position) => {
      const positionValue = position.size * position.markPrice;
      const key = `${position.exchange}:${position.symbol}`;
      const previous = this.previousPositions.get(key);

      // Check if this is a new large position
      if (!previous && positionValue >= config.alerts.largePositionThreshold) {
        this.emitAlert({
          type: 'large_position_opening',
          severity: 'warning',
          message: `Large position opened: ${position.symbol} ${position.side} on ${position.exchange}. Value: $${positionValue.toFixed(2)}`,
          exchange: position.exchange,
          timestamp: Date.now(),
          data: {
            symbol: position.symbol,
            side: position.side,
            size: position.size,
            value: positionValue,
            leverage: position.leverage,
          },
        });
      }

      this.previousPositions.set(key, { ...position });
    });
  }

  /**
   * Check for rapid drawdown
   */
  private checkRapidDrawdown(snapshot: PortfolioSnapshot): void {
    if (this.previousEquity > 0) {
      const change = (snapshot.totalNetEquity - this.previousEquity) / this.previousEquity;

      if (change <= config.alerts.rapidDrawdownThreshold) {
        this.emitAlert({
          type: 'rapid_drawdown',
          severity: 'critical',
          message: `Rapid drawdown detected: Portfolio decreased by ${(change * 100).toFixed(2)}%`,
          timestamp: Date.now(),
          data: {
            previousEquity: this.previousEquity,
            currentEquity: snapshot.totalNetEquity,
            change,
            changePercent: change * 100,
          },
        });
      }
    }
  }

  /**
   * Update previous state
   */
  private updatePreviousState(snapshot: PortfolioSnapshot): void {
    this.previousEquity = snapshot.totalNetEquity;
  }

  /**
   * Emit alert to all registered callbacks
   */
  private emitAlert(alert: AlertEvent): void {
    this.alertCallbacks.forEach((callback) => {
      try {
        callback(alert);
      } catch (error) {
        console.error('[RealtimeMonitor] Error in alert callback:', error);
      }
    });
  }

  /**
   * Reset monitoring state
   */
  reset(): void {
    this.previousBalances.clear();
    this.previousPositions.clear();
    this.previousEquity = 0;
  }
}
