import { useState, useEffect, useRef } from 'react';
import { Activity, DollarSign, TrendingUp, AlertCircle, Play, Square, RefreshCw, Clock, CheckCircle, XCircle, Trash2, Crosshair, ChevronDown, ChevronRight, Percent } from 'lucide-react';
import { tradingApi, tradesApi, configApi, snipeApi, spreadApi } from '../services/api';
import { PriceChart } from '../components/PriceChart';

function Countdown({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Resolved');
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else if (m > 0) setTimeLeft(`${m}m ${s}s`);
      else setTimeLeft(`${s}s`);
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [endDate]);

  const diff = new Date(endDate).getTime() - Date.now();
  const urgent = diff > 0 && diff < 300000; // < 5 min
  const resolved = diff <= 0;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${resolved ? 'text-gray-400' : urgent ? 'text-red-600 font-semibold' : 'text-orange-600'}`}>
      <Clock className="w-3 h-3" />
      {timeLeft}
    </span>
  );
}

function CollapsibleSection({ title, icon, badge, defaultOpen = true, actions, children }: {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg shadow">
      <div
        className="p-6 border-b flex items-center justify-between cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
          {icon}
          <h2 className="text-xl font-semibold">{title}</h2>
          {badge}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      </div>
      {open && <div className="p-6">{children}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [resolvedTrades, setResolvedTrades] = useState<any[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<any[]>([]);
  const [snipedPositions, setSnipedPositions] = useState<any[]>([]);
  const [spreadStats, setSpreadStats] = useState<any>(null);
  const [spreadTrades, setSpreadTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statusRes, budgetRes, positionsRes, resolvedRes, analysesRes, snipeRes, spreadStatsRes, spreadTradesRes] = await Promise.all([
        tradingApi.getStatus(),
        configApi.getBudget(),
        tradesApi.getPositions(),
        tradesApi.getResolved(),
        tradesApi.getAnalyses(10),
        snipeApi.getPositions(),
        spreadApi.getTradeStats(),
        spreadApi.getTrades(20),
      ]);

      setStatus(statusRes.data.data);
      setBudget(budgetRes.data.data);
      setPositions(positionsRes.data.data);
      setResolvedTrades(resolvedRes.data.data);
      setRecentAnalyses(analysesRes.data.data);
      setSnipedPositions(snipeRes.data.data || []);
      setSpreadStats(spreadStatsRes.data.data);
      setSpreadTrades(spreadTradesRes.data.data || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrading = async () => {
    try {
      if (status?.is_running) {
        await tradingApi.stop();
      } else {
        await tradingApi.start();
      }
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to toggle trading:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const budgetUtilization = budget
    ? (budget.spent / budget.daily_budget) * 100
    : 0;

  const tradeExposure = positions.reduce((sum: number, p: any) => sum + (p.size || 0), 0);
  const openSnipes = snipedPositions.filter((p: any) => p.status === 'OPEN');
  const snipeExposure = openSnipes.reduce((sum: number, p: any) => sum + (p.size || 0), 0);
  const spreadExposure = spreadStats?.open_exposure || 0;
  const totalExposure = tradeExposure + snipeExposure + spreadExposure;

  const openSpreadTrades = spreadTrades.filter((t: any) => t.status === 'OPEN');
  const closedSpreadTrades = spreadTrades.filter((t: any) => t.status === 'CLOSED');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={toggleTrading}
          className={`flex items-center px-4 py-2 rounded-md text-white ${
            status?.is_running ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {status?.is_running ? (
            <>
              <Square className="w-4 h-4 mr-2" />
              Stop Trading
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start Trading
            </>
          )}
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">System Status</p>
              <p className="text-2xl font-bold mt-1">
                {status?.trading_enabled ? 'Active' : 'Disabled'}
              </p>
            </div>
            <Activity
              className={`w-12 h-12 ${
                status?.trading_enabled ? 'text-green-500' : 'text-gray-400'
              }`}
            />
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-xs text-gray-500">
              Mode: {status?.paper_trading_mode ? 'Paper Trading' : 'Live Trading'}
            </p>
            <p className="text-xs text-gray-500">
              Polymarket: {status?.polymarket_connected ? '✓ Connected' : '✗ Disconnected'}
            </p>
            <p className="text-xs text-gray-500">
              Claude: {status?.claude_connected ? '✓ Connected' : '✗ Disconnected'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Budget Today</p>
              <p className="text-2xl font-bold mt-1">
                ${budget?.spent?.toFixed(2) || '0.00'} / ${budget?.daily_budget || '0'}
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-blue-500" />
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  budgetUtilization > 90
                    ? 'bg-red-500'
                    : budgetUtilization > 70
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {budgetUtilization.toFixed(1)}% utilized
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Exposure</p>
              <p className="text-2xl font-bold mt-1">${totalExposure.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500" />
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-xs text-gray-500">
              Trades: {positions.length} positions (${tradeExposure.toFixed(0)})
            </p>
            <p className="text-xs text-gray-500">
              Snipes: {openSnipes.length} positions (${snipeExposure.toFixed(0)})
            </p>
            <p className="text-xs text-gray-500">
              Spreads: {spreadStats?.open_trades || 0} trades (${spreadExposure.toFixed(0)})
            </p>
            <p className="text-xs text-gray-500">
              Active Markets: {status?.active_markets || 0}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">P&L Today</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  (budget?.profit_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                ${budget?.profit_loss?.toFixed(2) || '0.00'}
              </p>
            </div>
            <DollarSign
              className={`w-12 h-12 ${
                (budget?.profit_loss || 0) >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
            />
          </div>
          <div className="mt-4">
            <p className="text-xs text-gray-500">
              {(budget?.profit_loss || 0) >= 0 ? 'Profit' : 'Loss'} on {budget?.trades_count || 0}{' '}
              trades
            </p>
          </div>
        </div>
      </div>

      {/* Paper Trading Warning */}
      {status?.paper_trading_mode && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
            <p className="text-yellow-800">
              <strong>Paper Trading Mode Active:</strong> All trades are simulated. No real money
              is being used.
            </p>
          </div>
        </div>
      )}

      {/* Open Positions */}
      <CollapsibleSection
        title="Open Positions"
        badge={positions.length > 0 ? <span className="text-sm text-gray-500">({positions.length})</span> : undefined}
        actions={
          positions.length > 0 ? (
            <button
              onClick={async () => {
                if (!confirm('Clear all open positions? This cannot be undone.')) return;
                try {
                  await tradesApi.clearPositions();
                  loadDashboardData();
                } catch (e) {
                  console.error('Failed to clear positions:', e);
                }
              }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Clear all positions"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          ) : undefined
        }
      >
        {(() => {
          const openPositions = positions.filter(
            (p: any) => !p.market_end_date || new Date(p.market_end_date).getTime() > Date.now()
          );
          const awaitingResolution = positions.filter(
            (p: any) => p.market_end_date && new Date(p.market_end_date).getTime() <= Date.now()
          );
          return openPositions.length === 0 && awaitingResolution.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No open positions</p>
          ) : (
            <div className="space-y-4">
              {awaitingResolution.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Awaiting Resolution</p>
                  {awaitingResolution.map((position: any) => (
                    <div key={position.id} className="border-l-4 border-gray-300 pl-4 py-2 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{position.market_question || `Market #${position.market_id}`}</p>
                          <span className="text-xs text-gray-400">Market ended — pending resolution</span>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {position.side} {position.outcome}
                          </p>
                          <p className="text-sm text-gray-600">${position.size}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {openPositions.slice(0, 5).map((position: any) => (
                <div key={position.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{position.market_question || `Market #${position.market_id}`}</p>
                      {position.market_end_date && <Countdown endDate={position.market_end_date} />}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {position.side} {position.outcome}
                      </p>
                      <p className="text-sm text-gray-600">${position.size} @ ${position.price?.toFixed(2)}</p>
                    </div>
                  </div>
                  <PriceChart marketId={position.market_id} marketQuestion={position.market_question || ''} />
                </div>
              ))}
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* Sniped Positions */}
      {snipedPositions.length > 0 && (
        <CollapsibleSection
          title="Sniped Positions"
          icon={<Crosshair className="w-5 h-5 text-green-600" />}
          badge={<span className="text-sm text-gray-500">({snipedPositions.filter((p: any) => p.status === 'OPEN').length} open)</span>}
        >
          <div className="space-y-3">
            {snipedPositions.filter((p: any) => p.status === 'OPEN').slice(0, 10).map((pos: any) => {
              const pnlPct = pos.current_price && pos.entry_price
                ? ((pos.current_price - pos.entry_price) / pos.entry_price) * 100
                : 0;
              return (
                <div key={pos.id} className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{pos.title}</p>
                      <p className="text-xs text-gray-500">
                        {pos.outcome} @ ${pos.entry_price?.toFixed(3)} | From: {pos.source_trader_name || 'Unknown'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${pnlPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-600">${pos.size} position</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {snipedPositions.filter((p: any) => p.status === 'CLOSED').length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Recently Closed</p>
                {snipedPositions.filter((p: any) => p.status === 'CLOSED').slice(0, 5).map((pos: any) => (
                  <div key={pos.id} className="flex items-center justify-between py-1 opacity-60">
                    <div className="flex items-center gap-2">
                      {(pos.realized_pnl || 0) >= 0 ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm truncate">{pos.title?.slice(0, 40)}</span>
                    </div>
                    <span className={`text-sm font-semibold ${(pos.realized_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(pos.realized_pnl || 0) >= 0 ? '+' : ''}${(pos.realized_pnl || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Arbitrage / Spread Trades */}
      {(openSpreadTrades.length > 0 || closedSpreadTrades.length > 0) && (
        <CollapsibleSection
          title="Arbitrage Positions"
          icon={<Percent className="w-5 h-5 text-indigo-600" />}
          badge={
            <span className="text-sm text-gray-500">
              ({openSpreadTrades.length} open{spreadStats?.total_realized_pnl ? `, P&L: $${spreadStats.total_realized_pnl.toFixed(2)}` : ''})
            </span>
          }
        >
          <div className="space-y-3">
            {openSpreadTrades.map((trade: any) => {
              const outcomes: string[] = JSON.parse(trade.outcomes_json || '[]');
              const profitPct = trade.total_invested > 0
                ? (trade.expected_profit / trade.total_invested) * 100
                : 0;
              const isPastEnd = trade.end_date && new Date(trade.end_date).getTime() <= Date.now();
              return (
                <div key={trade.id} className="border-l-4 border-indigo-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${trade.opportunity_type === 'SINGLE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {trade.opportunity_type}
                        </span>
                        <p className="font-medium text-gray-900 truncate">{trade.question}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {outcomes.join(' + ')} | ${trade.size_per_outcome?.toFixed(2)} each
                      </p>
                      {trade.end_date && (
                        <p className={`text-xs mt-0.5 ${isPastEnd ? 'text-blue-500' : 'text-orange-500'}`}>
                          {isPastEnd ? 'Market ended — awaiting resolution' : `Ends ${new Date(trade.end_date).toLocaleDateString()} ${new Date(trade.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold">${trade.total_invested?.toFixed(2)}</p>
                      <p className="text-sm text-green-600">
                        +${trade.expected_profit?.toFixed(2)} ({profitPct.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {closedSpreadTrades.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Recently Closed</p>
                {closedSpreadTrades.slice(0, 5).map((trade: any) => (
                  <div key={trade.id} className="flex items-center justify-between py-1 opacity-60">
                    <div className="flex items-center gap-2">
                      {(trade.realized_pnl || 0) >= 0 ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm truncate">{trade.question?.slice(0, 50)}</span>
                    </div>
                    <span className={`text-sm font-semibold ${(trade.realized_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(trade.realized_pnl || 0) >= 0 ? '+' : ''}${(trade.realized_pnl || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Resolved Trades */}
      <CollapsibleSection
        title="Resolved Trades"
        defaultOpen={false}
        badge={resolvedTrades.length > 0 ? <span className="text-sm text-gray-500">({resolvedTrades.length})</span> : undefined}
      >
        {resolvedTrades.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No resolved trades yet</p>
        ) : (
          <div className="space-y-4">
            {resolvedTrades.slice(0, 10).map((trade: any) => {
              const won = trade.outcome === trade.resolved_outcome;
              return (
                <div key={trade.id} className={`border-l-4 ${won ? 'border-green-500' : 'border-red-500'} pl-4 py-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{trade.market_question || `Market #${trade.market_id}`}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {won ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                            <CheckCircle className="w-3 h-3" /> Won
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                            <XCircle className="w-3 h-3" /> Lost
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {trade.side} {trade.outcome} {trade.price > 0 ? `@ $${trade.price?.toFixed(2)}` : '(no price data)'} | Resolved: {trade.resolved_outcome}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${(trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trade.price > 0
                          ? `${(trade.pnl || 0) >= 0 ? '+' : ''}$${(trade.pnl || 0).toFixed(2)}`
                          : <span className="text-gray-400">N/A</span>}
                      </p>
                      <p className="text-sm text-gray-600">${trade.size} bet</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Recent Analyses */}
      <CollapsibleSection
        title="Recent AI Analyses"
        defaultOpen={false}
        badge={recentAnalyses.length > 0 ? <span className="text-sm text-gray-500">({recentAnalyses.length})</span> : undefined}
      >
        {recentAnalyses.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No analyses yet</p>
        ) : (
          <div className="space-y-4">
            {recentAnalyses.map((analysis: any) => {
              const response = JSON.parse(analysis.claude_response);
              return (
                <div key={analysis.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{analysis.market_question || `Market #${analysis.market_id}`}</p>
                      <p className="font-semibold text-gray-900">{analysis.decision || 'HOLD'}</p>
                      <p className="text-sm text-gray-600">
                        Confidence: {((analysis.confidence || 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(analysis.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{response.reasoning}</p>
                  {response.key_factors && response.key_factors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-600">Key Factors:</p>
                      <ul className="text-xs text-gray-600 list-disc list-inside">
                        {response.key_factors.slice(0, 3).map((factor: string, i: number) => (
                          <li key={i}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
