// Market types
export interface MonitoredMarket {
  id?: number;
  market_id: string;
  condition_id?: string;
  question: string;
  slug?: string;
  end_date?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Trade types
export type TradeSide = 'BUY' | 'SELL';
export type TradeOutcome = 'YES' | 'NO';
export type TradeStatus = 'PENDING' | 'EXECUTED' | 'FAILED' | 'CANCELLED';

export interface Trade {
  id?: number;
  market_id: string;
  order_id?: string;
  side: TradeSide;
  outcome: TradeOutcome;
  size: number;
  price: number;
  status: TradeStatus;
  claude_reasoning?: string;
  is_paper_trade: boolean;
  executed_at?: string;
  created_at?: string;
}

// Claude decision types
export type ClaudeDecision = 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO' | 'SELL' | 'HOLD';

export interface ClaudeAnalysis {
  decision: ClaudeDecision;
  confidence: number;
  reasoning: string;
  suggested_size: number;
  key_factors: string[];
  risks: string[];
}

// Current position info
export interface CurrentPosition {
  outcome: TradeOutcome;
  size: number;
  entry_price: number;
  current_value: number;
  unrealized_pnl: number;
}

// Market data from Polymarket
export interface MarketData {
  question: string;
  market_id: string;
  condition_id: string;
  yes_price: number;
  no_price: number;
  volume_24h: number;
  liquidity: number;
  end_date: string;
  time_remaining_hours: number;
  recent_trend?: string;
  current_position?: CurrentPosition;
}
