/**
 * Binance Exchange Connector
 * Supports Spot and Futures trading
 */

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import crypto from 'crypto';
import {
  ExchangeConnector,
  TradingConnector,
  RawBalance,
  RawPosition,
  RawOrder,
  RawTrade,
  RealtimeCallback,
  ExchangeCredentials,
  OrderParams,
  OrderResult,
} from '../types';
import { rateLimiter } from '../security/rateLimiter';
import { BinanceNormalizer } from '../normalizer';

interface BinanceSpotBalance {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceFuturesPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  leverage: string;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
}

interface BinanceOrder {
  symbol: string;
  orderId: number;
  side: 'BUY' | 'SELL';
  type: string;
  price: string;
  origQty: string;
  status: string;
  time: number;
}

interface BinanceTrade {
  symbol: string;
  id: number;
  side: 'BUY' | 'SELL';
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
}

export class BinanceConnector implements ExchangeConnector, TradingConnector {
  readonly exchangeName = 'binance';
  private credentials: ExchangeCredentials;
  private spotClient: AxiosInstance;
  private futuresClient: AxiosInstance;
  private wsConnections: WebSocket[] = [];
  private spotUserDataStream: WebSocket | null = null;
  private spotListenKey: string | null = null;
  private spotListenKeyKeepAliveInterval: NodeJS.Timeout | null = null;
  private realtimeCallbacks: RealtimeCallback[] = [];
  private normalizer: BinanceNormalizer;

  constructor(credentials: ExchangeCredentials) {
    this.credentials = credentials;
    this.normalizer = new BinanceNormalizer();

    const normalizeSpotBase = (base: string) =>
      base.replace(/\/api\/v3\/?$/, '').replace(/\/api\/?$/, '');
    const normalizeFuturesBase = (base: string) =>
      base
        .replace(/\/fapi\/v2\/?$/, '')
        .replace(/\/fapi\/v1\/?$/, '')
        .replace(/\/fapi\/?$/, '');

    const baseURL = credentials.sandbox
      ? normalizeSpotBase(
          process.env.BINANCE_SPOT_TESTNET_BASE_URL || 'https://testnet.binance.vision'
        )
      : normalizeSpotBase(process.env.BINANCE_SPOT_BASE_URL || 'https://api.binance.com');

    this.spotClient = axios.create({
      baseURL: `${baseURL}/api/v3`,
      timeout: 10000,
    });

    const futuresBaseURL = credentials.sandbox
      ? normalizeFuturesBase(
          process.env.BINANCE_FUTURES_TESTNET_BASE_URL || 'https://testnet.binancefuture.com'
        )
      : normalizeFuturesBase(process.env.BINANCE_FUTURES_BASE_URL || 'https://fapi.binance.com');

    this.futuresClient = axios.create({
      baseURL: futuresBaseURL,
      timeout: 10000,
    });

    // Set rate limit
    rateLimiter.setLimit('binance', 1200, 60000); // 1200 requests per minute
  }

  /**
   * Build a stable, URL-encoded query string
   */
  private buildQueryString(params: Record<string, any>): string {
    const entries = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => a.localeCompare(b));

    const searchParams = new URLSearchParams();
    entries.forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });

    return searchParams.toString();
  }

  /**
   * Generate signature for authenticated requests
   */
  private generateSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.credentials.apiSecret!)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Make authenticated request
   */
  private async authenticatedRequest(
    client: AxiosInstance,
    endpoint: string,
    params: Record<string, any> = {},
    method: 'GET' | 'POST' | 'DELETE' = 'GET'
  ): Promise<any> {
    await rateLimiter.checkLimit('binance');

    const timestamp = Date.now();
    const queryParams = {
      ...params,
      timestamp,
      recvWindow: 5000,
    };
    const queryString = this.buildQueryString(queryParams);
    const signature = this.generateSignature(queryString);
    const signedQuery = `${queryString}&signature=${signature}`;

    const response = await client.request({
      method,
      url: `${endpoint}?${signedQuery}`,
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey,
      },
    });
    return response.data;
  }

  /**
   * Fetch balances from Spot and Futures accounts
   */
  async fetchBalances(): Promise<RawBalance[]> {
    let spotBalances: RawBalance[] = [];
    let futuresBalances: RawBalance[] = [];

    // Try to fetch Spot balances
    try {
      const data = await this.authenticatedRequest(this.spotClient, '/account');
      spotBalances = data.balances
        .filter((b: BinanceSpotBalance) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map((b: BinanceSpotBalance) => ({
          asset: b.asset,
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
        }));
      console.log(`[Binance] Fetched ${spotBalances.length} spot balances`);
    } catch (spotError: any) {
      const statusCode = spotError.response?.status;
      const errorCode = spotError.response?.data?.code;
      
      // If 401/403, it's likely the API key doesn't have Spot permissions (demo.binance.com keys)
      if (statusCode === 401 || statusCode === 403) {
        console.warn(`[Binance] Spot API access denied (${statusCode}), continuing with Futures balances only`);
      } else {
        console.warn(`[Binance] Failed to fetch spot balances: ${spotError.message}`);
      }
      // Continue - try to get Futures balances
    }

    // Try to fetch Futures balances
    try {
      console.log(`[Binance] Fetching futures balances from ${this.futuresClient.defaults.baseURL}/fapi/v2/balance...`);
      const futuresData = await this.authenticatedRequest(
        this.futuresClient,
        '/fapi/v2/balance'
      );
      
      console.log(`[Binance] Futures balance API response:`, {
        isArray: Array.isArray(futuresData),
        length: Array.isArray(futuresData) ? futuresData.length : 'N/A',
        sample: Array.isArray(futuresData) && futuresData.length > 0 ? futuresData[0] : 'No data',
      });
      
      if (!Array.isArray(futuresData)) {
        console.error(`[Binance] Futures balance API returned non-array:`, typeof futuresData);
        throw new Error('Invalid futures balance data format');
      }
      
      futuresBalances = futuresData
        .filter((b: any) => {
          const balance = parseFloat(b.balance || '0');
          const hasBalance = balance > 0;
          if (!hasBalance && balance !== 0) {
            console.log(`[Binance] Filtering out balance: ${b.asset} = ${b.balance}`);
          }
          return hasBalance;
        })
        .map((b: any) => {
          const balance = parseFloat(b.balance || '0');
          const available = parseFloat(b.availableBalance || '0');
          const locked = balance - available;
          
          console.log(`[Binance] Futures balance: ${b.asset} = ${balance} (available: ${available}, locked: ${locked})`);
          
          return {
            asset: b.asset,
            free: available,
            locked: locked,
          };
        });
      
      console.log(`[Binance] ✓ Fetched ${futuresBalances.length} futures balances (from ${futuresData.length} total)`);
    } catch (futuresError: any) {
      const statusCode = futuresError.response?.status;
      const errorCode = futuresError.response?.data?.code;
      const errorMsg = futuresError.response?.data?.msg || futuresError.message;
      
      console.error(`[Binance] ✗ Failed to fetch futures balances:`, {
        statusCode,
        errorCode,
        errorMsg,
        endpoint: '/fapi/v2/balance',
        baseURL: this.futuresClient.defaults.baseURL,
        sandbox: this.credentials.sandbox,
      });
      
      if (statusCode === 401 || statusCode === 403) {
        console.warn(`[Binance] Futures API access denied (${statusCode}) - check API key permissions`);
      }
    }

    // Return combined balances (even if one failed)
    const allBalances = [...spotBalances, ...futuresBalances];
    
    if (allBalances.length === 0) {
      console.warn(`[Binance] No balances found from either Spot or Futures API`);
    } else {
      console.log(`[Binance] Total balances: ${allBalances.length} (${spotBalances.length} spot + ${futuresBalances.length} futures)`);
    }

    return allBalances;
  }

  /**
   * Fetch positions from Futures account
   */
  async fetchPositions(): Promise<RawPosition[]> {
    try {
      const data = await this.authenticatedRequest(this.futuresClient, '/fapi/v2/positionRisk');
      
      if (!Array.isArray(data)) {
        console.warn('[Binance] Invalid positions data format');
        return [];
      }
      
      const positions: RawPosition[] = data
        .filter((p: BinanceFuturesPosition) => parseFloat(p.positionAmt) !== 0)
        .map((p: BinanceFuturesPosition) => {
          const size = Math.abs(parseFloat(p.positionAmt));
          const side = parseFloat(p.positionAmt) > 0 ? 'long' : 'short';

          return {
            symbol: p.symbol,
            side: side as 'long' | 'short',
            size,
            entryPrice: parseFloat(p.entryPrice),
            markPrice: parseFloat(p.markPrice),
            leverage: parseInt(p.leverage),
          };
        });

      console.log(`[Binance] Fetched ${positions.length} positions`);
      return positions;
    } catch (error: any) {
      const statusCode = error.response?.status;
      const errorCode = error.response?.data?.code;
      
      // Log detailed error for debugging
      console.warn(`[Binance] Failed to fetch futures positions:`, {
        message: error.message,
        statusCode,
        errorCode,
        sandbox: this.credentials.sandbox,
      });
      
      // Return empty array instead of throwing - allows spot-only accounts to work
      return [];
    }
  }

  /**
   * Fetch open orders
   */
  async fetchOpenOrders(): Promise<RawOrder[]> {
    let spotOrders: any[] = [];
    let futuresOrders: any[] = [];

    // Spot orders
    try {
      const data = await this.authenticatedRequest(this.spotClient, '/openOrders');
      spotOrders = Array.isArray(data) ? data : [];
      console.log(`[Binance] Fetched ${spotOrders.length} spot open orders`);
    } catch (spotError: any) {
      const statusCode = spotError.response?.status;
      if (statusCode === 401 || statusCode === 403) {
        console.warn(`[Binance] Spot open orders access denied (${statusCode}), continuing with Futures only`);
      } else {
        console.warn(`[Binance] Failed to fetch spot open orders: ${spotError.message}`);
      }
    }

    // Futures orders
    try {
      const data = await this.authenticatedRequest(this.futuresClient, '/fapi/v1/openOrders');
      futuresOrders = Array.isArray(data) ? data : [];
      console.log(`[Binance] Fetched ${futuresOrders.length} futures open orders`);
    } catch (futuresError: any) {
      const statusCode = futuresError.response?.status;
      if (statusCode === 401 || statusCode === 403) {
        console.warn(`[Binance] Futures open orders access denied (${statusCode})`);
      } else {
        console.warn(`[Binance] Failed to fetch futures open orders: ${futuresError.message}`);
      }
    }

    const orders: RawOrder[] = [
      ...spotOrders.map((o: BinanceOrder) => ({
        symbol: o.symbol,
        side: o.side.toLowerCase() as 'buy' | 'sell',
        type: o.type,
        price: parseFloat(o.price),
        quantity: parseFloat(o.origQty),
        status: o.status.toLowerCase(),
        orderId: o.orderId.toString(),
        timestamp: o.time,
      })),
      ...futuresOrders.map((o: any) => ({
        symbol: o.symbol,
        side: o.side.toLowerCase() as 'buy' | 'sell',
        type: o.type,
        price: parseFloat(o.price),
        quantity: parseFloat(o.origQty),
        status: o.status.toLowerCase(),
        orderId: o.orderId.toString(),
        timestamp: o.time,
      })),
    ];

    return orders;
  }

  /**
   * Fetch trade history
   */
  async fetchTradeHistory(startTime: number, endTime: number): Promise<RawTrade[]> {
    try {
      // Spot trades
      const spotTrades = await this.authenticatedRequest(this.spotClient, '/myTrades', {
        startTime,
        endTime,
      });
      // Futures trades
      const futuresTrades = await this.authenticatedRequest(
        this.futuresClient,
        '/fapi/v1/userTrades',
        {
          startTime,
          endTime,
        }
      );

      const trades: RawTrade[] = [
        ...spotTrades.map((t: BinanceTrade) => ({
          symbol: t.symbol,
          side: t.side.toLowerCase() as 'buy' | 'sell',
          price: parseFloat(t.price),
          quantity: parseFloat(t.qty),
          fee: parseFloat(t.commission),
          feeAsset: t.commissionAsset,
          timestamp: t.time,
          tradeId: t.id.toString(),
        })),
        ...futuresTrades.map((t: any) => ({
          symbol: t.symbol,
          side: t.side.toLowerCase() as 'buy' | 'sell',
          price: parseFloat(t.price),
          quantity: parseFloat(t.qty),
          fee: parseFloat(t.commission),
          feeAsset: t.commissionAsset,
          timestamp: t.time,
          tradeId: t.id.toString(),
        })),
      ];

      return trades;
    } catch (error: any) {
      throw new Error(`Binance fetchTradeHistory failed: ${error.message}`);
    }
  }

  /**
   * Subscribe to real-time updates via WebSocket
   */
  async subscribeRealtimeUpdates(callback: RealtimeCallback): Promise<void> {
    this.realtimeCallbacks.push(callback);

    if (this.wsConnections.length === 0) {
      // Initialize WebSocket connections
      try {
        await this.setupWebSocketConnections();
      } catch (error: any) {
        console.warn('[Binance] Failed to setup WebSocket connections for real-time updates:', error.message);
        // Continue anyway - REST API still works
      }
    }
  }

  /**
   * Setup WebSocket connections for real-time updates
   */
  private async setupWebSocketConnections(): Promise<void> {
    try {
      // Generate listen key for user data stream
      const listenKey = await this.getUserDataStreamListenKey();

      const wsUrl = this.credentials.sandbox
        ? 'wss://testnet.binance.vision/ws'
        : 'wss://fstream.binance.com/ws';

      const ws = new WebSocket(`${wsUrl}/${listenKey}`);

      ws.on('open', () => {
        console.log(`[Binance] WebSocket connected`);
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('[Binance] WebSocket message parse error:', error);
        }
      });

      ws.on('error', (error) => {
        console.error('[Binance] WebSocket error:', error);
      });

      ws.on('close', () => {
        console.log('[Binance] WebSocket closed, reconnecting...');
        setTimeout(() => {
          this.setupWebSocketConnections().catch(console.error);
        }, 5000);
      });

      this.wsConnections.push(ws);

      // Keep listen key alive (required every 30 minutes)
      setInterval(() => {
        this.keepAliveListenKey(listenKey).catch(console.error);
      }, 20 * 60 * 1000); // Every 20 minutes
    } catch (error: any) {
      console.error('[Binance] Failed to setup WebSocket connections:', error.message);
      throw error;
    }
  }

  /**
   * Get user data stream listen key
   */
  private async getUserDataStreamListenKey(): Promise<string> {
    const response = await this.futuresClient.post('/fapi/v1/listenKey', null, {
      headers: {
        'X-MBX-APIKEY': this.credentials.apiKey,
      },
    });
    return response.data.listenKey;
  }

  /**
   * Keep listen key alive
   */
  private async keepAliveListenKey(listenKey: string): Promise<void> {
    try {
      await this.futuresClient.put('/fapi/v1/listenKey', null, {
        params: { listenKey },
        headers: {
          'X-MBX-APIKEY': this.credentials.apiKey,
        },
      });
    } catch (error) {
      console.error('[Binance] Failed to keep listen key alive:', error);
    }
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    // Handle account update (balance changes)
    if (message.e === 'ACCOUNT_UPDATE') {
      // Process balance updates
      // This is simplified - actual implementation would normalize and emit
    }

    // Handle order update
    if (message.e === 'ORDER_TRADE_UPDATE') {
      // Process order updates
    }

    // Emit to all callbacks
    this.realtimeCallbacks.forEach((callback) => {
      // Normalize and emit updates
      // Implementation depends on message type
    });
  }

  /**
   * Unsubscribe from real-time updates
   */
  async unsubscribeRealtimeUpdates(): Promise<void> {
    this.realtimeCallbacks = [];
    this.wsConnections.forEach((ws) => ws.close());
    this.wsConnections = [];
  }

  /**
   * Test connection to exchange
   */
  async testConnection(): Promise<boolean> {
    const handleError = (error: any, endpoint: string) => {
      const errorResponse = error.response?.data;
      const statusCode = error.response?.status;
      const errorMsg = errorResponse?.msg || errorResponse?.message || error.message || 'Unknown error';
      const errorCode = errorResponse?.code;

      console.error(`[Binance] Connection test failed:`, {
        statusCode,
        errorCode,
        errorMsg,
        endpoint,
        sandbox: this.credentials.sandbox,
        apiKeyPrefix: this.credentials.apiKey?.substring(0, 8),
      });

      return { statusCode, errorCode, errorMsg };
    };

    try {
      const response = await this.authenticatedRequest(this.spotClient, '/account');

      if (
        response &&
        (response.balances !== undefined ||
          response.accountType !== undefined ||
          response.makerCommission !== undefined)
      ) {
        console.log('[Binance] Connection test successful - spot account data retrieved');
        return true;
      }

      if (response) {
        console.log('[Binance] Connection test successful - spot response received');
        return true;
      }
    } catch (error: any) {
      const spotError = handleError(error, '/api/v3/account');

      // If spot test fails, try futures testnet (demo.binance.com keys)
      try {
        const futuresResponse = await this.authenticatedRequest(
          this.futuresClient,
          '/fapi/v2/account'
        );

        if (futuresResponse) {
          console.log('[Binance] Connection test successful - futures account data retrieved');
          return true;
        }
      } catch (futuresError: any) {
        const futures = handleError(futuresError, '/fapi/v2/account');

        // Provide more helpful error messages
        if (futures.statusCode === 401 || spotError.statusCode === 401) {
          throw new Error(
            `Binance API authentication failed (401). Please check your API key and secret. Sandbox mode: ${this.credentials.sandbox}`
          );
        } else if (futures.statusCode === 403 || spotError.statusCode === 403) {
          throw new Error(
            `Binance API access forbidden (403). Your API key may not have trading permissions.`
          );
        } else if (futures.errorCode === -1022 || spotError.errorCode === -1022) {
          throw new Error(`Binance API signature invalid (-1022). Please check your API secret.`);
        } else if (futures.errorCode === -2015 || spotError.errorCode === -2015) {
          throw new Error(`Binance API invalid API key (-2015). Please check your API key.`);
        }

        throw new Error(`Binance connection test failed: ${futures.errorMsg}`);
      }
    }

    throw new Error('Invalid response from Binance API');
  }

  // ==================== TradingConnector Implementation ====================

  /**
   * Place a new order
   */
  async placeOrder(params: OrderParams): Promise<OrderResult> {
    let endpoint: string = '';
    let symbol: string = '';
    
    try {
      symbol = params.symbol.replace('/', '');
      const isFutures = params.market === 'futures';
      
      endpoint = isFutures ? '/fapi/v1/order' : '/order';
      const client = isFutures ? this.futuresClient : this.spotClient;

      const orderParams: any = {
        symbol,
        side: params.side.toUpperCase(),
        type: params.type.toUpperCase(),
        quantity: params.quantity.toString(),
      };

      if (!isFutures && params.postOnly) {
        if (params.type !== 'limit') {
          throw new Error('Post-only is only supported for limit orders on spot');
        }
        orderParams.type = 'LIMIT_MAKER';
      }

      if (params.type === 'limit') {
        if (!params.price) {
          throw new Error('Price is required for limit orders');
        }
        orderParams.price = params.price.toString();
        if (isFutures) {
          orderParams.timeInForce = params.postOnly ? 'GTX' : params.timeInForce || 'GTC';
        } else if (!params.postOnly) {
          orderParams.timeInForce = params.timeInForce || 'GTC';
        }
      }

      if (params.reduceOnly && isFutures) {
        orderParams.reduceOnly = true;
      }

      const quantityStr = orderParams.quantity.toString();
      console.log(`[Binance] Placing order:`, { 
        endpoint, 
        orderParams: { 
          ...orderParams, 
          quantity: quantityStr.length > 20 ? quantityStr.substring(0, 20) + '...' : quantityStr 
        } 
      });

      const response = await this.authenticatedRequest(client, endpoint, orderParams, 'POST');

      console.log(`[Binance] Order placed successfully:`, { orderId: response.orderId, status: response.status });

      return {
        orderId: response.orderId?.toString() || response.clientOrderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        status: this.mapBinanceStatus(response.status),
        price: parseFloat(response.price || '0'),
        quantity: parseFloat(response.origQty || response.origQuantity || '0'),
        filledQuantity: parseFloat(response.executedQty || response.executedQuantity || '0'),
        remainingQuantity:
          parseFloat(response.origQty || response.origQuantity || '0') -
          parseFloat(response.executedQty || response.executedQuantity || '0'),
        timestamp: response.transactTime || response.updateTime || Date.now(),
        exchange: this.exchangeName,
        clientOrderId: response.clientOrderId,
      };
    } catch (error: any) {
      const errorResponse = error.response?.data;
      const statusCode = error.response?.status;
      const errorMsg = errorResponse?.msg || errorResponse?.message || error.message || 'Unknown error';
      const errorCode = errorResponse?.code;

      console.error(`[Binance] placeOrder failed:`, {
        statusCode,
        errorCode,
        errorMsg,
        endpoint: endpoint || 'unknown',
        symbol: symbol || params.symbol,
        side: params.side,
        type: params.type,
      });

      // Provide more helpful error messages
      if (statusCode === 400) {
        if (errorCode === -1013) {
          throw new Error(`Invalid quantity: ${errorMsg}`);
        } else if (errorCode === -1010) {
          throw new Error(`Order rejected: ${errorMsg}`);
        } else if (errorCode === -1121) {
          throw new Error(`Invalid symbol: ${errorMsg}`);
        } else if (errorCode === -2010) {
          throw new Error(`Insufficient balance: ${errorMsg}`);
        }
        throw new Error(`Binance API error (${errorCode || statusCode}): ${errorMsg}`);
      } else if (statusCode === 401) {
        throw new Error(`Binance API authentication failed (401). Please check your API key and secret.`);
      } else if (statusCode === 403) {
        throw new Error(`Binance API access forbidden (403). Your API key may not have trading permissions.`);
      }

      throw new Error(`Binance placeOrder failed: ${errorMsg}`);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    try {
      const symbolClean = symbol.replace('/', '');
      const isFutures = symbol.includes('USDT') && symbol.endsWith('USDT');
      
      const endpoint = isFutures ? '/fapi/v1/order' : '/order';
      const client = isFutures ? this.futuresClient : this.spotClient;

      await this.authenticatedRequest(
        client,
        endpoint,
        {
          symbol: symbolClean,
          orderId: orderId,
        },
        'DELETE'
      );
    } catch (error: any) {
      throw new Error(`Binance cancelOrder failed: ${error.message}`);
    }
  }

  /**
   * Cancel all open orders
   */
  async cancelAllOrders(symbol?: string): Promise<void> {
    try {
      if (symbol) {
        const symbolClean = symbol.replace('/', '');
        const isFutures = symbol.includes('USDT') && symbol.endsWith('USDT');
        
        const endpoint = isFutures ? '/fapi/v1/allOpenOrders' : '/openOrders';
        const client = isFutures ? this.futuresClient : this.spotClient;

        await this.authenticatedRequest(
          client,
          endpoint,
          {
            symbol: symbolClean,
          },
          'DELETE'
        );
      } else {
        // Cancel all orders across all symbols (futures only)
        await this.authenticatedRequest(this.futuresClient, '/fapi/v1/allOpenOrders', {}, 'DELETE');
      }
    } catch (error: any) {
      throw new Error(`Binance cancelAllOrders failed: ${error.message}`);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string, symbol: string): Promise<OrderResult> {
    try {
      const symbolClean = symbol.replace('/', '');
      const isFutures = symbol.includes('USDT') && symbol.endsWith('USDT');
      
      const endpoint = isFutures ? '/fapi/v1/order' : '/order';
      const client = isFutures ? this.futuresClient : this.spotClient;

      const response = await this.authenticatedRequest(client, endpoint, {
        symbol: symbolClean,
        orderId: orderId,
      });

      return {
        orderId: response.orderId?.toString() || response.clientOrderId,
        symbol: symbol,
        side: response.side.toLowerCase() as 'buy' | 'sell',
        type: response.type.toLowerCase(),
        status: this.mapBinanceStatus(response.status),
        price: parseFloat(response.price || '0'),
        quantity: parseFloat(response.origQty || response.origQuantity || '0'),
        filledQuantity: parseFloat(response.executedQty || response.executedQuantity || '0'),
        remainingQuantity:
          parseFloat(response.origQty || response.origQuantity || '0') -
          parseFloat(response.executedQty || response.executedQuantity || '0'),
        timestamp: response.time || response.updateTime || Date.now(),
        exchange: this.exchangeName,
        clientOrderId: response.clientOrderId,
      };
    } catch (error: any) {
      throw new Error(`Binance getOrderStatus failed: ${error.message}`);
    }
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol?: string): Promise<OrderResult[]> {
    try {
      const params = symbol ? { symbol: symbol.replace('/', '') } : {};
      
      let spotOrders: any[] = [];
      let futuresOrders: any[] = [];
      
      try {
        spotOrders = await this.authenticatedRequest(this.spotClient, '/openOrders', params);
        if (!Array.isArray(spotOrders)) {
          spotOrders = [];
        }
      } catch (spotError: any) {
        console.warn(`[Binance] Failed to fetch spot orders: ${spotError.message}`);
      }
      
      try {
        futuresOrders = await this.authenticatedRequest(this.futuresClient, '/fapi/v1/openOrders', params);
        if (!Array.isArray(futuresOrders)) {
          futuresOrders = [];
        }
      } catch (futuresError: any) {
        console.warn(`[Binance] Failed to fetch futures orders: ${futuresError.message}`);
      }

      const orders: OrderResult[] = [];

      // Process spot orders
      if (Array.isArray(spotOrders)) {
        spotOrders.forEach((order: any) => {
          orders.push({
            orderId: order.orderId?.toString() || order.clientOrderId,
            symbol: order.symbol.includes('/') ? order.symbol : `${order.symbol.slice(0, -4)}/${order.symbol.slice(-4)}`,
            side: order.side.toLowerCase() as 'buy' | 'sell',
            type: order.type.toLowerCase(),
            status: this.mapBinanceStatus(order.status),
            price: parseFloat(order.price || '0'),
            quantity: parseFloat(order.origQty || order.origQuantity || '0'),
            filledQuantity: parseFloat(order.executedQty || order.executedQuantity || '0'),
            remainingQuantity: parseFloat(order.origQty || order.origQuantity || '0') - parseFloat(order.executedQty || order.executedQuantity || '0'),
            timestamp: order.time || order.updateTime || Date.now(),
            exchange: this.exchangeName,
            clientOrderId: order.clientOrderId,
          });
        });
      }

      // Process futures orders
      if (Array.isArray(futuresOrders)) {
        futuresOrders.forEach((order: any) => {
          orders.push({
            orderId: order.orderId?.toString() || order.clientOrderId,
            symbol: order.symbol.includes('/') ? order.symbol : `${order.symbol.slice(0, -4)}/${order.symbol.slice(-4)}`,
            side: order.side.toLowerCase() as 'buy' | 'sell',
            type: order.type.toLowerCase(),
            status: this.mapBinanceStatus(order.status),
            price: parseFloat(order.price || '0'),
            quantity: parseFloat(order.origQty || order.origQuantity || '0'),
            filledQuantity: parseFloat(order.executedQty || order.executedQuantity || '0'),
            remainingQuantity: parseFloat(order.origQty || order.origQuantity || '0') - parseFloat(order.executedQty || order.executedQuantity || '0'),
            timestamp: order.time || order.updateTime || Date.now(),
            exchange: this.exchangeName,
            clientOrderId: order.clientOrderId,
          });
        });
      }

      return orders;
    } catch (error: any) {
      throw new Error(`Binance getOpenOrders failed: ${error.message}`);
    }
  }

  /**
   * Map Binance order status to unified status
   */
  private mapBinanceStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'NEW': 'NEW',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
      'FILLED': 'FILLED',
      'CANCELED': 'CANCELED',
      'PENDING_CANCEL': 'CANCELING',
      'REJECTED': 'REJECTED',
      'EXPIRED': 'EXPIRED',
    };
    return statusMap[status] || status.toUpperCase();
  }

  // ==================== Spot User Data Stream Methods ====================

  /**
   * Get Spot user data stream listen key
   */
  async getSpotUserDataStreamListenKey(): Promise<string> {
    try {
      const response = await this.spotClient.post('/userDataStream', null, {
        headers: {
          'X-MBX-APIKEY': this.credentials.apiKey,
        },
      });
      const listenKey = response.data.listenKey;
      this.spotListenKey = listenKey;
      console.log(`[Binance] Spot User Data Stream listen key obtained`);
      return listenKey;
    } catch (error: any) {
      console.error('[Binance] Failed to get Spot User Data Stream listen key:', error.message);
      throw new Error(`Failed to get Spot User Data Stream listen key: ${error.message}`);
    }
  }

  /**
   * Keep Spot listen key alive
   */
  async keepSpotListenKeyAlive(listenKey: string): Promise<void> {
    try {
      await this.spotClient.put('/userDataStream', null, {
        params: { listenKey },
        headers: {
          'X-MBX-APIKEY': this.credentials.apiKey,
        },
      });
      console.log(`[Binance] Spot listen key kept alive`);
    } catch (error: any) {
      console.error('[Binance] Failed to keep Spot listen key alive:', error.message);
      throw error;
    }
  }

  /**
   * Close Spot User Data Stream
   */
  async closeSpotUserDataStream(listenKey: string): Promise<void> {
    try {
      await this.spotClient.delete('/userDataStream', {
        params: { listenKey },
        headers: {
          'X-MBX-APIKEY': this.credentials.apiKey,
        },
      });
      console.log(`[Binance] Spot User Data Stream closed`);
    } catch (error: any) {
      console.error('[Binance] Failed to close Spot User Data Stream:', error.message);
    }
  }

  /**
   * Setup Spot User Data Stream WebSocket connection
   */
  async setupSpotUserDataStream(): Promise<void> {
    if (this.spotUserDataStream) {
      console.log('[Binance] Spot User Data Stream already connected');
      return;
    }

    try {
      // Get listen key
      const listenKey = await this.getSpotUserDataStreamListenKey();

      // Determine WebSocket URL
      const wsUrl = this.credentials.sandbox
        ? `wss://testnet.binance.vision/ws/${listenKey}`
        : `wss://stream.binance.com:9443/ws/${listenKey}`;

      console.log(`[Binance] Connecting to Spot User Data Stream: ${wsUrl.replace(listenKey, '***')}`);

      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        console.log(`[Binance] Spot User Data Stream WebSocket connected`);
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleSpotUserDataStreamMessage(message);
        } catch (error) {
          console.error('[Binance] Spot User Data Stream message parse error:', error);
        }
      });

      ws.on('error', (error) => {
        console.error('[Binance] Spot User Data Stream WebSocket error:', error);
      });

      ws.on('close', () => {
        console.log('[Binance] Spot User Data Stream WebSocket closed, reconnecting...');
        this.spotUserDataStream = null;
        // Reconnect after 5 seconds
        setTimeout(() => {
          this.setupSpotUserDataStream().catch(console.error);
        }, 5000);
      });

      this.spotUserDataStream = ws;

      // Keep listen key alive every 30 minutes (Binance requires every 60 minutes, but we do it every 30 for safety)
      if (this.spotListenKeyKeepAliveInterval) {
        clearInterval(this.spotListenKeyKeepAliveInterval);
      }
      this.spotListenKeyKeepAliveInterval = setInterval(() => {
        if (this.spotListenKey) {
          this.keepSpotListenKeyAlive(this.spotListenKey).catch(console.error);
        }
      }, 30 * 60 * 1000); // Every 30 minutes
    } catch (error: any) {
      console.error('[Binance] Failed to setup Spot User Data Stream:', error.message);
      throw error;
    }
  }

  /**
   * Handle Spot User Data Stream messages
   */
  private handleSpotUserDataStreamMessage(message: any): void {
    // Handle execution report (order updates)
    if (message.e === 'executionReport') {
      const executionReport = message;
      
      const orderUpdate = {
        orderId: executionReport.i?.toString() || executionReport.c,
        symbol: executionReport.s,
        side: executionReport.S?.toLowerCase(),
        type: executionReport.o?.toLowerCase(),
        status: this.mapBinanceStatus(executionReport.X),
        price: parseFloat(executionReport.p || '0'),
        quantity: parseFloat(executionReport.q || '0'),
        filledQuantity: parseFloat(executionReport.z || '0'),
        remainingQuantity: parseFloat(executionReport.q || '0') - parseFloat(executionReport.z || '0'),
        timestamp: executionReport.E || Date.now(),
        exchange: this.exchangeName,
        clientOrderId: executionReport.c,
      };

      // Notify callbacks
      this.realtimeCallbacks.forEach((callback) => {
        callback({
          type: 'order',
          data: orderUpdate as any,
        });
      });

      console.log(`[Binance] Order update: ${executionReport.s} ${executionReport.S} ${executionReport.X}`);
    }

    // Handle account position update (balance changes)
    if (message.e === 'outboundAccountPosition') {
      const accountPosition = message;
      
      if (accountPosition.B && Array.isArray(accountPosition.B)) {
        accountPosition.B.forEach((balance: any) => {
          const rawBalance: RawBalance = {
            asset: balance.a,
            free: parseFloat(balance.f || '0'),
            locked: parseFloat(balance.l || '0'),
          };

          const normalized = this.normalizer.normalizeBalance(
            rawBalance,
            this.exchangeName,
            0 // USD price would need to be fetched separately
          );

          this.realtimeCallbacks.forEach((callback) => {
            callback({
              type: 'balance',
              data: normalized,
            });
          });
        });

        console.log(`[Binance] Account balance updated`);
      }
    }
  }
}
