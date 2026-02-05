import { useState, useEffect } from 'react';
import {
  Percent,
  RefreshCw,
  Play,
  Square,
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  CheckCircle,
  XCircle,
  Trash2,
  ExternalLink,
  X,
  Clock,
  ShoppingCart,
} from 'lucide-react';
import { spreadApi } from '../services/api';

interface ExecuteModal {
  opp: any;
  outcomes: string[];
  prices: number[];
}

export default function Arbitrage() {
  const [status, setStatus] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [allTrades, setAllTrades] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [lastAction, setLastAction] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Execute modal
  const [executeModal, setExecuteModal] = useState<ExecuteModal | null>(null);
  const [investmentInput, setInvestmentInput] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SINGLE' | 'MULTI'>('ALL');
  const [minSpreadPct, setMinSpreadPct] = useState(0);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statusRes, oppsRes, openRes, tradesRes, statsRes] = await Promise.all([
        spreadApi.getStatus(),
        spreadApi.getOpportunities(),
        spreadApi.getOpenTrades(),
        spreadApi.getTrades(50),
        spreadApi.getTradeStats(),
      ]);
      setStatus(statusRes.data.data);
      setOpportunities(oppsRes.data.data || []);
      setOpenTrades(openRes.data.data || []);
      setAllTrades(tradesRes.data.data || []);
      setStats(statsRes.data.data);
    } catch (error) {
      console.error('Failed to load arbitrage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      await spreadApi.scan();
      await loadData();
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  const handleToggleScanner = async () => {
    try {
      if (status?.isRunning) {
        await spreadApi.stop();
      } else {
        await spreadApi.start();
      }
      await loadData();
    } catch (error) {
      console.error('Failed to toggle scanner:', error);
    }
  };

  const openExecuteModal = (opp: any) => {
    const outcomes: string[] = JSON.parse(opp.outcomes_json || '[]');
    const prices: number[] = JSON.parse(opp.prices_json || '[]');
    setExecuteModal({ opp, outcomes, prices });
    setInvestmentInput(String(status?.maxSpreadBetSize || 10));
  };

  const handleExecuteConfirm = async () => {
    if (!executeModal) return;
    const investment = parseFloat(investmentInput);
    if (isNaN(investment) || investment <= 0) return;

    setExecuting(true);
    try {
      const result = await spreadApi.execute(executeModal.opp.id, investment);
      setExecuteModal(null);
      showAction('success', `Trade executed: $${investment.toFixed(2)} on "${executeModal.opp.question.slice(0, 50)}..." — expected profit +$${result.data.data.expectedProfit.toFixed(2)}`);
      await loadData();
    } catch (error: any) {
      showAction('error', 'Execute failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setExecuting(false);
    }
  };

  const showAction = (type: 'success' | 'error', text: string) => {
    setLastAction({ type, text });
    setTimeout(() => setLastAction(null), 6000);
  };

  const handleClearTrades = async () => {
    if (!confirm('Clear all open spread trades?')) return;
    try {
      await spreadApi.clearTrades();
      await loadData();
    } catch (error) {
      console.error('Failed to clear trades:', error);
    }
  };

  const handleCheckTrades = async (forceAll = false) => {
    try {
      const result = await spreadApi.check(forceAll);
      const { checked, closed, skipped } = result.data.data;
      if (forceAll) {
        showAction('success', `Force-checked all ${checked} trades, ${closed} resolved`);
      } else {
        showAction('success', `Checked ${checked} past-due trades, ${closed} resolved, ${skipped} skipped (not yet ended)`);
      }
      await loadData();
    } catch (error) {
      console.error('Failed to check trades:', error);
    }
  };

  const handleClearOpportunities = async () => {
    if (!confirm('Clear all cached opportunities?')) return;
    try {
      await spreadApi.clearOpportunities();
      await loadData();
    } catch (error) {
      console.error('Failed to clear opportunities:', error);
    }
  };

  const filteredOpportunities = opportunities.filter((opp: any) => {
    if (typeFilter !== 'ALL' && opp.opportunity_type !== typeFilter) return false;
    if (opp.spread_pct * 100 < minSpreadPct) return false;
    return true;
  });

  const closedTrades = allTrades.filter((t: any) => t.status === 'CLOSED');
  const bestSpread = opportunities.length > 0
    ? Math.max(...opportunities.map((o: any) => o.spread_pct * 100))
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Percent className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Arbitrage Scanner</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
          <button
            onClick={() => handleCheckTrades(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            title="Force-check ALL open trades for resolution against the API"
          >
            <CheckCircle className="w-4 h-4" />
            Check Resolution
          </button>
          <button
            onClick={handleToggleScanner}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${
              status?.isRunning
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {status?.isRunning ? (
              <>
                <Square className="w-4 h-4" />
                Stop Auto-Scan
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Auto-Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Action notification */}
      {lastAction && (
        <div
          className={`flex items-center p-4 rounded-lg ${
            lastAction.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {lastAction.type === 'success' ? (
            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          )}
          <span className="text-sm">{lastAction.text}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Opportunities</p>
              <p className="text-2xl font-bold mt-1">{opportunities.length}</p>
            </div>
            <Target className="w-12 h-12 text-indigo-500" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {opportunities.filter((o: any) => o.opportunity_type === 'SINGLE').length} single,{' '}
            {opportunities.filter((o: any) => o.opportunity_type === 'MULTI').length} multi
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Open Trades</p>
              <p className="text-2xl font-bold mt-1">{stats?.open_trades || 0}</p>
            </div>
            <BarChart3 className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Exposure: ${(stats?.open_exposure || 0).toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total P&L</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  (stats?.total_realized_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                ${(stats?.total_realized_pnl || 0).toFixed(2)}
              </p>
            </div>
            <DollarSign
              className={`w-12 h-12 ${
                (stats?.total_realized_pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {stats?.closed_trades || 0} closed trades
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Best Spread</p>
              <p className="text-2xl font-bold mt-1 text-indigo-600">
                {bestSpread.toFixed(2)}%
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-indigo-500" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Scanner: {status?.isRunning ? 'Running' : 'Stopped'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="ALL">All</option>
            <option value="SINGLE">Single</option>
            <option value="MULTI">Multi</option>
          </select>
        </div>
        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Min Spread: {minSpreadPct.toFixed(1)}%
          </label>
          <input
            type="range"
            value={minSpreadPct}
            onChange={(e) => setMinSpreadPct(parseFloat(e.target.value))}
            className="w-full"
            min="0"
            max="20"
            step="0.5"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleClearOpportunities}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
          >
            <Trash2 className="w-3 h-3" />
            Clear Opps
          </button>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">
            Opportunities ({filteredOpportunities.length})
          </h2>
        </div>
        <div className="divide-y">
          {filteredOpportunities.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No opportunities found. Click "Scan Now" to search.
            </p>
          ) : (
            filteredOpportunities.map((opp: any) => {
              const outcomes: string[] = JSON.parse(opp.outcomes_json || '[]');
              const prices: number[] = JSON.parse(opp.prices_json || '[]');
              return (
                <div key={opp.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            opp.opportunity_type === 'SINGLE'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {opp.opportunity_type}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {opp.question}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {outcomes.map((outcome: string, i: number) => (
                          <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {outcome}: ${prices[i]?.toFixed(3) || '?'}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Buy all for <strong className="text-gray-700">${opp.total_cost?.toFixed(3)}</strong></span>
                        <span>Payout <strong className="text-gray-700">$1.00</strong></span>
                        <span>Profit <strong className="text-green-600">${opp.spread_profit?.toFixed(4)}</strong></span>
                        {opp.liquidity && <span>Liq: ${parseFloat(opp.liquidity).toFixed(0)}</span>}
                        {opp.end_date && (
                          <span>Ends: {new Date(opp.end_date).toLocaleDateString()} {new Date(opp.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        {opp.volume_24h && <span>Vol24h: ${parseFloat(opp.volume_24h).toFixed(0)}</span>}
                        {opp.slug && (
                          <a
                            href={`https://polymarket.com/event/${opp.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-green-600">
                        {(opp.spread_pct * 100).toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        ${opp.spread_profit?.toFixed(3)} per set
                      </p>
                      <button
                        onClick={() => openExecuteModal(opp)}
                        className="mt-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Execute
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Open Spread Trades */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Open Spread Trades ({openTrades.length})</h2>
            {openTrades.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded ${status?.isResolverRunning ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {status?.isResolverRunning ? 'Auto-checking every 60s' : 'Resolver idle'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCheckTrades(false)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              title="Check past-due trades for resolution"
            >
              <RefreshCw className="w-3 h-3" />
              Check Ended
            </button>
            <button
              onClick={() => handleCheckTrades(true)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              title="Force-check ALL trades against API, even if market hasn't ended yet"
            >
              <RefreshCw className="w-3 h-3" />
              Check All
            </button>
            {openTrades.length > 0 && (
              <button
                onClick={handleClearTrades}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Clear all open trades"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <div className="divide-y">
          {openTrades.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No open spread trades</p>
          ) : (
            openTrades.map((trade: any) => {
              const outcomes: string[] = JSON.parse(trade.outcomes_json || '[]');
              const profitPct = trade.total_invested > 0
                ? (trade.expected_profit / trade.total_invested) * 100
                : 0;
              return (
                <div key={trade.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            trade.opportunity_type === 'SINGLE'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {trade.opportunity_type}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {trade.question}
                        </span>
                      </div>
                      {/* Per-outcome breakdown */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {outcomes.map((outcome: string, i: number) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded">
                            <ShoppingCart className="w-3 h-3 text-gray-400" />
                            {outcome}: ${trade.size_per_outcome?.toFixed(2)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(trade.created_at).toLocaleString()}
                        </span>
                        <span>Cost/set: ${trade.total_cost?.toFixed(3)}</span>
                        <span>Payout: ${trade.guaranteed_payout?.toFixed(2)}</span>
                        <span>{trade.is_paper_trade ? 'Paper' : 'Live'}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-base font-bold">${trade.total_invested?.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">invested</p>
                      <p className="text-sm font-semibold text-green-600 mt-1">
                        +${trade.expected_profit?.toFixed(2)} ({profitPct.toFixed(1)}%)
                      </p>
                      <p className="text-xs text-gray-400">expected profit</p>
                      {trade.end_date ? (
                        new Date(trade.end_date).getTime() > Date.now() ? (
                          <p className="text-xs text-orange-500 mt-1">
                            Ends {new Date(trade.end_date).toLocaleDateString()} {new Date(trade.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        ) : (
                          <p className="text-xs text-blue-500 mt-1">
                            Market ended — awaiting resolution
                          </p>
                        )
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">
                          Waiting for resolution
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Closed Trades */}
      {closedTrades.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Closed Trades ({closedTrades.length})</h2>
          </div>
          <div className="divide-y">
            {closedTrades.map((trade: any) => {
              const roiPct = trade.total_invested > 0
                ? ((trade.realized_pnl || 0) / trade.total_invested) * 100
                : 0;
              return (
                <div key={trade.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {(trade.realized_pnl || 0) >= 0 ? (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{trade.question}</p>
                        <p className="text-xs text-gray-500">
                          {trade.opportunity_type} | ${trade.total_invested?.toFixed(2)} invested | {trade.num_outcomes} outcomes |{' '}
                          {new Date(trade.created_at).toLocaleDateString()} - {trade.closed_at ? new Date(trade.closed_at).toLocaleDateString() : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p
                        className={`text-sm font-semibold ${
                          (trade.realized_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {(trade.realized_pnl || 0) >= 0 ? '+' : ''}$
                        {(trade.realized_pnl || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {roiPct >= 0 ? '+' : ''}{roiPct.toFixed(1)}% ROI
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Execute Confirmation Modal */}
      {executeModal && (() => {
        const { opp, outcomes, prices } = executeModal;
        const investment = parseFloat(investmentInput) || 0;
        const numOutcomes = outcomes.length;
        const perOutcome = numOutcomes > 0 ? investment / numOutcomes : 0;
        // How many "sets" you can buy: investment / (totalCost per set)
        // Each set = 1 share of each outcome, costs totalCost, pays $1
        const setsCount = opp.total_cost > 0 ? investment / opp.total_cost : 0;
        const expectedProfit = setsCount * opp.spread_profit;
        const expectedProfitPct = investment > 0 ? (expectedProfit / investment) * 100 : 0;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              {/* Modal header */}
              <div className="flex items-center justify-between p-5 border-b">
                <h3 className="text-lg font-semibold">Execute Spread Trade</h3>
                <button
                  onClick={() => setExecuteModal(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Market info */}
              <div className="p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        opp.opportunity_type === 'SINGLE'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {opp.opportunity_type}
                    </span>
                    <span className="font-medium text-gray-900 text-sm">{opp.question}</span>
                  </div>
                  {opp.slug && (
                    <a
                      href={`https://polymarket.com/event/${opp.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                    >
                      View on Polymarket <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* What you're buying */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">You will buy all outcomes</p>
                  <div className="space-y-2">
                    {outcomes.map((outcome: string, i: number) => {
                      const price = prices[i] || 0;
                      const sharesForOutcome = price > 0 ? perOutcome / price : 0;
                      return (
                        <div key={i} className="flex items-center justify-between bg-white rounded px-3 py-2 border">
                          <div>
                            <span className="text-sm font-medium">{outcome}</span>
                            <span className="text-xs text-gray-500 ml-2">@ ${price.toFixed(3)}/share</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">${perOutcome.toFixed(2)}</p>
                            <p className="text-xs text-gray-400">{sharesForOutcome.toFixed(1)} shares</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Investment input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Investment ($)
                  </label>
                  <input
                    type="number"
                    value={investmentInput}
                    onChange={(e) => setInvestmentInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="1"
                    step="1"
                    max={status?.maxSpreadBetSize || 100}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Max: ${status?.maxSpreadBetSize || 10} (configurable in Settings)
                  </p>
                </div>

                {/* Summary breakdown */}
                <div className="bg-indigo-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-indigo-700 uppercase">Trade Summary</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-600">Total cost per set:</span>
                    <span className="text-right font-medium">${opp.total_cost?.toFixed(3)}</span>
                    <span className="text-gray-600">Guaranteed payout:</span>
                    <span className="text-right font-medium">$1.00 per set</span>
                    <span className="text-gray-600">Spread per set:</span>
                    <span className="text-right font-medium text-green-600">${opp.spread_profit?.toFixed(4)} ({(opp.spread_pct * 100).toFixed(2)}%)</span>
                    <span className="text-gray-600">Sets purchased:</span>
                    <span className="text-right font-medium">{setsCount.toFixed(2)}</span>
                    <div className="col-span-2 border-t border-indigo-200 my-1"></div>
                    <span className="text-gray-900 font-semibold">You invest:</span>
                    <span className="text-right font-bold">${investment.toFixed(2)}</span>
                    <span className="text-gray-900 font-semibold">You receive on resolution:</span>
                    <span className="text-right font-bold">${(investment + expectedProfit).toFixed(2)}</span>
                    <span className="text-gray-900 font-semibold">Guaranteed profit:</span>
                    <span className="text-right font-bold text-green-600">
                      +${expectedProfit.toFixed(2)} ({expectedProfitPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  Paper trade — no real money. Profit locks in at purchase; trade closes when market resolves.
                  {opp.end_date && (
                    <> Market ends <strong>{new Date(opp.end_date).toLocaleDateString()} {new Date(opp.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> — resolution checked automatically after that.</>
                  )}
                </p>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
                <button
                  onClick={() => setExecuteModal(null)}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteConfirm}
                  disabled={executing || investment <= 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {executing ? 'Executing...' : `Buy All Outcomes — $${investment.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
