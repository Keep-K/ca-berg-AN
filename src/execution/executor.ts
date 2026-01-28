/**
 * Execution Engine
 * Orchestrates order placement, cancellation, and tracking
 */

import {
  OrderParams,
  OrderResult,
  TradingConnector,
  ExchangeConnector,
  RiskCheckResult,
} from '../types';
import { riskManager } from './riskManager';
import { PortfolioManager } from '../portfolio/manager';
import { EventBus } from '../realtime/eventBus';
import { orderStore } from './orderStore';

export class ExecutionEngine {
  private connectors: Map<string, TradingConnector & ExchangeConnector> = new Map();
  private portfolioManager: PortfolioManager;
  private eventBus: EventBus;

  constructor(portfolioManager: PortfolioManager, eventBus: EventBus) {
    this.portfolioManager = portfolioManager;
    this.eventBus = eventBus;
  }

  /**
   * Register a trading connector
   */
  registerConnector(connector: TradingConnector & ExchangeConnector): void {
    const exchangeName = connector.exchangeName.toLowerCase();
    this.connectors.set(exchangeName, connector);
    console.log(`[ExecutionEngine] Registered trading connector: ${exchangeName}`);
    console.log(`[ExecutionEngine] Total registered exchanges: ${this.connectors.size}`);
  }

  /**
   * Place an order with risk checks
   */
  async placeOrder(
    exchange: string,
    orderParams: OrderParams
  ): Promise<OrderResult> {
    const connector = this.connectors.get(exchange.toLowerCase());
    if (!connector) {
      throw new Error(`Exchange ${exchange} not registered or does not support trading`);
    }

    // Get current portfolio snapshot for risk checks
    const snapshot = this.portfolioManager.getLatestSnapshot();
    if (snapshot) {
      riskManager.updatePortfolioSnapshot(snapshot);
    }

    // Get available balance for the asset
    // Try to get from snapshot first, fallback to API call
    let availableBalance = 0;
    const quoteAsset = orderParams.symbol.includes('/') 
      ? orderParams.symbol.split('/')[1] 
      : (orderParams.symbol.endsWith('USDT') ? 'USDT' : 'USDT');
    
    if (snapshot) {
      // Get balance from snapshot
      const balance = snapshot.balances.find(
        (b) => b.asset === quoteAsset && b.exchange === exchange.toLowerCase()
      );
      if (balance) {
        availableBalance = balance.available;
      }
    }

    // If not found in snapshot, try to fetch from API (but don't fail if it errors)
    if (availableBalance === 0) {
      try {
        const balances = await connector.fetchBalances();
        const balance = balances.find((b) => b.asset === quoteAsset);
        if (balance) {
          availableBalance = balance.free;
        }
      } catch (balanceError: any) {
        console.warn(`[ExecutionEngine] Failed to fetch balances for risk check: ${balanceError.message}. Continuing with order placement.`);
        // Continue without balance check - risk manager will handle it
        availableBalance = 0;
      }
    }

    // Get current position if exists
    let currentPosition;
    try {
      const positions = await connector.fetchPositions();
      currentPosition = positions.find((p) => p.symbol === orderParams.symbol);
    } catch (positionError: any) {
      console.warn(`[ExecutionEngine] Failed to fetch positions for risk check: ${positionError.message}. Continuing without position data.`);
      currentPosition = undefined;
    }

    // Perform risk checks
    const riskCheck = await riskManager.validateOrder(
      orderParams,
      availableBalance,
      currentPosition
        ? {
            size: currentPosition.size,
            value: currentPosition.size * currentPosition.markPrice,
          }
        : undefined
    );

    if (!riskCheck.allowed) {
      throw new Error(`Order rejected by risk manager: ${riskCheck.reason}`);
    }

    // Log warnings if any
    if (riskCheck.warnings && riskCheck.warnings.length > 0) {
      console.warn('[ExecutionEngine] Risk warnings:', riskCheck.warnings);
    }

    // Place order on exchange
    try {
      const orderResult = await connector.placeOrder(orderParams);

      // Store order in database (don't fail if DB is unavailable)
      try {
        await orderStore.storeOrder(orderResult);
      } catch (dbError: any) {
        console.warn(`[ExecutionEngine] Failed to store order in database: ${dbError.message}. Order was placed successfully on exchange.`);
        // Continue - order was placed successfully on exchange
      }

      // Emit order update via WebSocket
      try {
        await this.eventBus.publishUpdate({
          type: 'order',
          data: {
            ...orderResult,
            exchange: connector.exchangeName,
          } as any,
        });
      } catch (eventError: any) {
        console.warn(`[ExecutionEngine] Failed to emit order update: ${eventError.message}`);
        // Continue - order was placed successfully
      }

      return orderResult;
    } catch (error: any) {
      throw new Error(`Failed to place order on ${exchange}: ${error.message}`);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(exchange: string, orderId: string, symbol: string): Promise<void> {
    const connector = this.connectors.get(exchange.toLowerCase());
    if (!connector) {
      throw new Error(`Exchange ${exchange} not registered`);
    }

    try {
      await connector.cancelOrder(orderId, symbol);

      // Update order in database (don't fail if DB is unavailable)
      try {
        await orderStore.updateOrder(orderId, connector.exchangeName, {
          status: 'CANCELED',
          remainingQuantity: 0,
        });
      } catch (dbError: any) {
        console.warn(`[ExecutionEngine] Failed to update order in database: ${dbError.message}. Order was canceled successfully on exchange.`);
      }

      // Emit cancellation update
      try {
        await this.eventBus.publishUpdate({
          type: 'order',
          data: {
            orderId,
            symbol,
            status: 'CANCELED',
            exchange: connector.exchangeName,
            timestamp: Date.now(),
          } as any,
        });
      } catch (eventError: any) {
        console.warn(`[ExecutionEngine] Failed to emit cancellation update: ${eventError.message}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }

  /**
   * Cancel all open orders for a symbol
   */
  async cancelAllOrders(exchange: string, symbol?: string): Promise<void> {
    const connector = this.connectors.get(exchange.toLowerCase());
    if (!connector) {
      throw new Error(`Exchange ${exchange} not registered`);
    }

    try {
      await connector.cancelAllOrders(symbol);

      // TODO: Update orders in database
    } catch (error: any) {
      throw new Error(`Failed to cancel all orders: ${error.message}`);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(exchange: string, orderId: string, symbol: string): Promise<OrderResult> {
    const connector = this.connectors.get(exchange.toLowerCase());
    if (!connector) {
      throw new Error(`Exchange ${exchange} not registered`);
    }

    return await connector.getOrderStatus(orderId, symbol);
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(exchange: string, symbol?: string): Promise<OrderResult[]> {
    const exchangeLower = exchange.toLowerCase();
    const connector = this.connectors.get(exchangeLower);
    
    if (!connector) {
      const availableExchanges = Array.from(this.connectors.keys());
      console.error(`[ExecutionEngine] Exchange ${exchange} not found. Available:`, availableExchanges);
      throw new Error(`Exchange ${exchange} not registered for trading. Available exchanges: ${availableExchanges.join(', ') || 'none'}`);
    }

    try {
      const orders = await connector.getOpenOrders(symbol);
      console.log(`[ExecutionEngine] Retrieved ${orders.length} open orders from ${exchange}`);
      return orders;
    } catch (error: any) {
      console.error(`[ExecutionEngine] Failed to get open orders from ${exchange}:`, error);
      throw new Error(`Failed to fetch open orders: ${error.message}`);
    }
  }

  /**
   * Get registered trading exchanges
   */
  getRegisteredExchanges(): string[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Get a trading connector by exchange name
   */
  getConnector(exchangeName: string): (TradingConnector & ExchangeConnector) | undefined {
    return this.connectors.get(exchangeName.toLowerCase());
  }
}
