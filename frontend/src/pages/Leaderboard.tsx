import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, ExternalLink, RefreshCw, User, Crosshair, Play, Square, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { leaderboardApi, snipeApi } from '../services/api';

interface Position {
  conditionId: string;
  title: string;
  slug: string;
  outcome: string;
  icon: string;
  totalSize: number;
  avgPrice: number;
  latestTimestamp: number;
}

interface Trader {
  rank: string;
  userName: string;
  proxyWallet: string;
  pnl: number;
  vol: number;
  profileImage?: string;
  xUsername?: string;
  verifiedBadge?: boolean;
  positions: Position[];
}

const CATEGORIES = [
  { value: 'OVERALL', label: 'Overall' },
  { value: 'POLITICS', label: 'Politics' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'ECONOMICS', label: 'Economics' },
];

const TIME_PERIODS = [
  { value: 'DAY', label: 'Today' },
  { value: 'WEEK', label: 'This Week' },
  { value: 'MONTH', label: 'This Month' },
  { value: 'ALL', label: 'All Time' },
];

export default function Leaderboard() {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('OVERALL');
  const [timePeriod, setTimePeriod] = useState('DAY');
  const [error, setError] = useState<string | null>(null);

  // Snipe state
  const [snipeStatus, setSnipeStatus] = useState<any>(null);
  const [snipedPositions, setSnipedPositions] = useState<any[]>([]);
  const [sniping, setSniping] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await leaderboardApi.getTopPositions(category, timePeriod, 10, 3);
      setTraders(response.data.data || []);
    } catch (e: any) {
      console.error('Failed to load leaderboard:', e);
      setError(e.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const loadSnipeData = async () => {
    try {
      const [statusRes, positionsRes] = await Promise.all([
        snipeApi.getStatus(),
        snipeApi.getPositions(),
      ]);
      setSnipeStatus(statusRes.data.data);
      setSnipedPositions(positionsRes.data.data || []);
    } catch (e) {
      console.error('Failed to load snipe data:', e);
    }
  };

  const handleSnipe = async () => {
    if (!confirm('Copy top 10 positions from leaderboard traders?')) return;
    setSniping(true);
    try {
      const result = await snipeApi.execute();
      alert(`Copied ${result.data.data.copied} positions, skipped ${result.data.data.skipped}`);
      loadSnipeData();
    } catch (e: any) {
      alert('Failed to snipe: ' + (e.message || 'Unknown error'));
    } finally {
      setSniping(false);
    }
  };

  const handleToggleMonitoring = async () => {
    try {
      if (snipeStatus?.isRunning) {
        await snipeApi.stop();
      } else {
        await snipeApi.start();
      }
      loadSnipeData();
    } catch (e) {
      console.error('Failed to toggle monitoring:', e);
    }
  };

  const handleCheckNow = async () => {
    try {
      const result = await snipeApi.check();
      alert(`Checked ${result.data.data.checked} positions, closed ${result.data.data.closed}`);
      loadSnipeData();
    } catch (e) {
      console.error('Failed to check positions:', e);
    }
  };

  const handleClearPositions = async () => {
    if (!confirm('Clear all open sniped positions?')) return;
    try {
      await snipeApi.clearPositions();
      loadSnipeData();
    } catch (e) {
      console.error('Failed to clear positions:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [category, timePeriod]);

  useEffect(() => {
    loadSnipeData();
    const interval = setInterval(loadSnipeData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatMoney = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const openSnipedPositions = snipedPositions.filter((p: any) => p.status === 'OPEN');
  const closedSnipedPositions = snipedPositions.filter((p: any) => p.status === 'CLOSED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h1 className="text-2xl font-bold text-gray-900">Top Traders</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSnipe}
            disabled={sniping}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Crosshair className={`w-4 h-4 ${sniping ? 'animate-pulse' : ''}`} />
            {sniping ? 'Sniping...' : 'Snipe Top 10'}
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Sniped Positions Panel */}
      {(openSnipedPositions.length > 0 || closedSnipedPositions.length > 0) && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crosshair className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold">Sniped Positions</h2>
              <span className="text-sm text-gray-500">
                ({openSnipedPositions.length} open, target: +{((snipeStatus?.profitTarget || 0.05) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMonitoring}
                className={`flex items-center gap-1 px-3 py-1 text-sm rounded ${
                  snipeStatus?.isRunning
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {snipeStatus?.isRunning ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {snipeStatus?.isRunning ? 'Stop' : 'Start'} Auto-Check
              </button>
              <button
                onClick={handleCheckNow}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <RefreshCw className="w-3 h-3" />
                Check Now
              </button>
              {openSnipedPositions.length > 0 && (
                <button
                  onClick={handleClearPositions}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {openSnipedPositions.map((pos: any) => {
              const pnlPct = pos.current_price && pos.entry_price
                ? ((pos.current_price - pos.entry_price) / pos.entry_price) * 100
                : 0;
              return (
                <div key={pos.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pos.title}</p>
                    <p className="text-xs text-gray-500">
                      {pos.outcome} @ ${pos.entry_price?.toFixed(3)} | From: {pos.source_trader_name || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className={`text-sm font-semibold ${pnlPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">${pos.size} position</p>
                  </div>
                </div>
              );
            })}
            {closedSnipedPositions.slice(0, 5).map((pos: any) => (
              <div key={pos.id} className="flex items-center justify-between py-2 border-b last:border-0 opacity-60">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {pos.realized_pnl >= 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm truncate">{pos.title}</p>
                    <p className="text-xs text-gray-500">Closed</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className={`text-sm font-semibold ${pos.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pos.realized_pnl >= 0 ? '+' : ''}${pos.realized_pnl?.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {TIME_PERIODS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : traders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No traders found
        </div>
      ) : (
        <div className="space-y-4">
          {traders.map((trader) => (
            <div key={trader.proxyWallet} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Trader Header */}
              <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 font-bold">
                      #{trader.rank}
                    </div>
                    {trader.profileImage ? (
                      <img
                        src={trader.profileImage}
                        alt={trader.userName}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {trader.userName || trader.proxyWallet.slice(0, 8) + '...'}
                        </span>
                        {trader.verifiedBadge && (
                          <span className="text-blue-500 text-xs">Verified</span>
                        )}
                      </div>
                      {trader.xUsername && (
                        <a
                          href={`https://x.com/${trader.xUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:text-blue-600"
                        >
                          @{trader.xUsername}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${trader.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trader.pnl >= 0 ? '+' : ''}{formatMoney(trader.pnl)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Vol: {formatMoney(trader.vol)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Positions */}
              <div className="p-4">
                {trader.positions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">No recent positions</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Recent Positions</p>
                    {trader.positions.map((pos, idx) => (
                      <div
                        key={`${pos.conditionId}-${idx}`}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {pos.icon && (
                            <img src={pos.icon} alt="" className="w-8 h-8 rounded" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate" title={pos.title}>
                              {pos.title}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className={`font-semibold ${pos.outcome?.toLowerCase().includes('yes') ? 'text-green-600' : pos.outcome?.toLowerCase().includes('no') ? 'text-red-600' : 'text-blue-600'}`}>
                                {pos.outcome}
                              </span>
                              <span>@ ${pos.avgPrice.toFixed(2)}</span>
                              <span>{formatTime(pos.latestTimestamp)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatMoney(pos.totalSize)}
                          </p>
                          {pos.slug && (
                            <a
                              href={`https://polymarket.com/event/${pos.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
