/**
 * REST API Routes
 */

import { Router, Request, Response } from 'express';
import { PortfolioManager } from '../portfolio/manager';
import { RealtimeMonitor } from '../realtime/monitor';
import { EventBus } from '../realtime/eventBus';
import { ExecutionEngine } from '../execution/executor';
import { BinanceConnector } from '../connectors/binance';
import { ExchangeCredentials, OrderParams } from '../types';
import { orderStore } from '../execution/orderStore';

export function createRoutes(
  portfolioManager: PortfolioManager,
  monitor: RealtimeMonitor,
  eventBus: EventBus,
  executionEngine: ExecutionEngine
): Router {
  const router = Router();

  /**
   * GET /api/portfolio/snapshot
   * Get current portfolio snapshot
   */
  router.get('/portfolio/snapshot', async (req: Request, res: Response) => {
    try {
      const snapshot = await portfolioManager.fetchPortfolioSnapshot();
      res.json(snapshot);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/portfolio/snapshot/latest
   * Get latest cached portfolio snapshot, or fetch new one if not available
   */
  router.get('/portfolio/snapshot/latest', async (req: Request, res: Response) => {
    try {
      let snapshot = portfolioManager.getLatestSnapshot();
      
      // If no snapshot exists, fetch a new one
      if (!snapshot) {
        console.log('[API] No snapshot available, fetching new snapshot...');
        snapshot = await portfolioManager.fetchPortfolioSnapshot();
      }
      
      res.json(snapshot);
    } catch (error: any) {
      console.error('[API] Error getting snapshot:', error);
      res.status(500).json({ error: error.message || 'Failed to get snapshot' });
    }
  });

  /**
   * GET /api/portfolio/summary
   * Get portfolio summary statistics
   */
  router.get('/portfolio/summary', (req: Request, res: Response) => {
    const snapshot = portfolioManager.getLatestSnapshot();
    if (!snapshot) {
      return res.status(404).json({ error: 'No snapshot available' });
    }

    const aggregator = require('../portfolio/aggregator').PortfolioAggregator;
    const portfolioAggregator = new aggregator();
    const summary = portfolioAggregator.getPortfolioSummary(snapshot);

    res.json(summary);
  });

  /**
   * GET /api/exchanges
   * Get list of registered exchanges
   */
  router.get('/exchanges', (req: Request, res: Response) => {
    const exchanges = portfolioManager.getRegisteredExchanges();
    res.json({ exchanges });
  });

  /**
   * GET /api/trade/exchanges
   * Get list of exchanges that support trading
   */
  router.get('/trade/exchanges', (req: Request, res: Response) => {
    const tradingExchanges = executionEngine.getRegisteredExchanges();
    res.json({ exchanges: tradingExchanges });
  });

  /**
   * POST /api/exchanges/register
   * Register a new exchange connector
   */
  router.post('/exchanges/register', async (req: Request, res: Response) => {
    try {
      const { exchange, apiKey, apiSecret, passphrase, sandbox } = req.body;

      console.log(`[API] Registering exchange: ${exchange}, sandbox: ${sandbox}`);

      if (!exchange || !apiKey || !apiSecret) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: 'Exchange, API Key, and API Secret are required',
        });
      }

      const credentials: ExchangeCredentials = {
        exchange: exchange.toLowerCase(),
        apiKey,
        apiSecret,
        passphrase,
        sandbox: sandbox || false,
      };

      let connector;
      try {
        switch (exchange.toLowerCase()) {
          case 'binance':
            connector = new BinanceConnector(credentials);
            console.log(`[API] BinanceConnector created successfully`);
            break;
          default:
            return res.status(400).json({ error: `Unsupported exchange: ${exchange}` });
        }
      } catch (connectorError: any) {
        console.error(`[API] Error creating connector:`, connectorError);
        return res.status(500).json({
          error: 'Failed to create connector',
          details: connectorError.message,
          stack: process.env.NODE_ENV === 'development' ? connectorError.stack : undefined,
        });
      }

      // Test connection
      try {
        console.log(`[API] Testing connection for ${exchange}...`);
        await connector.testConnection();
        console.log(`[API] Connection test passed`);
      } catch (error: any) {
        console.error(`[API] Connection test failed:`, error);
        return res.status(400).json({
          error: 'Connection test failed',
          details: error.message,
        });
      }

      // Register connector for portfolio monitoring
      try {
        portfolioManager.registerConnector(connector);
        console.log(`[API] Connector registered with PortfolioManager`);
      } catch (regError: any) {
        console.error(`[API] Error registering connector:`, regError);
        return res.status(500).json({
          error: 'Failed to register connector',
          details: regError.message,
        });
      }

      // Register connector for trading execution (if it implements TradingConnector)
      try {
        const connectorAny = connector as any;
        const hasTradingMethods = 
          typeof connectorAny.placeOrder === 'function' &&
          typeof connectorAny.cancelOrder === 'function' &&
          typeof connectorAny.getOpenOrders === 'function';
        
        if (hasTradingMethods) {
          executionEngine.registerConnector(connectorAny);
          console.log(`[API] ✓ Successfully registered ${exchange} for trading execution`);
        }
      } catch (execError: any) {
        console.warn(`[API] Failed to register ${exchange} for trading:`, execError.message);
      }

      // Setup real-time updates
      try {
        await connector.subscribeRealtimeUpdates((update) => {
          eventBus.publishUpdate(update);
        });
        console.log(`[API] Real-time updates subscribed`);
      } catch (realtimeError: any) {
        console.warn(`[API] Failed to setup real-time updates:`, realtimeError.message);
        // Continue anyway - REST API still works
      }

      // For Binance, also setup Spot User Data Stream
      if (exchange.toLowerCase() === 'binance' && typeof (connector as any).setupSpotUserDataStream === 'function') {
        try {
          await (connector as any).setupSpotUserDataStream();
          console.log(`[API] ✓ Binance Spot User Data Stream initialized`);
        } catch (spotStreamError: any) {
          console.warn(`[API] ⚠️  Binance Spot User Data Stream setup failed:`, spotStreamError.message);
          // Continue anyway - REST API still works
        }
      }

      // Immediately fetch a snapshot after registering exchange
      try {
        console.log(`[API] Fetching initial snapshot after exchange registration...`);
        await portfolioManager.fetchPortfolioSnapshot();
        console.log(`[API] Initial snapshot created successfully`);
      } catch (snapshotError: any) {
        console.warn(`[API] Failed to create initial snapshot:`, snapshotError.message);
        // Continue anyway - snapshot will be created by periodic update
      }

      res.json({
        success: true,
        exchange: connector.exchangeName,
        message: 'Exchange registered successfully',
      });
    } catch (error: any) {
      console.error(`[API] Unexpected error in register exchange:`, error);
      res.status(500).json({ 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });

  /**
   * DELETE /api/exchanges/:exchange
   * Remove an exchange connector
   */
  router.delete('/exchanges/:exchange', (req: Request, res: Response) => {
    try {
      const exchange = req.params.exchange.toLowerCase();
      
      // Remove from portfolio manager
      portfolioManager.removeConnector(exchange);
      
      // Remove from execution engine if registered
      try {
        const executionEngineRemove = (executionEngine as any).removeConnector;
        if (typeof executionEngineRemove === 'function') {
          executionEngineRemove(exchange);
        }
      } catch (execError) {
        console.warn(`[API] Failed to remove ${exchange} from execution engine:`, execError);
      }

      res.json({
        success: true,
        message: `${exchange} disconnected successfully`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/trade/order
   * Place a new order
   */
  router.post('/trade/order', async (req: Request, res: Response) => {
    try {
      const { exchange, ...orderParams } = req.body;

      console.log(`[API] Place order request:`, { exchange, ...orderParams });

      if (!exchange) {
        return res.status(400).json({ error: 'Exchange is required' });
      }

      if (!orderParams.symbol || !orderParams.side || !orderParams.type || !orderParams.quantity) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['symbol', 'side', 'type', 'quantity'],
          received: Object.keys(orderParams),
        });
      }

      if (orderParams.type === 'limit' && !orderParams.price) {
        return res.status(400).json({ error: 'Price is required for limit orders' });
      }

      if (typeof orderParams.quantity !== 'number' || orderParams.quantity <= 0) {
        return res.status(400).json({ error: 'Quantity must be a positive number' });
      }

      if (orderParams.price && (typeof orderParams.price !== 'number' || orderParams.price <= 0)) {
        return res.status(400).json({ error: 'Price must be a positive number' });
      }

      const order: OrderParams = {
        symbol: orderParams.symbol.toUpperCase(),
        side: orderParams.side.toLowerCase() as 'buy' | 'sell',
        type: orderParams.type.toLowerCase() as 'market' | 'limit',
        quantity: parseFloat(orderParams.quantity),
        price: orderParams.price ? parseFloat(orderParams.price) : undefined,
        market: orderParams.market === 'futures' ? 'futures' : 'spot',
        reduceOnly: orderParams.reduceOnly || false,
        timeInForce: orderParams.timeInForce || 'GTC',
        stopPrice: orderParams.stopPrice ? parseFloat(orderParams.stopPrice) : undefined,
        postOnly: orderParams.postOnly || false,
      };

      console.log(`[API] Processed order params:`, order);

      const result = await executionEngine.placeOrder(exchange, order);
      res.json(result);
    } catch (error: any) {
      console.error(`[API] Error placing order:`, error);
      res.status(400).json({ 
        error: error.message || 'Failed to place order',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });

  /**
   * POST /api/trade/cancel
   * Cancel an order
   */
  router.post('/trade/cancel', async (req: Request, res: Response) => {
    try {
      const { exchange, orderId, symbol } = req.body;

      if (!exchange || !orderId || !symbol) {
        return res.status(400).json({ error: 'Exchange, orderId, and symbol are required' });
      }

      await executionEngine.cancelOrder(exchange, orderId, symbol);
      res.json({ success: true, message: 'Order canceled successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/trade/cancel-all
   * Cancel all open orders
   */
  router.post('/trade/cancel-all', async (req: Request, res: Response) => {
    try {
      const { exchange, symbol } = req.body;

      if (!exchange) {
        return res.status(400).json({ error: 'Exchange is required' });
      }

      await executionEngine.cancelAllOrders(exchange, symbol);
      res.json({ success: true, message: 'All orders canceled successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/trade/open-orders
   * Get open orders
   */
  router.get('/trade/open-orders', async (req: Request, res: Response) => {
    try {
      const { exchange, symbol } = req.query;

      if (!exchange) {
        return res.status(400).json({ error: 'Exchange is required' });
      }

      const orders = await executionEngine.getOpenOrders(
        exchange as string,
        symbol as string | undefined
      );
      
      res.json({ orders });
    } catch (error: any) {
      console.error('[API] Error fetching open orders:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to fetch open orders',
        registeredExchanges: executionEngine.getRegisteredExchanges(),
      });
    }
  });

  /**
   * GET /api/trade/history
   * Get order history
   */
  router.get('/trade/history', async (req: Request, res: Response) => {
    try {
      const { exchange, symbol, limit } = req.query;

      const orders = await orderStore.getOrderHistory(
        exchange as string | undefined,
        symbol as string | undefined,
        limit ? parseInt(limit as string) : 100
      );
      res.json({ orders });
    } catch (error: any) {
      console.error('[API] Error fetching order history:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to fetch order history',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });

  /**
   * GET /api/trade/trades
   * Get trade history (fills)
   */
  router.get('/trade/trades', async (req: Request, res: Response) => {
    try {
      const { exchange, symbol, limit } = req.query;

      const trades = await orderStore.getTradeHistory(
        exchange as string | undefined,
        symbol as string | undefined,
        limit ? parseInt(limit as string) : 100
      );
      res.json({ trades });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/binance/account
   * Get Binance Spot account information
   */
  router.get('/binance/account', async (req: Request, res: Response) => {
    try {
      const binanceConnector = portfolioManager.getConnector('binance') as any;
      
      if (!binanceConnector) {
        return res.status(400).json({ 
          error: 'Binance connector not registered',
          suggestion: 'Please register Binance exchange first via POST /api/exchanges/register',
        });
      }

      const balances = await binanceConnector.fetchBalances();
      
      // Calculate total USD value (simplified - would need price data)
      const totalValue = balances.reduce((sum: number, b: any) => {
        return sum + (b.free + b.locked) * (b.usdPrice || 0);
      }, 0);

      res.json({
        balances,
        totalValue,
        exchange: 'binance',
      });
    } catch (error: any) {
      console.error('[API] Error fetching Binance account:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to fetch account information',
      });
    }
  });

  /**
   * POST /api/binance/order
   * Place a Binance Spot order
   */
  router.post('/binance/order', async (req: Request, res: Response) => {
    try {
      const { symbol, side, type, quantity, price, timeInForce } = req.body;

      if (!symbol || !side || !type || !quantity) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['symbol', 'side', 'type', 'quantity'],
        });
      }

      if (type === 'LIMIT' && !price) {
        return res.status(400).json({ 
          error: 'Price is required for LIMIT orders',
        });
      }

      const binanceConnector = executionEngine.getConnector('binance');

      if (!binanceConnector) {
        return res.status(400).json({ 
          error: 'Binance connector not registered for trading',
          suggestion: 'Please register Binance exchange with trading permissions',
        });
      }

      const orderParams: OrderParams = {
        symbol: symbol.replace('/', ''),
        side: side.toLowerCase() as 'buy' | 'sell',
        type: type.toLowerCase() as 'market' | 'limit',
        quantity: parseFloat(quantity),
        price: price ? parseFloat(price) : undefined,
        timeInForce: timeInForce || 'GTC',
      };

      console.log(`[API] Placing Binance Spot order:`, orderParams);

      const result = await executionEngine.placeOrder('binance', orderParams);
      
      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[API] Error placing Binance order:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to place order',
      });
    }
  });

  /**
   * POST /api/binance/listen-key
   * Get or refresh Binance Spot User Data Stream listen key
   */
  router.post('/binance/listen-key', async (req: Request, res: Response) => {
    try {
      const binanceConnector = portfolioManager.getConnector('binance') as any;
      
      if (!binanceConnector) {
        return res.status(400).json({ 
          error: 'Binance connector not registered',
          suggestion: 'Please register Binance exchange first',
        });
      }

      // Setup Spot User Data Stream if not already set up
      if (typeof binanceConnector.setupSpotUserDataStream === 'function') {
        await binanceConnector.setupSpotUserDataStream();
      }

      const listenKey = await binanceConnector.getSpotUserDataStreamListenKey();
      
      res.json({
        success: true,
        listenKey,
        wsUrl: binanceConnector.credentials?.sandbox
          ? `wss://testnet.binance.vision/ws/${listenKey}`
          : `wss://stream.binance.com:9443/ws/${listenKey}`,
      });
    } catch (error: any) {
      console.error('[API] Error getting Binance listen key:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to get listen key',
      });
    }
  });

  /**
   * PUT /api/binance/listen-key
   * Keep Binance Spot User Data Stream listen key alive
   */
  router.put('/binance/listen-key', async (req: Request, res: Response) => {
    try {
      const { listenKey } = req.body;

      if (!listenKey) {
        return res.status(400).json({ 
          error: 'listenKey is required',
        });
      }

      const binanceConnector = portfolioManager.getConnector('binance') as any;
      
      if (!binanceConnector) {
        return res.status(400).json({ 
          error: 'Binance connector not registered',
        });
      }

      await binanceConnector.keepSpotListenKeyAlive(listenKey);
      
      res.json({
        success: true,
        message: 'Listen key kept alive',
      });
    } catch (error: any) {
      console.error('[API] Error keeping listen key alive:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to keep listen key alive',
      });
    }
  });

  /**
   * DELETE /api/binance/listen-key
   * Close Binance Spot User Data Stream
   */
  router.delete('/binance/listen-key', async (req: Request, res: Response) => {
    try {
      const { listenKey } = req.query;

      if (!listenKey) {
        return res.status(400).json({ 
          error: 'listenKey is required',
        });
      }

      const binanceConnector = portfolioManager.getConnector('binance') as any;
      
      if (!binanceConnector) {
        return res.status(400).json({ 
          error: 'Binance connector not registered',
        });
      }

      await binanceConnector.closeSpotUserDataStream(listenKey as string);
      
      res.json({
        success: true,
        message: 'User Data Stream closed',
      });
    } catch (error: any) {
      console.error('[API] Error closing User Data Stream:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to close User Data Stream',
      });
    }
  });

  /**
   * GET /api/health
   * Health check endpoint
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      exchanges: portfolioManager.getRegisteredExchanges(),
      tradingEnabled: executionEngine.getRegisteredExchanges().length > 0,
    });
  });

  return router;
}
