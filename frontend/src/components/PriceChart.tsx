import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { marketsApi } from '../services/api';

interface PricePoint {
  timestamp: number;
  yes_price: number;
  no_price: number;
}

interface PriceChartProps {
  marketId: string;
  marketQuestion: string;
}

export function PriceChart({ marketId, marketQuestion }: PriceChartProps) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await marketsApi.getPriceHistory(marketId, 100);
        setData(response.data.data || []);
      } catch (e) {
        console.error('Failed to fetch price history:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    // Refresh every 5 minutes
    const interval = setInterval(fetchHistory, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [marketId]);

  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
        Loading price history...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
        No price history available yet
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatPrice = (price: number) => `${(price * 100).toFixed(0)}%`;

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-500 mb-1 truncate" title={marketQuestion}>
        {marketQuestion.slice(0, 50)}{marketQuestion.length > 50 ? '...' : ''}
      </p>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fontSize: 10 }}
            stroke="#9ca3af"
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={formatPrice}
            tick={{ fontSize: 10 }}
            stroke="#9ca3af"
            width={35}
          />
          <Tooltip
            labelFormatter={(ts) => new Date(Number(ts) * 1000).toLocaleString()}
            formatter={(value: number, name: string) => [
              `${(value * 100).toFixed(1)}%`,
              name === 'yes_price' ? 'YES' : 'NO'
            ]}
            contentStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="yes_price"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            name="YES"
          />
          <Line
            type="monotone"
            dataKey="no_price"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name="NO"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
