import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Zap } from 'lucide-react';
import { marketsApi } from '../services/api';

export default function MarketConfig() {
  const [monitoredMarkets, setMonitoredMarkets] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [manualMarketId, setManualMarketId] = useState('');
  const [closesWithin, setClosesWithin] = useState('');

  useEffect(() => {
    loadMonitoredMarkets();
    loadTags();
    loadTrendingMarkets();
  }, []);

  const loadTrendingMarkets = async () => {
    setLoading(true);
    try {
      const res = await marketsApi.searchMarkets('', 20, closesWithin || undefined);
      setSearchResults(res.data.data);
    } catch (error) {
      console.error('Failed to load trending markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const res = await marketsApi.getTags();
      setTags(res.data.data.slice(0, 10)); // Show top 10 categories
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const loadMonitoredMarkets = async () => {
    try {
      const res = await marketsApi.getMonitoredMarkets();
      setMonitoredMarkets(res.data.data);
    } catch (error) {
      console.error('Failed to load monitored markets:', error);
    }
  };

  const searchMarkets = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setSelectedTag(null);
    try {
      const res = await marketsApi.searchMarkets(searchQuery, 20, closesWithin || undefined);
      setSearchResults(res.data.data);
    } catch (error) {
      console.error('Failed to search markets:', error);
      showMessage('Failed to search markets');
    } finally {
      setLoading(false);
    }
  };

  const browseByCategory = async (tagId: string, tagLabel: string) => {
    setLoading(true);
    setSelectedTag(tagId);
    setSearchQuery('');
    try {
      const res = await marketsApi.getMarketsByCategory(tagId, 20, closesWithin || undefined);
      setSearchResults(res.data.data);
      showMessage(`Showing markets in: ${tagLabel}`);
    } catch (error) {
      console.error('Failed to load category:', error);
      showMessage('Failed to load category markets');
    } finally {
      setLoading(false);
    }
  };

  const loadRecurringMarket = async (series: string) => {
    setLoading(true);
    setSelectedTag(null);
    setSearchQuery('');
    try {
      const res = await marketsApi.getRecurringMarket(series);
      if (res.data.success) {
        setSearchResults(res.data.data);
        showMessage(`Found current ${series} market`);
      } else {
        showMessage(res.data.error || 'No active recurring market found');
      }
    } catch (error) {
      console.error('Failed to load recurring market:', error);
      showMessage('Failed to load recurring market');
    } finally {
      setLoading(false);
    }
  };

  const addMarket = async (market: any) => {
    try {
      await marketsApi.addMarket({
        market_id: market.market_id,
        condition_id: market.condition_id,
        question: market.question,
        slug: market.slug,
        end_date: market.end_date,
      });

      showMessage(`Added: ${market.question}`);
      await loadMonitoredMarkets();
      setSearchResults([]);
      setSearchQuery('');
    } catch (error: any) {
      showMessage(error.response?.data?.error || 'Failed to add market');
    }
  };

  const toggleMarketStatus = async (marketId: string, currentStatus: boolean) => {
    try {
      await marketsApi.updateMarketStatus(marketId, !currentStatus);
      await loadMonitoredMarkets();
    } catch (error) {
      console.error('Failed to toggle market status:', error);
    }
  };

  const addMarketManually = async () => {
    if (!manualMarketId.trim()) {
      showMessage('Please enter a market ID or URL');
      return;
    }

    setLoading(true);
    try {
      let input = manualMarketId.trim();
      let slug = null;
      let marketId = null;

      // Check if it's a URL
      if (input.includes('polymarket.com')) {
        const parts = input.split('/');
        const lastPart = parts[parts.length - 1];

        // Check if it's an event URL (contains slug)
        if (input.includes('/event/')) {
          slug = lastPart;
          showMessage('Searching for market by event slug...');
        } else {
          // Assume it's a market ID
          marketId = lastPart;
        }
      } else if (!isNaN(Number(input))) {
        // Pure number - assume it's a market ID
        marketId = input;
      } else {
        // Contains letters - assume it's a slug
        slug = input;
      }

      let marketData = null;

      // Try to fetch by market ID first
      if (marketId) {
        try {
          const res = await marketsApi.getMarketDetails(marketId);
          marketData = res.data.data;
        } catch (error: any) {
          showMessage('Market ID not found, trying slug search...');
        }
      }

      // If we have a slug or market ID fetch failed, search by slug
      if (!marketData && slug) {
        // Search through events to find matching slug
        const searchRes = await marketsApi.searchMarkets(slug, 100);
        const results = searchRes.data.data;

        // Try to find exact slug match
        const exactMatch = results.find((m: any) => m.slug === slug);

        if (exactMatch) {
          marketData = exactMatch;
        } else if (results.length > 0) {
          // Use first result
          marketData = results[0];
          showMessage(`Found similar market: ${marketData.question}`);
        } else {
          throw new Error('Market not found. It may not be active or available through the API.');
        }
      }

      if (!marketData) {
        throw new Error('Could not find market');
      }

      // Add to monitoring
      await marketsApi.addMarket({
        market_id: marketData.market_id || marketData.id,
        condition_id: marketData.condition_id || marketData.conditionId || null,
        question: marketData.question || marketData.title || 'Unknown Market',
        slug: marketData.slug || slug || marketId,
        end_date: marketData.end_date || marketData.end_date_iso || marketData.endDate || null,
      });

      showMessage(`✓ Added: ${marketData.question}`);
      await loadMonitoredMarkets();
      setManualMarketId('');
    } catch (error: any) {
      console.error('Failed to add market manually:', error);
      showMessage(error.message || error.response?.data?.error || 'Failed to add market. Try searching for it instead.');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 5000);
  };

  const isAlreadyMonitored = (marketId: string) => {
    return monitoredMarkets.some((m) => m.market_id === marketId);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Market Configuration</h1>

      {message && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <p className="text-blue-800">{message}</p>
        </div>
      )}

      {/* Manual Add */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Add Market Manually</h2>
        <p className="text-sm text-gray-600 mb-4">
          Can't find your market in search? Paste the market URL or ID directly:
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualMarketId}
            onChange={(e) => setManualMarketId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMarketManually()}
            placeholder="https://polymarket.com/event/... or market ID"
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addMarketManually}
            disabled={loading || !manualMarketId.trim()}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Add
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Search Polymarket Markets</h2>

        {/* Quick-add recurring markets */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Quick add:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadRecurringMarket('btc-15m')}
              disabled={loading}
              className="px-3 py-1 text-sm rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              BTC 15m
            </button>
          </div>
        </div>

        {/* Category Buttons */}
        {tags.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Browse by category:</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => browseByCategory(tag.id, tag.label)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    selectedTag === tag.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchMarkets()}
              placeholder="Search markets by question or topic..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={closesWithin}
            onChange={(e) => setClosesWithin(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Closes: Any</option>
            <option value="1h">Within 1 hour</option>
            <option value="6h">Within 6 hours</option>
            <option value="24h">Within 24 hours</option>
            <option value="7d">Within 7 days</option>
            <option value="30d">Within 30 days</option>
          </select>
          <button
            onClick={searchMarkets}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Search
              </>
            )}
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-600">
          Search from the top 100 active markets on Polymarket. Try keywords like: bitcoin, trump, election, sports, tech, AI, defi
        </p>

        {/* Search Results */}
        {searchQuery && searchResults.length === 0 && !loading && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">
              No markets found for "{searchQuery}". Try different keywords like "bitcoin", "trump", "election", or "sports".
            </p>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-medium text-gray-900">
              {searchQuery
                ? `Search Results for "${searchQuery}" (${searchResults.length} found)`
                : selectedTag
                ? `Category Results (${searchResults.length} found)`
                : `Trending Markets (${searchResults.length})`}
            </h3>
            {searchResults.map((market) => (
              <div
                key={market.market_id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{market.question}</h4>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600">
                        Volume: ${parseFloat(market.volume || 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Liquidity: ${parseFloat(market.liquidity || 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Closes: {market.end_date ? new Date(market.end_date).toLocaleString() : 'No end date'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Status: {market.active ? 'Active' : 'Inactive'}
                        {market.closed && ' (Closed)'}
                      </p>
                    </div>
                  </div>
                  {!isAlreadyMonitored(market.market_id) ? (
                    <button
                      onClick={() => addMarket(market)}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </button>
                  ) : (
                    <span className="ml-4 px-4 py-2 bg-gray-200 text-gray-600 rounded-md">
                      Already Monitoring
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monitored Markets */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Monitored Markets ({monitoredMarkets.length})</h2>
        </div>
        <div className="p-6">
          {monitoredMarkets.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No markets being monitored. Search and add markets above.
            </p>
          ) : (
            <div className="space-y-4">
              {monitoredMarkets.map((market) => (
                <div
                  key={market.id}
                  className={`border-l-4 ${
                    market.is_active ? 'border-green-500' : 'border-gray-300'
                  } rounded-lg p-4 bg-gray-50`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">{market.question}</h3>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            market.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {market.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-600">Market ID: {market.market_id}</p>
                        {market.end_date && (
                          <p className="text-sm text-gray-600">
                            Closes: {new Date(market.end_date).toLocaleString()}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Added: {new Date(market.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <button
                        onClick={() => toggleMarketStatus(market.market_id, market.is_active)}
                        className={`p-2 rounded-md ${
                          market.is_active
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                        title={market.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                      >
                        {market.is_active ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
