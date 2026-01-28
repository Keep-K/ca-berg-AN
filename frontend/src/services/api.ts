import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
};
