/**
 * REST API Routes (protected by JWT; per-user PM/EE via UserContextService)
 */

import { Router, Request, Response } from 'express';
import { EventBus } from '../realtime/eventBus';
import { UserContextService } from '../auth/userContextService';
import { ExchangeCredentials, OrderParams } from '../types';
import { orderStore } from '../execution/orderStore';
import { requireAuth } from './jwtMiddleware';

export function createRoutes(eventBus: EventBus, userContextService: UserContextService): Router {
  const router = Router();

  /**
   * GET /api/health — no auth
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
    });
  });

  // All routes below require JWT
  router.use(requireAuth);

  /**
   * GET /api/portfolio/snapshot
   */
  router.get('/portfolio/snapshot', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      const snapshot = await portfolioManager.fetchPortfolioSnapshot();
      res.json(snapshot);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/portfolio/snapshot/latest
   */
  router.get('/portfolio/snapshot/latest', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      let snapshot = portfolioManager.getLatestSnapshot();
      if (!snapshot) {
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
   */
  router.get('/portfolio/summary', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      const snapshot = portfolioManager.getLatestSnapshot();
      if (!snapshot) {
        return res.status(404).json({ error: 'No snapshot available' });
      }
      const PortfolioAggregator = (await import('../portfolio/aggregator')).PortfolioAggregator;
      const portfolioAggregator = new PortfolioAggregator();
      const summary = portfolioAggregator.getPortfolioSummary(snapshot);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/exchanges
   */
  router.get('/exchanges', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      res.json({ exchanges: portfolioManager.getRegisteredExchanges() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/trade/exchanges
   */
  router.get('/trade/exchanges', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const executionEngine = await userContextService.getExecutionEngine(userId);
      res.json({ exchanges: executionEngine.getRegisteredExchanges() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/exchanges/register
   */
  router.post('/exchanges/register', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { exchange, apiKey, apiSecret, passphrase, sandbox } = req.body;
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
      if (credentials.exchange !== 'binance') {
        return res.status(400).json({ error: `Unsupported exchange: ${exchange}` });
      }
      await userContextService.registerExchange(userId, credentials);
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      try {
        await portfolioManager.fetchPortfolioSnapshot();
      } catch (e) {
        // optional
      }
      res.json({
        success: true,
        exchange: 'binance',
        message: 'Exchange registered successfully',
      });
    } catch (error: any) {
      console.error('[API] Register exchange error:', error);
      if (error.message?.includes('Connection test failed') || error.message?.includes('401')) {
        return res.status(400).json({ error: 'Connection test failed', details: error.message });
      }
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  /**
   * DELETE /api/exchanges/:exchange
   */
  router.delete('/exchanges/:exchange', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const exchange = req.params.exchange.toLowerCase();
      await userContextService.removeExchange(userId, exchange);
      res.json({ success: true, message: `${exchange} disconnected successfully` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/trade/order
   */
  router.post('/trade/order', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const executionEngine = await userContextService.getExecutionEngine(userId);
      const { exchange, ...orderParams } = req.body;
      if (!exchange) return res.status(400).json({ error: 'Exchange is required' });
      if (!orderParams.symbol || !orderParams.side || !orderParams.type || !orderParams.quantity) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['symbol', 'side', 'type', 'quantity'],
        });
      }
      if (orderParams.type === 'limit' && !orderParams.price) {
        return res.status(400).json({ error: 'Price is required for limit orders' });
      }
      if (orderParams.leverage !== undefined) {
        const leverageNum = parseInt(orderParams.leverage, 10);
        if (Number.isNaN(leverageNum) || leverageNum < 1 || leverageNum > 125) {
          return res.status(400).json({ error: 'Leverage must be between 1 and 125' });
        }
      }
      const order: OrderParams = {
        symbol: orderParams.symbol.toUpperCase(),
        side: orderParams.side.toLowerCase() as 'buy' | 'sell',
        type: orderParams.type.toLowerCase() as 'market' | 'limit',
        quantity: parseFloat(orderParams.quantity),
        price: orderParams.price ? parseFloat(orderParams.price) : undefined,
        market: orderParams.market === 'futures' ? 'futures' : 'spot',
        leverage: orderParams.leverage ? parseInt(orderParams.leverage, 10) : undefined,
        reduceOnly: orderParams.reduceOnly || false,
        timeInForce: orderParams.timeInForce || 'GTC',
        stopPrice: orderParams.stopPrice ? parseFloat(orderParams.stopPrice) : undefined,
        postOnly: orderParams.postOnly || false,
      };
      const result = await executionEngine.placeOrder(exchange, order);
      res.json(result);
    } catch (error: any) {
      console.error('[API] Error placing order:', error);
      res.status(400).json({ error: error.message || 'Failed to place order' });
    }
  });

  /**
   * POST /api/trade/cancel
   */
  router.post('/trade/cancel', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const executionEngine = await userContextService.getExecutionEngine(userId);
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
   */
  router.post('/trade/cancel-all', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const executionEngine = await userContextService.getExecutionEngine(userId);
      const { exchange, symbol } = req.body;
      if (!exchange) return res.status(400).json({ error: 'Exchange is required' });
      await executionEngine.cancelAllOrders(exchange, symbol);
      res.json({ success: true, message: 'All orders canceled successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/trade/open-orders
   */
  router.get('/trade/open-orders', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const executionEngine = await userContextService.getExecutionEngine(userId);
      const { exchange, symbol } = req.query;
      if (!exchange) return res.status(400).json({ error: 'Exchange is required' });
      const orders = await executionEngine.getOpenOrders(
        exchange as string,
        symbol as string | undefined
      );
      res.json({ orders });
    } catch (error: any) {
      console.error('[API] Error fetching open orders:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch open orders' });
    }
  });

  /**
   * GET /api/trade/history
   */
  router.get('/trade/history', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { exchange, symbol, limit, market } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 100;

      if (exchange && symbol && market) {
        const executionEngine = await userContextService.getExecutionEngine(userId);
        const connector = executionEngine.getConnector(exchange as string) as any;
        if (connector && typeof connector.fetchOrderHistory === 'function') {
          const orders = await connector.fetchOrderHistory(symbol as string, market as 'spot' | 'futures', limitNum);
          return res.json({ orders });
        }
      }

      const orders = await orderStore.getOrderHistory(
        userId,
        exchange as string | undefined,
        symbol as string | undefined,
        limitNum
      );
      res.json({ orders });
    } catch (error: any) {
      console.error('[API] Error fetching order history:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch order history' });
    }
  });

  /**
   * GET /api/trade/trades
   */
  router.get('/trade/trades', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { exchange, symbol, limit, market } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 100;

      if (exchange && symbol && market) {
        const executionEngine = await userContextService.getExecutionEngine(userId);
        const connector = executionEngine.getConnector(exchange as string) as any;
        if (connector && typeof connector.fetchTradesBySymbol === 'function') {
          const trades = await connector.fetchTradesBySymbol(symbol as string, market as 'spot' | 'futures', limitNum);
          return res.json({ trades });
        }
      }

      const trades = await orderStore.getTradeHistory(
        userId,
        exchange as string | undefined,
        symbol as string | undefined,
        limitNum
      );
      res.json({ trades });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/trade/transactions
   */
  router.get('/trade/transactions', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { exchange, limit, market, symbol } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 20;
      if (!exchange) return res.status(400).json({ error: 'Exchange is required' });

      const executionEngine = await userContextService.getExecutionEngine(userId);
      const connector = executionEngine.getConnector(exchange as string) as any;
      if (market === 'futures' && connector && typeof connector.fetchFuturesIncome === 'function') {
        const transactions = await connector.fetchFuturesIncome(limitNum);
        return res.json({ transactions });
      }
      if (market === 'spot' && connector && typeof connector.fetchTradesBySymbol === 'function') {
        if (!symbol) return res.status(400).json({ error: 'Symbol is required for spot transactions' });
        const trades = await connector.fetchTradesBySymbol(symbol as string, 'spot', limitNum);
        const transactions = trades.map((t: any) => ({
          time: t.timestamp,
          exchange: exchange,
          type: 'Trade',
          asset: t.symbol,
          amount: t.quantity,
          status: 'Completed',
          txid: t.tradeId,
          symbol: t.symbol,
        }));
        return res.json({ transactions });
      }
      res.status(400).json({ error: 'Transactions not supported for this exchange' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch transactions' });
    }
  });

  /**
   * GET /api/trade/assets
   */
  router.get('/trade/assets', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const { exchange, market } = req.query;
      if (!exchange) return res.status(400).json({ error: 'Exchange is required' });

      const executionEngine = await userContextService.getExecutionEngine(userId);
      const connector = executionEngine.getConnector(exchange as string) as any;
      if (market === 'futures' && connector && typeof connector.fetchFuturesAssets === 'function') {
        const assets = await connector.fetchFuturesAssets();
        return res.json({ assets });
      }
      if (market === 'spot' && connector && typeof connector.fetchSpotAssets === 'function') {
        const assets = await connector.fetchSpotAssets();
        return res.json({ assets });
      }
      res.status(400).json({ error: 'Assets not supported for this exchange' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch assets' });
    }
  });

  /**
   * GET /api/binance/account
   */
  router.get('/binance/account', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      const binanceConnector = portfolioManager.getConnector('binance') as any;
      if (!binanceConnector) {
        return res.status(400).json({
          error: 'Binance connector not registered',
          suggestion: 'Please register Binance exchange first via POST /api/exchanges/register',
        });
      }
      const balances = await binanceConnector.fetchBalances();
      const totalValue = balances.reduce((sum: number, b: any) => {
        return sum + (b.free + b.locked) * (b.usdPrice || 0);
      }, 0);
      res.json({ balances, totalValue, exchange: 'binance' });
    } catch (error: any) {
      console.error('[API] Error fetching Binance account:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch account information' });
    }
  });

  /**
   * POST /api/binance/order
   */
  router.post('/binance/order', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const executionEngine = await userContextService.getExecutionEngine(userId);
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      const { symbol, side, type, quantity, price, timeInForce } = req.body;
      if (!symbol || !side || !type || !quantity) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['symbol', 'side', 'type', 'quantity'],
        });
      }
      if (type === 'LIMIT' && !price) {
        return res.status(400).json({ error: 'Price is required for LIMIT orders' });
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
      const result = await executionEngine.placeOrder('binance', orderParams);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('[API] Error placing Binance order:', error);
      res.status(400).json({ error: error.message || 'Failed to place order' });
    }
  });

  /**
   * POST /api/binance/listen-key
   */
  router.post('/binance/listen-key', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      const binanceConnector = portfolioManager.getConnector('binance') as any;
      if (!binanceConnector) {
        return res.status(400).json({
          error: 'Binance connector not registered',
          suggestion: 'Please register Binance exchange first',
        });
      }
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
      res.status(400).json({ error: error.message || 'Failed to get listen key' });
    }
  });

  /**
   * PUT /api/binance/listen-key
   */
  router.put('/binance/listen-key', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      const { listenKey } = req.body;
      if (!listenKey) return res.status(400).json({ error: 'listenKey is required' });
      const binanceConnector = portfolioManager.getConnector('binance') as any;
      if (!binanceConnector) return res.status(400).json({ error: 'Binance connector not registered' });
      await binanceConnector.keepSpotListenKeyAlive(listenKey);
      res.json({ success: true, message: 'Listen key kept alive' });
    } catch (error: any) {
      console.error('[API] Error keeping listen key alive:', error);
      res.status(400).json({ error: error.message || 'Failed to keep listen key alive' });
    }
  });

  /**
   * DELETE /api/binance/listen-key
   */
  router.delete('/binance/listen-key', async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      const portfolioManager = await userContextService.getPortfolioManager(userId);
      const { listenKey } = req.query;
      if (!listenKey) return res.status(400).json({ error: 'listenKey is required' });
      const binanceConnector = portfolioManager.getConnector('binance') as any;
      if (!binanceConnector) return res.status(400).json({ error: 'Binance connector not registered' });
      await binanceConnector.closeSpotUserDataStream(listenKey as string);
      res.json({ success: true, message: 'User Data Stream closed' });
    } catch (error: any) {
      console.error('[API] Error closing User Data Stream:', error);
      res.status(400).json({ error: error.message || 'Failed to close User Data Stream' });
    }
  });

  return router;
}
