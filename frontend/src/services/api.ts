import axios from 'axios';

const AUTH_TOKEN_KEY = 'auth_token';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      if (typeof window.__onUnauthorized === 'function') {
        window.__onUnauthorized();
      }
    }
    return Promise.reject(err);
  }
);

export const apiClient = {
  async getPortfolioSnapshot() {
    const response = await client.get('/portfolio/snapshot');
    return response.data;
  },

  async getLatestSnapshot() {
    const response = await client.get('/portfolio/snapshot/latest');
    return response.data;
  },

  async getPortfolioSummary() {
    const response = await client.get('/portfolio/summary');
    return response.data;
  },

  async getExchanges() {
    const response = await client.get('/exchanges');
    return response.data;
  },

  async registerExchange(data: {
    exchange: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    sandbox?: boolean;
  }) {
    const response = await client.post('/exchanges/register', data);
    return response.data;
  },

  async removeExchange(exchange: string) {
    const response = await client.delete(`/exchanges/${exchange}`);
    return response.data;
  },

  async getOrderHistory(params?: { exchange?: string; symbol?: string; limit?: number; market?: string }) {
    const search = new URLSearchParams();
    if (params?.exchange) search.set('exchange', params.exchange);
    if (params?.symbol) search.set('symbol', params.symbol);
    if (params?.limit != null) search.set('limit', String(params.limit));
    if (params?.market) search.set('market', params.market);
    const q = search.toString();
    const response = await client.get(`/trade/history${q ? `?${q}` : ''}`);
    return response.data;
  },

  async getTradeHistory(params?: { exchange?: string; symbol?: string; limit?: number; market?: string }) {
    const search = new URLSearchParams();
    if (params?.exchange) search.set('exchange', params.exchange);
    if (params?.symbol) search.set('symbol', params.symbol);
    if (params?.limit != null) search.set('limit', String(params.limit));
    if (params?.market) search.set('market', params.market);
    const q = search.toString();
    const response = await client.get(`/trade/trades${q ? `?${q}` : ''}`);
    return response.data;
  },

  async getTradeExchanges() {
    const response = await client.get('/trade/exchanges');
    return response.data;
  },

  async getOpenOrders(exchange: string, symbol?: string) {
    const params: Record<string, string> = { exchange };
    if (symbol) params.symbol = symbol;
    const q = new URLSearchParams(params).toString();
    const response = await client.get(`/trade/open-orders?${q}`);
    return response.data;
  },

  async placeOrder(body: {
    exchange: string;
    symbol: string;
    side: string;
    type: string;
    quantity: number;
    price?: number;
    market?: string;
    leverage?: number;
    reduceOnly?: boolean;
    timeInForce?: string;
    postOnly?: boolean;
  }) {
    const response = await client.post('/trade/order', body);
    return response.data;
  },

  async cancelOrder(exchange: string, orderId: string, symbol: string) {
    const response = await client.post('/trade/cancel', { exchange, orderId, symbol });
    return response.data;
  },

  async cancelAllOrders(exchange: string, symbol?: string) {
    const response = await client.post('/trade/cancel-all', { exchange, symbol });
    return response.data;
  },

  async getTransactions(exchange: string, limit?: number, market?: string, symbol?: string) {
    const search = new URLSearchParams();
    if (exchange) search.set('exchange', exchange);
    if (limit != null) search.set('limit', String(limit));
    if (market) search.set('market', market);
    if (symbol) search.set('symbol', symbol);
    const q = search.toString();
    const response = await client.get(`/trade/transactions${q ? `?${q}` : ''}`);
    return response.data;
  },

  async getAssets(exchange: string, market?: string) {
    const search = new URLSearchParams();
    if (exchange) search.set('exchange', exchange);
    if (market) search.set('market', market);
    const q = search.toString();
    const response = await client.get(`/trade/assets${q ? `?${q}` : ''}`);
    return response.data;
  },
};
