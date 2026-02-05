import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Config endpoints
export const configApi = {
  getRiskConfig: () => api.get('/config/risk'),
  updateRiskConfig: (data: any) => api.put('/config/risk', data),
  getAppConfig: () => api.get('/config/app'),
  updateAppConfig: (data: any) => api.put('/config/app', data),
  getCredentials: () => api.get('/config/credentials'),
  updateCredentials: (data: any) => api.put('/config/credentials', data),
  getBudget: () => api.get('/config/budget'),
};

// Markets endpoints
export const marketsApi = {
  getMonitoredMarkets: () => api.get('/markets'),
  searchMarkets: (query?: string, limit?: number, closesWithin?: string) =>
    api.get('/markets/search', { params: { query, limit, closesWithin } }),
  getTags: () => api.get('/markets/tags'),
  getMarketsByCategory: (tagId: string, limit?: number, closesWithin?: string) =>
    api.get(`/markets/category/${tagId}`, { params: { limit, closesWithin } }),
  getRecurringMarket: (series: string) => api.get(`/markets/recurring/${series}`),
  addMarket: (data: any) => api.post('/markets', data),
  updateMarketStatus: (marketId: string, isActive: boolean) =>
    api.patch(`/markets/${marketId}/status`, { is_active: isActive }),
  getMarketDetails: (marketId: string) => api.get(`/markets/${marketId}/details`),
  getPriceHistory: (marketId: string, limit?: number) =>
    api.get(`/markets/${marketId}/price-history`, { params: { limit } }),
};

// Trades endpoints
export const tradesApi = {
  getAllTrades: (marketId?: string, limit?: number) =>
    api.get('/trades', { params: { market_id: marketId, limit } }),
  getPositions: () => api.get('/trades/positions'),
  clearPositions: () => api.delete('/trades/positions'),
  getResolved: () => api.get('/trades/resolved'),
  getAnalyses: (limit?: number) => api.get('/trades/analyses', { params: { limit } }),
};

// Trading service endpoints
export const tradingApi = {
  getStatus: () => api.get('/trading/status'),
  start: () => api.post('/trading/start'),
  stop: () => api.post('/trading/stop'),
  analyzeMarket: (marketId: string) => api.post(`/trading/analyze/${marketId}`),
};

// Leaderboard endpoints
export const leaderboardApi = {
  getLeaderboard: (category?: string, timePeriod?: string, limit?: number) =>
    api.get('/leaderboard', { params: { category, timePeriod, limit } }),
  getTraderPositions: (address: string, limit?: number) =>
    api.get(`/leaderboard/trader/${address}/positions`, { params: { limit } }),
  getTopPositions: (category?: string, timePeriod?: string, traderLimit?: number, positionsPerTrader?: number) =>
    api.get('/leaderboard/top-positions', { params: { category, timePeriod, traderLimit, positionsPerTrader } }),
};

// Snipe endpoints
export const snipeApi = {
  getStatus: () => api.get('/snipe/status'),
  getPositions: () => api.get('/snipe/positions'),
  getOpenPositions: () => api.get('/snipe/positions/open'),
  execute: () => api.post('/snipe/execute'),
  check: () => api.post('/snipe/check'),
  start: () => api.post('/snipe/start'),
  stop: () => api.post('/snipe/stop'),
  clearPositions: () => api.delete('/snipe/positions'),
  updateSettings: (settings: { snipeSize?: number; profitTarget?: number; snipeEnabled?: boolean }) =>
    api.patch('/snipe/settings', settings),
};

// Spread / Arbitrage endpoints
export const spreadApi = {
  getStatus: () => api.get('/spread/status'),
  getOpportunities: () => api.get('/spread/opportunities'),
  getTrades: (limit?: number) => api.get('/spread/trades', { params: { limit } }),
  getOpenTrades: () => api.get('/spread/trades/open'),
  getTradeStats: () => api.get('/spread/trades/stats'),
  scan: () => api.post('/spread/scan'),
  execute: (opportunityId: number, totalInvestment: number) =>
    api.post(`/spread/execute/${opportunityId}`, { totalInvestment }),
  check: (forceAll = false) => api.post('/spread/check', { forceAll }),
  start: () => api.post('/spread/start'),
  stop: () => api.post('/spread/stop'),
  updateSettings: (settings: {
    spreadEnabled?: boolean;
    scanIntervalSeconds?: number;
    minSpreadThreshold?: number;
    maxSpreadBetSize?: number;
    autoExecute?: boolean;
    scanMultiOutcome?: boolean;
  }) => api.patch('/spread/settings', settings),
  clearTrades: () => api.delete('/spread/trades'),
  clearOpportunities: () => api.delete('/spread/opportunities'),
};

// Account endpoints
export const accountApi = {
  getSummary: () => api.get('/account/summary'),
  getProfile: () => api.get('/account/profile'),
  getBalance: () => api.get('/account/balance'),
  getPositions: () => api.get('/account/positions'),
  getActivity: (limit?: number) => api.get('/account/activity', { params: { limit } }),
  getPnl: () => api.get('/account/pnl'),
};

export default api;
