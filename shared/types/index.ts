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
export type ClaudeDecision = 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO' | 'HOLD';

export interface ClaudeAnalysis {
  decision: ClaudeDecision;
  confidence: number;
  reasoning: string;
  suggested_size: number;
  key_factors: string[];
  risks: string[];
}

// Analysis log
export interface AnalysisLog {
  id?: number;
  market_id: string;
  market_data: string;
  claude_prompt: string;
  claude_response: string;
  decision?: ClaudeDecision;
  confidence?: number;
  trade_id?: number;
  created_at?: string;
}

// Risk configuration
export interface RiskConfig {
  id?: number;
  max_bet_size: number;
  daily_budget: number;
  max_open_positions: number;
  min_confidence_threshold: number;
  max_market_exposure: number;
  updated_at?: string;
}

// Budget tracking
export interface BudgetTracking {
  id?: number;
  date: string;
  spent: number;
  profit_loss: number;
  trades_count: number;
  created_at?: string;
}

// App configuration
export interface AppConfig {
  id?: number;
  paper_trading_mode: boolean;
  trading_enabled: boolean;
  analysis_interval_minutes: number;
  updated_at?: string;
}

// Credentials
export interface Credentials {
  polymarket_api_key?: string;
  polymarket_secret?: string;
  polymarket_passphrase?: string;
  polymarket_funder_address?: string;
  claude_api_key?: string;
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
}

// WebSocket events
export interface WebSocketEvents {
  'market:update': MarketData;
  'trade:executed': Trade;
  'analysis:complete': AnalysisLog;
  'budget:update': BudgetTracking;
  'system:status': {
    trading_enabled: boolean;
    paper_trading_mode: boolean;
    active_markets: number;
    open_positions: number;
  };
  'error': {
    message: string;
    type: string;
  };
}
