import { useState, useEffect } from 'react';
import { RefreshCw, Eye } from 'lucide-react';
import { tradesApi } from '../services/api';

export default function TradeHistory() {
  const [trades, setTrades] = useState<any[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    try {
      const res = await tradesApi.getAllTrades(undefined, 100);
      setTrades(res.data.data);
    } catch (error) {
      console.error('Failed to load trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      EXECUTED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Trade History</h1>
        <button
          onClick={loadTrades}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {trades.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">No trades yet. Enable trading and add markets to start.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Market
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(trade.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {trade.market_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span
                      className={
                        trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {trade.side} {trade.outcome}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${trade.size.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(trade.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        trade.is_paper_trade
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {trade.is_paper_trade ? 'Paper' : 'Live'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedTrade(trade)}
                      className="text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trade Details Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold">Trade Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700">Trade Information</h3>
                <div className="mt-2 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">ID:</span> {selectedTrade.id}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Order ID:</span> {selectedTrade.order_id || 'N/A'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Market:</span> {selectedTrade.market_id}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Action:</span> {selectedTrade.side}{' '}
                    {selectedTrade.outcome}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Size:</span> ${selectedTrade.size.toFixed(2)}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Price:</span> ${selectedTrade.price.toFixed(3)}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Status:</span> {selectedTrade.status}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Type:</span>{' '}
                    {selectedTrade.is_paper_trade ? 'Paper Trade' : 'Live Trade'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(selectedTrade.created_at).toLocaleString()}
                  </p>
                  {selectedTrade.executed_at && (
                    <p className="text-sm">
                      <span className="font-medium">Executed:</span>{' '}
                      {new Date(selectedTrade.executed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {selectedTrade.claude_reasoning && (
                <div>
                  <h3 className="font-semibold text-gray-700">Claude's Analysis</h3>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedTrade.claude_reasoning}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t">
              <button
                onClick={() => setSelectedTrade(null)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
