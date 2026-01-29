/**
 * User Context Service
 * Per-user PortfolioManager and ExecutionEngine (loaded from exchange_accounts)
 */

import { PortfolioManager } from '../portfolio/manager';
import { ExecutionEngine } from '../execution/executor';
import { EventBus } from '../realtime/eventBus';
import { getCredentialsByUserId, saveCredentials, removeCredentials } from '../database/exchangeAccounts';
import { ExchangeCredentials } from '../types';
import { BinanceConnector } from '../connectors/binance';

interface UserContext {
  portfolioManager: PortfolioManager;
  executionEngine: ExecutionEngine;
}

export class UserContextService {
  private cache = new Map<number, UserContext>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Get or create PortfolioManager for user (loads connectors from DB)
   */
  async getPortfolioManager(userId: number): Promise<PortfolioManager> {
    let ctx = this.cache.get(userId);
    if (!ctx) {
      ctx = await this.buildUserContext(userId);
      this.cache.set(userId, ctx);
    }
    return ctx.portfolioManager;
  }

  /**
   * Get or create ExecutionEngine for user
   */
  async getExecutionEngine(userId: number): Promise<ExecutionEngine> {
    let ctx = this.cache.get(userId);
    if (!ctx) {
      ctx = await this.buildUserContext(userId);
      this.cache.set(userId, ctx);
    }
    return ctx.executionEngine;
  }

  private async buildUserContext(userId: number): Promise<UserContext> {
    const credentialsList = await getCredentialsByUserId(userId);
    const portfolioManager = new PortfolioManager();
    const executionEngine = new ExecutionEngine(portfolioManager, this.eventBus, userId);

    for (const creds of credentialsList) {
      try {
        if (creds.exchange.toLowerCase() === 'binance') {
          const connector = new BinanceConnector(creds);
          portfolioManager.registerConnector(connector);
          const connectorAny = connector as any;
          if (
            typeof connectorAny.placeOrder === 'function' &&
            typeof connectorAny.cancelOrder === 'function' &&
            typeof connectorAny.getOpenOrders === 'function'
          ) {
            executionEngine.registerConnector(connectorAny);
          }
          await connector.subscribeRealtimeUpdates((update) => {
            this.eventBus.publishUpdate(update, userId);
          });
          if (typeof connectorAny.setupSpotUserDataStream === 'function') {
            try {
              await connectorAny.setupSpotUserDataStream();
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (err: any) {
        console.warn(`[UserContext] Failed to load connector ${creds.exchange} for user ${userId}:`, err.message);
      }
    }

    return { portfolioManager, executionEngine };
  }

  /**
   * Register a new exchange for user (test, save to DB, invalidate cache)
   */
  async registerExchange(userId: number, credentials: ExchangeCredentials): Promise<void> {
    const connector = new BinanceConnector(credentials);
    await connector.testConnection();
    await saveCredentials(userId, credentials);
    this.invalidate(userId);
  }

  /**
   * Remove exchange for user (DB + cache)
   */
  async removeExchange(userId: number, exchange: string): Promise<void> {
    await removeCredentials(userId, exchange);
    const ctx = this.cache.get(userId);
    if (ctx) {
      ctx.portfolioManager.removeConnector(exchange);
      ctx.executionEngine.removeConnector(exchange);
    }
  }

  /**
   * Invalidate cache for a user (e.g. after password change or force reload)
   */
  invalidate(userId: number): void {
    const ctx = this.cache.get(userId);
    if (ctx) {
      ctx.portfolioManager.getRegisteredExchanges().forEach((ex) => {
        ctx!.portfolioManager.removeConnector(ex);
      });
      this.cache.delete(userId);
    }
  }
}
