import { useState, useEffect } from 'react';
import {
  Wallet, DollarSign, TrendingUp, TrendingDown, RefreshCw,
  ExternalLink, Crosshair, Percent, AlertCircle, CheckCircle, XCircle
} from 'lucide-react';
import { configApi, accountApi, snipeApi, spreadApi } from '../services/api';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [isPaperMode, setIsPaperMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Real mode data
  const [accountData, setAccountData] = useState<any>(null);

  // Paper/shared data
  const [snipedPositions, setSnipedPositions] = useState<any[]>([]);
  const [spreadStats, setSpreadStats] = useState<any>(null);
  const [spreadTrades, setSpreadTrades] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // First get app config to determine mode
      const appConfigRes = await configApi.getAppConfig();
      const paperMode = appConfigRes.data.data?.paper_trading_mode === 1;
      setIsPaperMode(paperMode);

      // Load data based on mode
      const [accountRes, snipeRes, spreadStatsRes, spreadTradesRes] = await Promise.all([
        accountApi.getSummary(),
        snipeApi.getPositions(),
        spreadApi.getTradeStats(),
        spreadApi.getTrades(20),
      ]);

      setAccountData(accountRes.data.data);
      setSnipedPositions(snipeRes.data.data || []);
      setSpreadStats(spreadStatsRes.data.data);
      setSpreadTrades(spreadTradesRes.data.data || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0.00';
    if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatTime = (timestamp: string | number) => {
    const date = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading || isPaperMode === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const openSnipes = snipedPositions.filter((p: any) => p.status === 'OPEN');
  const closedSnipes = snipedPositions.filter((p: any) => p.status === 'CLOSED');
  const openSpreadTrades = spreadTrades.filter((t: any) => t.status === 'OPEN');

  // Get PnL value from account data
  const getPnlValue = (): number => {
    if (!accountData?.pnl) return 0;
    if (typeof accountData.pnl === 'number') return accountData.pnl;
    if (accountData.pnl.totalPnl !== undefined) return parseFloat(accountData.pnl.totalPnl) || 0;
    if (accountData.pnl.pnl !== undefined) return parseFloat(accountData.pnl.pnl) || 0;
    return 0;
  };

  const pnlValue = getPnlValue();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white rounded-lg shadow hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Mode Indicator */}
      {isPaperMode ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
            <p className="text-yellow-800">
              <strong>Paper Trading Mode:</strong> Showing simulated data.{' '}
              <Link to="/settings" className="underline hover:text-yellow-900">
                Switch to Live Mode
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <p className="text-green-800">
              <strong>Live Trading Mode:</strong> Showing real Polymarket data.
            </p>
          </div>
        </div>
      )}

      {/* Balance Cards - Only in Live Mode */}
      {!isPaperMode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Wallet Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accountData?.onChainBalance !== null
                    ? formatMoney(accountData.onChainBalance)
                    : 'Unavailable'}
                </p>
              </div>
              <Wallet className="w-10 h-10 text-blue-500" />
            </div>
            <p className="text-xs text-gray-400 mt-2">On-chain USDC (Polygon)</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Trading Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accountData?.clobBalance !== null
                    ? formatMoney(accountData.clobBalance?.balance || accountData.clobBalance)
                    : 'Unavailable'}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-green-500" />
            </div>
            <p className="text-xs text-gray-400 mt-2">CLOB Trading Account</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total P&L</p>
                <p className={`text-2xl font-bold ${pnlValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {accountData?.pnl !== null
                    ? `${pnlValue >= 0 ? '+' : ''}${formatMoney(pnlValue)}`
                    : 'Unavailable'}
                </p>
              </div>
              {pnlValue >= 0 ? (
                <TrendingUp className="w-10 h-10 text-green-500" />
              ) : (
                <TrendingDown className="w-10 h-10 text-red-500" />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">Realized P&L</p>
          </div>
        </div>
      )}

      {/* Real Positions - Only in Live Mode */}
      {!isPaperMode && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Positions</h2>
            <Link to="/account" className="text-sm text-blue-600 hover:text-blue-800">
              View All →
            </Link>
          </div>
          {accountData?.positions === null ? (
            <div className="p-8 text-center text-gray-400">Unable to load positions</div>
          ) : !accountData?.positions || accountData.positions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No open positions</div>
          ) : (
            <div className="divide-y">
              {accountData.positions.slice(0, 5).map((pos: any, idx: number) => {
                const entryPrice = parseFloat(pos.avgPrice || pos.price || 0);
                const currentPrice = parseFloat(pos.curPrice || pos.currentPrice || entryPrice);
                const size = parseFloat(pos.size || pos.totalSize || 0);
                const pnlPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

                return (
                  <div key={pos.conditionId || idx} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {pos.title || pos.question || 'Unknown Market'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          (pos.outcome || '').toUpperCase() === 'YES'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {pos.outcome || 'N/A'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {size.toFixed(1)} shares @ ${entryPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className={`font-semibold ${pnlPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">{formatMoney(size * entryPrice)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recent Activity - Only in Live Mode */}
      {!isPaperMode && accountData?.activity && accountData.activity.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {accountData.activity.slice(0, 10).map((item: any, idx: number) => (
              <div key={item.id || idx} className="p-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    (item.side || item.type || '').toUpperCase() === 'BUY'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {(item.side || item.type || 'TRADE').toUpperCase()}
                  </span>
                  <p className="text-sm truncate">{item.title || item.question || 'Unknown'}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-medium">{formatMoney(item.usdcSize)}</p>
                  <p className="text-xs text-gray-400">{formatTime(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sniped Positions - Both Modes */}
      {openSnipes.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold">Sniped Positions</h2>
            <span className="text-sm text-gray-500">({openSnipes.length} open)</span>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {openSnipes.map((pos: any) => {
              const pnlPct = pos.current_price && pos.entry_price
                ? ((pos.current_price - pos.entry_price) / pos.entry_price) * 100
                : 0;
              return (
                <div key={pos.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{pos.title}</p>
                    <p className="text-xs text-gray-500">
                      {pos.outcome} @ ${pos.entry_price?.toFixed(3)} | From: {pos.source_trader_name || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className={`font-semibold ${pnlPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">${pos.size} position</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Arbitrage Positions - Both Modes */}
      {openSpreadTrades.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center gap-2">
            <Percent className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">Arbitrage Positions</h2>
            <span className="text-sm text-gray-500">({openSpreadTrades.length} open)</span>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {openSpreadTrades.map((trade: any) => {
              const profitPct = trade.total_invested > 0
                ? (trade.expected_profit / trade.total_invested) * 100
                : 0;
              return (
                <div key={trade.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        trade.opportunity_type === 'SINGLE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {trade.opportunity_type}
                      </span>
                      <p className="font-medium truncate">{trade.question}</p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold">${trade.total_invested?.toFixed(2)}</p>
                    <p className="text-sm text-green-600">
                      +${trade.expected_profit?.toFixed(2)} ({profitPct.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Credentials Warning */}
      {!isPaperMode && accountData && !accountData.hasCredentials && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-orange-400 mr-2" />
            <p className="text-orange-800">
              <strong>Credentials not configured.</strong>{' '}
              <Link to="/settings" className="underline hover:text-orange-900">
                Add your Polymarket credentials
              </Link>{' '}
              to see your real positions and balances.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
