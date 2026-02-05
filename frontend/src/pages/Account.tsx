import { useState, useEffect } from 'react';
import {
  Wallet,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  User,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { accountApi } from '../services/api';
import { Link } from 'react-router-dom';

interface AccountData {
  hasCredentials: boolean;
  profile: any | null;
  onChainBalance: string | null;
  clobBalance: any | null;
  positions: any[] | null;
  activity: any[] | null;
  pnl: any | null;
}

export default function Account() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await accountApi.getSummary();
      setData(res.data.data);
    } catch (e: any) {
      console.error('Failed to load account data:', e);
      setError(e.message || 'Failed to load account data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getPnlValue = (): number => {
    if (!data?.pnl) return 0;
    if (typeof data.pnl === 'number') return data.pnl;
    if (data.pnl.totalPnl !== undefined) return parseFloat(data.pnl.totalPnl) || 0;
    if (data.pnl.pnl !== undefined) return parseFloat(data.pnl.pnl) || 0;
    if (data.pnl.realized !== undefined) return parseFloat(data.pnl.realized) || 0;
    return 0;
  };

  const getClobBalanceValue = (): string | null => {
    if (!data?.clobBalance) return null;
    if (typeof data.clobBalance === 'string') return data.clobBalance;
    if (data.clobBalance.balance !== undefined) return data.clobBalance.balance;
    if (data.clobBalance.USDC !== undefined) return data.clobBalance.USDC;
    return JSON.stringify(data.clobBalance);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const funderAddress = data?.profile?.funderAddress || data?.profile?.proxyWallet || data?.profile?.address || null;
  const pnlValue = getPnlValue();
  const clobBalStr = getClobBalanceValue();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* No Credentials Warning */}
      {data && !data.hasCredentials && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Polymarket credentials not configured
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Some account data requires API credentials.{' '}
              <Link to="/settings" className="underline font-medium hover:text-yellow-900">
                Configure in Settings
              </Link>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Profile Card */}
      {data?.profile && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            {data.profile.profileImage ? (
              <img
                src={data.profile.profileImage}
                alt={data.profile.name || data.profile.userName || 'Profile'}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-8 h-8 text-gray-500" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {data.profile.name || data.profile.userName || 'Anonymous'}
              </h2>
              {data.profile.bio && (
                <p className="text-sm text-gray-600 mt-1">{data.profile.bio}</p>
              )}
              {funderAddress && (
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {truncateAddress(funderAddress)}
                  </code>
                  <button
                    onClick={() => copyAddress(funderAddress)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <a
                    href={`https://polymarket.com/profile/${funderAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                    title="View on Polymarket"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Wallet Balance */}
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">Wallet Balance</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {data?.onChainBalance !== null && data?.onChainBalance !== undefined
              ? formatMoney(data.onChainBalance)
              : 'Unavailable'}
          </p>
          <p className="text-xs text-gray-400 mt-1">On-chain USDC (Polygon)</p>
        </div>

        {/* Trading Balance */}
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">Trading Balance</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {clobBalStr !== null
              ? formatMoney(clobBalStr)
              : 'Unavailable'}
          </p>
          <p className="text-xs text-gray-400 mt-1">CLOB Trading Account</p>
        </div>

        {/* Total P&L */}
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">Total P&L</p>
          <div className="flex items-center gap-2 mt-1">
            {pnlValue !== 0 && (
              pnlValue > 0
                ? <TrendingUp className="w-5 h-5 text-green-500" />
                : <TrendingDown className="w-5 h-5 text-red-500" />
            )}
            <p className={`text-2xl font-bold ${
              data?.pnl === null
                ? 'text-gray-400'
                : pnlValue >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
            }`}>
              {data?.pnl !== null
                ? `${pnlValue >= 0 ? '+' : ''}${formatMoney(pnlValue)}`
                : 'Unavailable'}
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-1">Realized P&L</p>
        </div>
      </div>

      {/* Open Positions Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Open Positions</h2>
        </div>
        {data?.positions === null ? (
          <div className="p-8 text-center text-gray-400">Unavailable</div>
        ) : !data?.positions || data.positions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No open positions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500">Market</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Outcome</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Size</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Avg Price</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">Current Value</th>
                  <th className="px-4 py-3 font-medium text-gray-500 text-right">P&L %</th>
                  <th className="px-4 py-3 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.positions.map((pos: any, idx: number) => {
                  const entryPrice = parseFloat(pos.avgPrice || pos.price || 0);
                  const currentPrice = parseFloat(pos.curPrice || pos.currentPrice || entryPrice);
                  const size = parseFloat(pos.size || pos.totalSize || 0);
                  const currentValue = currentPrice * (size / (entryPrice || 1));
                  const pnlPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

                  return (
                    <tr key={pos.conditionId || pos.id || idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-xs" title={pos.title || pos.question}>
                          {pos.title || pos.question || 'Unknown Market'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                          (pos.outcome || '').toUpperCase() === 'YES'
                            ? 'bg-green-100 text-green-700'
                            : (pos.outcome || '').toUpperCase() === 'NO'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}>
                          {pos.outcome || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatMoney(size)}</td>
                      <td className="px-4 py-3 text-right">${entryPrice.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(currentValue)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        pnlPct >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(pos.slug || pos.eventSlug) && (
                          <a
                            href={`https://polymarket.com/event/${pos.slug || pos.eventSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        {data?.activity === null ? (
          <div className="p-8 text-center text-gray-400">Unavailable</div>
        ) : !data?.activity || data.activity.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No recent activity</div>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto">
            {data.activity.map((item: any, idx: number) => (
              <div key={item.id || idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded ${
                    (item.side || item.type || '').toUpperCase() === 'BUY'
                      ? 'bg-green-100 text-green-700'
                      : (item.side || item.type || '').toUpperCase() === 'SELL'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {(item.side || item.type || 'TRADE').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate" title={item.title || item.question}>
                      {item.title || item.question || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.outcome && (
                        <span className={`font-semibold ${
                          item.outcome.toUpperCase() === 'YES' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.outcome}
                        </span>
                      )}
                      {item.price !== undefined && (
                        <span className="ml-2">@ ${parseFloat(item.price).toFixed(3)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  {item.usdcSize !== undefined && (
                    <p className="text-sm font-semibold text-gray-900">
                      {formatMoney(item.usdcSize)}
                    </p>
                  )}
                  {item.timestamp && (
                    <p className="text-xs text-gray-400">{formatTime(item.timestamp)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
