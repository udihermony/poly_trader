import { useState, useEffect } from 'react';
import { Bot, Play, Square, RefreshCw, AlertCircle, CheckCircle, XCircle, Settings, TrendingUp } from 'lucide-react';
import { tradingApi, tradesApi, configApi } from '../services/api';
import { Link } from 'react-router-dom';

export default function AITrading() {
  const [status, setStatus] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [resolvedTrades, setResolvedTrades] = useState<any[]>([]);
  const [budget, setBudget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statusRes, analysesRes, positionsRes, resolvedRes, budgetRes] = await Promise.all([
        tradingApi.getStatus(),
        tradesApi.getAnalyses(20),
        tradesApi.getPositions(),
        tradesApi.getResolved(),
        configApi.getBudget(),
      ]);
      setStatus(statusRes.data.data);
      setAnalyses(analysesRes.data.data || []);
      setPositions(positionsRes.data.data || []);
      setResolvedTrades(resolvedRes.data.data || []);
      setBudget(budgetRes.data.data);
    } catch (error) {
      console.error('Failed to load AI trading data:', error);
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
      await loadData();
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

  const isPaperMode = status?.paper_trading_mode;
  const budgetUtilization = budget ? (budget.spent / budget.daily_budget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-purple-500" />
          <h1 className="text-2xl font-bold text-gray-900">AI Trading</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={toggleTrading}
            className={`flex items-center px-4 py-2 rounded-lg text-white ${
              status?.is_running ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {status?.is_running ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop AI Trading
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start AI Trading
              </>
            )}
          </button>
        </div>
      </div>

      {/* Paper Trading Warning */}
      {isPaperMode && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
            <p className="text-yellow-800">
              <strong>Paper Trading Mode:</strong> AI trades are simulated.{' '}
              <Link to="/settings" className="underline hover:text-yellow-900">
                Change in Settings
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Status</p>
          <p className={`text-xl font-bold ${status?.is_running ? 'text-green-600' : 'text-gray-400'}`}>
            {status?.is_running ? 'Running' : 'Stopped'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {isPaperMode ? 'Paper Mode' : 'Live Mode'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Budget Used</p>
          <p className="text-xl font-bold">
            ${budget?.spent?.toFixed(2) || '0'} / ${budget?.daily_budget || '0'}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
            <div
              className={`h-1.5 rounded-full ${
                budgetUtilization > 90 ? 'bg-red-500' : budgetUtilization > 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Open Positions</p>
          <p className="text-xl font-bold">{positions.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            ${positions.reduce((sum, p) => sum + (p.size || 0), 0).toFixed(2)} exposure
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">P&L Today</p>
          <p className={`text-xl font-bold ${(budget?.profit_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${budget?.profit_loss?.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{budget?.trades_count || 0} trades</p>
        </div>
      </div>

      {/* AI Open Positions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI Positions</h2>
          {positions.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm('Clear all AI positions?')) return;
                await tradesApi.clearPositions();
                loadData();
              }}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Clear All
            </button>
          )}
        </div>
        {positions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No open AI positions</div>
        ) : (
          <div className="divide-y">
            {positions.map((pos: any) => (
              <div key={pos.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{pos.market_question || `Market #${pos.market_id}`}</p>
                  <p className="text-sm text-gray-500">
                    {pos.side} {pos.outcome} @ ${pos.price?.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${pos.size}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved Trades */}
      {resolvedTrades.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Resolved Trades</h2>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {resolvedTrades.slice(0, 10).map((trade: any) => {
              const won = trade.outcome === trade.resolved_outcome;
              return (
                <div key={trade.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {won ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">{trade.market_question || `Market #${trade.market_id}`}</p>
                      <p className="text-sm text-gray-500">
                        {trade.side} {trade.outcome} → Resolved: {trade.resolved_outcome}
                      </p>
                    </div>
                  </div>
                  <p className={`font-semibold ${(trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent AI Analyses */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Recent AI Analyses</h2>
        </div>
        {analyses.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No analyses yet. Start AI trading to analyze markets.
          </div>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto">
            {analyses.map((analysis: any) => {
              let response;
              try {
                response = JSON.parse(analysis.claude_response);
              } catch {
                response = { reasoning: 'Unable to parse response' };
              }
              return (
                <div key={analysis.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{analysis.market_question || `Market #${analysis.market_id}`}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
                          analysis.decision?.includes('BUY') ? 'bg-green-100 text-green-700' :
                          analysis.decision?.includes('SELL') ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {analysis.decision || 'HOLD'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {((analysis.confidence || 0) * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(analysis.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{response.reasoning}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
