/**
 * Risk Manager
 * Pre-trade risk checks and validation
 */

import {
  OrderParams,
  RiskCheckResult,
  RiskLimits,
  PortfolioSnapshot,
} from '../types';

export class RiskManager {
  private limits: RiskLimits;
  private portfolioSnapshot: PortfolioSnapshot | null = null;

  constructor(limits?: Partial<RiskLimits>) {
    this.limits = {
      maxOrderSize: limits?.maxOrderSize || 100000, // $100k max per order
      maxPositionSize: limits?.maxPositionSize || 500000, // $500k max position
      maxDrawdown: limits?.maxDrawdown || -0.1, // -10% max drawdown
      minBalance: limits?.minBalance || 100, // $100 minimum balance
      ...limits,
    };
  }

  /**
   * Update portfolio snapshot for risk checks
   */
  updatePortfolioSnapshot(snapshot: PortfolioSnapshot): void {
    this.portfolioSnapshot = snapshot;
  }

  /**
   * Validate order against risk limits
   */
  async validateOrder(
    orderParams: OrderParams,
    availableBalance: number,
    currentPosition?: { size: number; value: number }
  ): Promise<RiskCheckResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check order size
    const orderValue = orderParams.price
      ? orderParams.quantity * orderParams.price
      : 0; // Market orders - would need current price

    if (orderValue > this.limits.maxOrderSize) {
      errors.push(
        `Order size ($${orderValue.toFixed(2)}) exceeds maximum ($${this.limits.maxOrderSize.toFixed(2)})`
      );
    }

    // Check position size
    if (currentPosition) {
      const newPositionValue = currentPosition.value + orderValue;
      if (newPositionValue > this.limits.maxPositionSize) {
        errors.push(
          `Position size would exceed maximum ($${this.limits.maxPositionSize.toFixed(2)})`
        );
      }
    }

    // Check balance sufficiency
    if (orderParams.side === 'buy' && orderValue > availableBalance) {
      errors.push('Insufficient balance for order');
    }

    // Check portfolio drawdown
    if (this.portfolioSnapshot) {
      const drawdown = this.portfolioSnapshot.totalUnrealizedPnl / this.portfolioSnapshot.totalNetEquity;
      if (drawdown < this.limits.maxDrawdown) {
        errors.push(
          `Portfolio drawdown (${(drawdown * 100).toFixed(2)}%) exceeds limit (${(this.limits.maxDrawdown * 100).toFixed(2)}%)`
        );
      }
    }

    // Check minimum balance
    if (availableBalance < this.limits.minBalance) {
      warnings.push(`Balance ($${availableBalance.toFixed(2)}) is below recommended minimum ($${this.limits.minBalance})`);
    }

    return {
      allowed: errors.length === 0,
      reason: errors.length > 0 ? errors.join('; ') : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check order size
   */
  checkOrderSize(orderValue: number): boolean {
    return orderValue <= this.limits.maxOrderSize;
  }

  /**
   * Check position size
   */
  checkPositionSize(positionValue: number): boolean {
    return positionValue <= this.limits.maxPositionSize;
  }

  /**
   * Check portfolio drawdown
   */
  checkPortfolioDrawdown(drawdown: number): boolean {
    return drawdown >= this.limits.maxDrawdown;
  }

  /**
   * Check balance sufficiency
   */
  checkBalanceSufficiency(required: number, available: number): boolean {
    return available >= required;
  }

  /**
   * Check rate limit (placeholder - would integrate with rate limiter)
   */
  checkRateLimit(): boolean {
    return true; // Would check against rate limiter
  }

  /**
   * Validate price (check for reasonable values)
   */
  checkPriceValidation(price: number): boolean {
    return price > 0 && price < 1000000000; // Reasonable bounds
  }
}

// Export singleton instance
export const riskManager = new RiskManager();
