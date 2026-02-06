import { useState, useEffect } from 'react';
import { Search, TrendingUp, DollarSign, RefreshCw, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { tradeApi, configApi } from '../services/api';
import { Link } from 'react-router-dom';

interface Market {
  id: string;
  conditionId: string;
  question: string;
  slug: string;
  endDate: string;
  liquidity: number;
  volume24hr: number;
  outcomePrices: string | number[];
  clobTokenIds: string | string[];
}

interface MarketDetails {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  slug: string;
  endDate: string;
  liquidity: number;
  volume24hr: number;
  yesPrice: number;
  noPrice: number;
  yesTokenId: string;
  noTokenId: string;
}

export default function Trade() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Market[]>([]);
  const [trendingMarkets, setTrendingMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<MarketDetails | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO' | null>(null);
  const [amount, setAmount] = useState<string>('10');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [isPaperMode, setIsPaperMode] = useState<boolean | null>(null);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [trendingRes, configRes] = await Promise.all([
        tradeApi.trending(),
        configApi.getAppConfig(),
      ]);
      setTrendingMarkets(trendingRes.data.data || []);
      setIsPaperMode(configRes.data.data?.paper_trading_mode === 1);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setSearching(true);
    setError(null);
    try {
      const res = await tradeApi.search(searchQuery);
      setSearchResults(res.data.data || []);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMarket = async (market: Market) => {
    setLoading(true);
    setError(null);
    setOrderResult(null);
    setSelectedOutcome(null);
    try {
      const res = await tradeApi.getMarket(market.id);
      setSelectedMarket(res.data.data);
    } catch (err) {
      console.error('Failed to load market details:', err);
      setError('Failed to load market details.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTrade = async () => {
    if (!selectedMarket || !selectedOutcome || !amount) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 1) {
      setError('Minimum order amount is $1');
      return;
    }

    setExecuting(true);
    setError(null);
    setOrderResult(null);

    try {
      const tokenId = selectedOutcome === 'YES'
        ? selectedMarket.yesTokenId
        : selectedMarket.noTokenId;

      const res = await tradeApi.execute({
        marketId: selectedMarket.id,
        tokenId,
        outcome: selectedOutcome,
        amount: amountNum,
      });

      setOrderResult(res.data.data);
    } catch (err: any) {
      console.error('Trade execution failed:', err);
      setError(err.response?.data?.error || 'Trade execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const parsePrice = (market: Market, index: number): number => {
    if (!market.outcomePrices) return 0.5;
    const prices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : market.outcomePrices;
    return parseFloat(prices[index]) || 0.5;
  };

  const formatMoney = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const calculatePotentialWin = () => {
    if (!selectedMarket || !selectedOutcome || !amount) return 0;
    const amountNum = parseFloat(amount) || 0;
    const price = selectedOutcome === 'YES' ? selectedMarket.yesPrice : selectedMarket.noPrice;
    if (price <= 0) return 0;
    const shares = amountNum / price;
    return shares - amountNum; // Profit if wins ($1 per share - cost)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-green-500" />
          <h1 className="text-2xl font-bold text-gray-900">Trade</h1>
        </div>
        <button
          onClick={loadInitialData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Paper Mode Warning */}
      {isPaperMode && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
            <p className="text-yellow-800">
              <strong>Paper Trading Mode:</strong> Orders will be simulated.{' '}
              <Link to="/settings" className="underline hover:text-yellow-900">
                Switch to Live Mode
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search markets..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || searchQuery.length < 2}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Order Result */}
      {orderResult && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <div>
              <p className="text-green-800 font-medium">
                Order {orderResult.isPaperTrade ? '(Paper)' : ''} Placed Successfully!
              </p>
              <p className="text-green-700 text-sm">
                {orderResult.outcome} ${orderResult.amount} - Order ID: {orderResult.orderId?.slice(0, 20)}...
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market List */}
        <div className="space-y-4">
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Search Results</h2>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto">
                {searchResults.map((market) => (
                  <button
                    key={market.id}
                    onClick={() => handleSelectMarket(market)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedMarket?.id === market.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900 line-clamp-2">{market.question}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="text-green-600 font-medium">
                        Yes {(parsePrice(market, 0) * 100).toFixed(0)}¢
                      </span>
                      <span className="text-red-600 font-medium">
                        No {(parsePrice(market, 1) * 100).toFixed(0)}¢
                      </span>
                      <span>Vol: {formatMoney(market.volume24hr)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending Markets */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Trending Markets</h2>
            </div>
            {loading && trendingMarkets.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {trendingMarkets.map((market) => (
                  <button
                    key={market.id}
                    onClick={() => handleSelectMarket(market)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedMarket?.id === market.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900 line-clamp-2">{market.question}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="text-green-600 font-medium">
                        Yes {(parsePrice(market, 0) * 100).toFixed(0)}¢
                      </span>
                      <span className="text-red-600 font-medium">
                        No {(parsePrice(market, 1) * 100).toFixed(0)}¢
                      </span>
                      <span>Vol: {formatMoney(market.volume24hr)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trade Panel */}
        <div className="bg-white rounded-lg shadow">
          {selectedMarket ? (
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedMarket.question}</h2>
                {selectedMarket.description && (
                  <p className="text-sm text-gray-600 line-clamp-3">{selectedMarket.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <span>Liquidity: {formatMoney(selectedMarket.liquidity)}</span>
                  <span>24h Vol: {formatMoney(selectedMarket.volume24hr)}</span>
                  <a
                    href={`https://polymarket.com/event/${selectedMarket.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Outcome Selection */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setSelectedOutcome('YES')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedOutcome === 'YES'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <p className="text-lg font-bold text-green-600">YES</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(selectedMarket.yesPrice * 100).toFixed(1)}¢
                  </p>
                </button>
                <button
                  onClick={() => setSelectedOutcome('NO')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedOutcome === 'NO'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-red-300'
                  }`}
                >
                  <p className="text-lg font-bold text-red-600">NO</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(selectedMarket.noPrice * 100).toFixed(1)}¢
                  </p>
                </button>
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (USDC)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="1"
                    step="1"
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[5, 10, 25, 50, 100].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmount(val.toString())}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              {selectedOutcome && amount && parseFloat(amount) > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">You pay</span>
                    <span className="font-medium">${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Shares</span>
                    <span className="font-medium">
                      {(parseFloat(amount) / (selectedOutcome === 'YES' ? selectedMarket.yesPrice : selectedMarket.noPrice)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Potential profit</span>
                    <span className="font-medium text-green-600">
                      +${calculatePotentialWin().toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <button
                onClick={handleExecuteTrade}
                disabled={!selectedOutcome || !amount || parseFloat(amount) < 1 || executing}
                className={`w-full py-4 rounded-lg text-white font-bold text-lg transition-colors ${
                  selectedOutcome === 'YES'
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400'
                    : selectedOutcome === 'NO'
                    ? 'bg-red-600 hover:bg-red-700 disabled:bg-gray-400'
                    : 'bg-gray-400'
                }`}
              >
                {executing ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Placing Order...
                  </span>
                ) : selectedOutcome ? (
                  `Buy ${selectedOutcome} for $${parseFloat(amount || '0').toFixed(2)}`
                ) : (
                  'Select YES or NO'
                )}
              </button>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a market to start trading</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
