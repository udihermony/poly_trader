import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../database/polytrader.db');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
export const db: Database.Database = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema immediately
function initializeDatabase() {
  // Monitored markets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS monitored_markets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id TEXT UNIQUE NOT NULL,
      condition_id TEXT,
      clob_token_ids TEXT,
      question TEXT NOT NULL,
      slug TEXT,
      end_date TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add clob_token_ids column if it doesn't exist
  const marketCols: any[] = db.prepare("PRAGMA table_info(monitored_markets)").all();
  if (!marketCols.find((c: any) => c.name === 'clob_token_ids')) {
    db.exec("ALTER TABLE monitored_markets ADD COLUMN clob_token_ids TEXT");
  }

  // Price history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      yes_price REAL NOT NULL,
      no_price REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(market_id, timestamp),
      FOREIGN KEY (market_id) REFERENCES monitored_markets(market_id)
    );
  `);

  // Index for fast lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_price_history_market_time ON price_history(market_id, timestamp DESC)`);

  // Trades table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id TEXT NOT NULL,
      order_id TEXT UNIQUE,
      side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
      outcome TEXT NOT NULL CHECK(outcome IN ('YES', 'NO')),
      size REAL NOT NULL,
      price REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED')),
      claude_reasoning TEXT,
      is_paper_trade BOOLEAN DEFAULT 0,
      executed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (market_id) REFERENCES monitored_markets(market_id)
    );
  `);

  // Sniped positions table (copy-trading from leaderboard)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sniped_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      condition_id TEXT NOT NULL,
      token_id TEXT,
      title TEXT NOT NULL,
      slug TEXT,
      outcome TEXT NOT NULL,
      entry_price REAL NOT NULL,
      current_price REAL,
      size REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED', 'EXPIRED')),
      source_trader TEXT,
      source_trader_name TEXT,
      profit_target REAL DEFAULT 0.05,
      realized_pnl REAL,
      is_paper_trade BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP
    );
  `);

  // Risk configuration table
  db.exec(`
    CREATE TABLE IF NOT EXISTS risk_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      max_bet_size REAL NOT NULL DEFAULT 10,
      daily_budget REAL NOT NULL DEFAULT 100,
      max_open_positions INTEGER DEFAULT 10,
      min_confidence_threshold REAL DEFAULT 0.6,
      max_market_exposure REAL DEFAULT 50,
      snipe_enabled BOOLEAN DEFAULT 0,
      snipe_size REAL DEFAULT 10,
      snipe_profit_target REAL DEFAULT 0.05,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add snipe columns if they don't exist
  const riskCols: any[] = db.prepare("PRAGMA table_info(risk_config)").all();
  if (!riskCols.find((c: any) => c.name === 'snipe_enabled')) {
    db.exec("ALTER TABLE risk_config ADD COLUMN snipe_enabled BOOLEAN DEFAULT 0");
    db.exec("ALTER TABLE risk_config ADD COLUMN snipe_size REAL DEFAULT 10");
    db.exec("ALTER TABLE risk_config ADD COLUMN snipe_profit_target REAL DEFAULT 0.05");
  }

  // Budget tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE UNIQUE NOT NULL,
      spent REAL DEFAULT 0,
      profit_loss REAL DEFAULT 0,
      trades_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Credentials table (encrypted storage)
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      polymarket_api_key TEXT,
      polymarket_secret TEXT,
      polymarket_passphrase TEXT,
      polymarket_funder_address TEXT,
      claude_api_key TEXT,
      gemini_api_key TEXT,
      local_llm_url TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add resolved_outcome column to trades
  try {
    db.exec(`ALTER TABLE trades ADD COLUMN resolved_outcome TEXT`);
  } catch (error: any) {
    if (!error.message.includes('duplicate column')) throw error;
  }

  // Migration: Add pnl column to trades
  try {
    db.exec(`ALTER TABLE trades ADD COLUMN pnl REAL`);
  } catch (error: any) {
    if (!error.message.includes('duplicate column')) throw error;
  }

  // Migration: Relax status constraint to include RESOLVED
  const tradesSchema: any = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='trades'").get();
  if (tradesSchema && !tradesSchema.sql.includes('RESOLVED')) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE trades_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id TEXT NOT NULL,
        order_id TEXT UNIQUE,
        side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
        outcome TEXT NOT NULL CHECK(outcome IN ('YES', 'NO')),
        size REAL NOT NULL,
        price REAL NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED', 'RESOLVED')),
        claude_reasoning TEXT,
        is_paper_trade BOOLEAN DEFAULT 0,
        executed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_outcome TEXT,
        pnl REAL,
        FOREIGN KEY (market_id) REFERENCES monitored_markets(market_id)
      );
      INSERT INTO trades_new SELECT id, market_id, order_id, side, outcome, size, price, status, claude_reasoning, is_paper_trade, executed_at, created_at, resolved_outcome, pnl FROM trades;
      DROP TABLE trades;
      ALTER TABLE trades_new RENAME TO trades;
    `);
    db.pragma('foreign_keys = ON');
    console.log('Migrated trades table to support RESOLVED status');
  }

  // Migration: Add gemini_api_key column if it doesn't exist
  try {
    db.exec(`ALTER TABLE credentials ADD COLUMN gemini_api_key TEXT`);
  } catch (error: any) {
    // Column already exists, ignore
    if (!error.message.includes('duplicate column')) {
      throw error;
    }
  }

  // Migration: Add local_llm_url column if it doesn't exist
  try {
    db.exec(`ALTER TABLE credentials ADD COLUMN local_llm_url TEXT`);
  } catch (error: any) {
    // Column already exists, ignore
    if (!error.message.includes('duplicate column')) {
      throw error;
    }
  }

  // Analysis logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id TEXT NOT NULL,
      market_data TEXT NOT NULL,
      claude_prompt TEXT NOT NULL,
      claude_response TEXT NOT NULL,
      decision TEXT CHECK(decision IN ('BUY_YES', 'BUY_NO', 'SELL_YES', 'SELL_NO', 'HOLD')),
      confidence REAL,
      trade_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trade_id) REFERENCES trades(id)
    );
  `);

  // App configuration table
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      paper_trading_mode BOOLEAN DEFAULT 1,
      trading_enabled BOOLEAN DEFAULT 0,
      analysis_interval_minutes INTEGER DEFAULT 5,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Last analysis tracking (for cooldown)
  db.exec(`
    CREATE TABLE IF NOT EXISTS last_analysis (
      market_id TEXT PRIMARY KEY,
      last_analyzed_at TIMESTAMP NOT NULL,
      FOREIGN KEY (market_id) REFERENCES monitored_markets(market_id)
    );
  `);

  // Insert default risk config if not exists
  const riskConfig = db.prepare('SELECT id FROM risk_config WHERE id = 1').get();
  if (!riskConfig) {
    db.prepare(`
      INSERT INTO risk_config (id, max_bet_size, daily_budget, max_open_positions, min_confidence_threshold, max_market_exposure)
      VALUES (1, 10, 100, 10, 0.6, 50)
    `).run();
  }

  // Insert default app config if not exists
  const appConfig = db.prepare('SELECT id FROM app_config WHERE id = 1').get();
  if (!appConfig) {
    db.prepare(`
      INSERT INTO app_config (id, paper_trading_mode, trading_enabled, analysis_interval_minutes)
      VALUES (1, 1, 0, 5)
    `).run();
  }

  // Spread config table (singleton)
  db.exec(`
    CREATE TABLE IF NOT EXISTS spread_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      spread_enabled BOOLEAN DEFAULT 0,
      scan_interval_seconds INTEGER DEFAULT 60,
      min_spread_threshold REAL DEFAULT 0.01,
      max_spread_bet_size REAL DEFAULT 10,
      auto_execute BOOLEAN DEFAULT 0,
      scan_multi_outcome BOOLEAN DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default spread config if not exists
  const spreadConfig = db.prepare('SELECT id FROM spread_config WHERE id = 1').get();
  if (!spreadConfig) {
    db.prepare(`
      INSERT INTO spread_config (id, spread_enabled, scan_interval_seconds, min_spread_threshold, max_spread_bet_size, auto_execute, scan_multi_outcome)
      VALUES (1, 0, 60, 0.01, 10, 0, 1)
    `).run();
  }

  // Spread opportunities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS spread_opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_type TEXT NOT NULL CHECK(opportunity_type IN ('SINGLE', 'MULTI')),
      market_id TEXT,
      event_id TEXT,
      condition_id TEXT,
      question TEXT NOT NULL,
      slug TEXT,
      outcomes_json TEXT NOT NULL,
      prices_json TEXT NOT NULL,
      total_cost REAL NOT NULL,
      guaranteed_payout REAL NOT NULL DEFAULT 1.0,
      spread_profit REAL NOT NULL,
      spread_pct REAL NOT NULL,
      liquidity REAL,
      volume_24h REAL,
      end_date TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: add end_date to spread_opportunities if missing
  try {
    db.exec("ALTER TABLE spread_opportunities ADD COLUMN end_date TIMESTAMP");
  } catch (error: any) {
    if (!error.message.includes('duplicate column')) throw error;
  }

  // Spread trades table
  db.exec(`
    CREATE TABLE IF NOT EXISTS spread_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_id INTEGER,
      opportunity_type TEXT NOT NULL CHECK(opportunity_type IN ('SINGLE', 'MULTI')),
      market_id TEXT,
      event_id TEXT,
      condition_id TEXT,
      question TEXT NOT NULL,
      slug TEXT,
      outcomes_json TEXT NOT NULL,
      end_date TIMESTAMP,
      total_cost REAL NOT NULL,
      guaranteed_payout REAL NOT NULL DEFAULT 1.0,
      expected_profit REAL NOT NULL,
      size_per_outcome REAL NOT NULL,
      num_outcomes INTEGER NOT NULL,
      total_invested REAL NOT NULL,
      order_ids_json TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED', 'FAILED')),
      realized_pnl REAL,
      is_paper_trade BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP
    );
  `);

  // Migration: add end_date to spread_trades if missing
  try {
    db.exec("ALTER TABLE spread_trades ADD COLUMN end_date TIMESTAMP");
  } catch (error: any) {
    if (!error.message.includes('duplicate column')) throw error;
  }

  console.log('Database initialized successfully');
}

// Initialize database immediately on module load
initializeDatabase();

// Helper functions for database operations
export const queries: Record<string, any> = {
  // Monitored Markets
  getMonitoredMarkets: db.prepare('SELECT * FROM monitored_markets WHERE is_active = 1'),
  getMarketById: db.prepare('SELECT * FROM monitored_markets WHERE market_id = ?'),
  addMonitoredMarket: db.prepare(`
    INSERT INTO monitored_markets (market_id, condition_id, clob_token_ids, question, slug, end_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  updateMarketTokenIds: db.prepare('UPDATE monitored_markets SET clob_token_ids = ? WHERE market_id = ?'),
  updateMarketStatus: db.prepare('UPDATE monitored_markets SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE market_id = ?'),

  // Price history
  addPriceHistory: db.prepare(`
    INSERT OR REPLACE INTO price_history (market_id, timestamp, yes_price, no_price)
    VALUES (?, ?, ?, ?)
  `),
  getPriceHistory: db.prepare(`
    SELECT timestamp, yes_price, no_price FROM price_history
    WHERE market_id = ? ORDER BY timestamp ASC
  `),
  getRecentPriceHistory: db.prepare(`
    SELECT timestamp, yes_price, no_price FROM price_history
    WHERE market_id = ? ORDER BY timestamp DESC LIMIT ?
  `),

  // Sniped positions
  addSnipedPosition: db.prepare(`
    INSERT INTO sniped_positions (condition_id, token_id, title, slug, outcome, entry_price, size, source_trader, source_trader_name, profit_target, is_paper_trade)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getOpenSnipedPositions: db.prepare(`
    SELECT * FROM sniped_positions WHERE status = 'OPEN' ORDER BY created_at DESC
  `),
  getSnipedPositionByCondition: db.prepare(`
    SELECT * FROM sniped_positions WHERE condition_id = ? AND outcome = ? AND status = 'OPEN'
  `),
  updateSnipedPositionPrice: db.prepare(`
    UPDATE sniped_positions SET current_price = ? WHERE id = ?
  `),
  closeSnipedPosition: db.prepare(`
    UPDATE sniped_positions SET status = 'CLOSED', current_price = ?, realized_pnl = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?
  `),
  getAllSnipedPositions: db.prepare(`
    SELECT * FROM sniped_positions ORDER BY created_at DESC LIMIT 50
  `),
  clearOpenSnipedPositions: db.prepare(`
    DELETE FROM sniped_positions WHERE status = 'OPEN'
  `),

  // Trades
  getAllTrades: db.prepare(`
    SELECT t.*, m.question as market_question FROM trades t
    LEFT JOIN monitored_markets m ON t.market_id = m.market_id
    ORDER BY t.created_at DESC
  `),
  getOpenPositionForMarket: db.prepare(`
    SELECT * FROM trades WHERE market_id = ? AND status = 'EXECUTED' ORDER BY created_at DESC LIMIT 1
  `),
  getTradesByMarket: db.prepare(`
    SELECT t.*, m.question as market_question FROM trades t
    LEFT JOIN monitored_markets m ON t.market_id = m.market_id
    WHERE t.market_id = ? ORDER BY t.created_at DESC
  `),
  getOpenPositions: db.prepare(`
    SELECT t.*, m.question as market_question, m.end_date as market_end_date FROM trades t
    LEFT JOIN monitored_markets m ON t.market_id = m.market_id
    WHERE t.status = 'EXECUTED' ORDER BY t.created_at DESC
  `),
  getTrueOpenPositions: db.prepare(`
    SELECT t.*, m.question as market_question, m.end_date as market_end_date FROM trades t
    LEFT JOIN monitored_markets m ON t.market_id = m.market_id
    WHERE t.status = 'EXECUTED' AND (m.end_date IS NULL OR datetime(m.end_date) > datetime('now'))
    ORDER BY t.created_at DESC
  `),
  getActiveNonExpiredMarkets: db.prepare(`
    SELECT * FROM monitored_markets WHERE is_active = 1 AND (end_date IS NULL OR datetime(end_date) > datetime('now'))
  `),
  deactivateExpiredMarkets: db.prepare(`
    UPDATE monitored_markets SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE is_active = 1 AND end_date IS NOT NULL AND datetime(end_date) < datetime('now')
  `),
  addTrade: db.prepare(`
    INSERT INTO trades (market_id, order_id, side, outcome, size, price, status, claude_reasoning, is_paper_trade, executed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateTradeStatus: db.prepare('UPDATE trades SET status = ?, executed_at = ? WHERE id = ?'),
  getUnresolvedTrades: db.prepare(`
    SELECT t.*, m.question as market_question, m.end_date as market_end_date
    FROM trades t
    JOIN monitored_markets m ON t.market_id = m.market_id
    WHERE t.status = 'EXECUTED' AND datetime(m.end_date) < datetime('now')
  `),
  resolveTrade: db.prepare('UPDATE trades SET status = ?, resolved_outcome = ?, pnl = ? WHERE id = ?'),
  getResolvedTrades: db.prepare(`
    SELECT t.*, m.question as market_question, m.end_date as market_end_date
    FROM trades t
    LEFT JOIN monitored_markets m ON t.market_id = m.market_id
    WHERE t.status = 'RESOLVED' ORDER BY t.created_at DESC
  `),
  clearExecutedTrades: db.prepare(`DELETE FROM trades WHERE status = 'EXECUTED'`),

  // Risk Config
  getRiskConfig: db.prepare('SELECT * FROM risk_config WHERE id = 1'),
  updateRiskConfig: db.prepare(`
    UPDATE risk_config
    SET max_bet_size = ?, daily_budget = ?, max_open_positions = ?,
        min_confidence_threshold = ?, max_market_exposure = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `),

  // Budget Tracking
  getTodayBudget: db.prepare("SELECT * FROM budget_tracking WHERE date = DATE('now')"),
  createTodayBudget: db.prepare("INSERT INTO budget_tracking (date, spent, profit_loss, trades_count) VALUES (DATE('now'), 0, 0, 0)"),
  updateBudget: db.prepare(`
    UPDATE budget_tracking
    SET spent = spent + ?, profit_loss = profit_loss + ?, trades_count = trades_count + 1
    WHERE date = DATE('now')
  `),

  // Credentials
  getCredentials: db.prepare('SELECT * FROM credentials WHERE id = 1'),
  upsertCredentials: db.prepare(`
    INSERT INTO credentials (id, polymarket_api_key, polymarket_secret, polymarket_passphrase, polymarket_funder_address, claude_api_key, gemini_api_key, local_llm_url)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      polymarket_api_key = excluded.polymarket_api_key,
      polymarket_secret = excluded.polymarket_secret,
      polymarket_passphrase = excluded.polymarket_passphrase,
      polymarket_funder_address = excluded.polymarket_funder_address,
      claude_api_key = excluded.claude_api_key,
      gemini_api_key = excluded.gemini_api_key,
      local_llm_url = excluded.local_llm_url,
      updated_at = CURRENT_TIMESTAMP
  `),

  // Analysis Logs
  addAnalysisLog: db.prepare(`
    INSERT INTO analysis_logs (market_id, market_data, claude_prompt, claude_response, decision, confidence, trade_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getRecentAnalyses: db.prepare(`
    SELECT a.*, m.question as market_question FROM analysis_logs a
    LEFT JOIN monitored_markets m ON a.market_id = m.market_id
    ORDER BY a.created_at DESC LIMIT ?
  `),

  // App Config
  getAppConfig: db.prepare('SELECT * FROM app_config WHERE id = 1'),
  updateAppConfig: db.prepare(`
    UPDATE app_config
    SET paper_trading_mode = ?, trading_enabled = ?, analysis_interval_minutes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `),

  // Last Analysis
  getLastAnalysis: db.prepare('SELECT * FROM last_analysis WHERE market_id = ?'),
  upsertLastAnalysis: db.prepare(`
    INSERT INTO last_analysis (market_id, last_analyzed_at)
    VALUES (?, CURRENT_TIMESTAMP)
    ON CONFLICT(market_id) DO UPDATE SET last_analyzed_at = CURRENT_TIMESTAMP
  `),

  // Spread Config
  getSpreadConfig: db.prepare('SELECT * FROM spread_config WHERE id = 1'),
  updateSpreadConfig: db.prepare(`
    UPDATE spread_config
    SET spread_enabled = ?, scan_interval_seconds = ?, min_spread_threshold = ?,
        max_spread_bet_size = ?, auto_execute = ?, scan_multi_outcome = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `),

  // Spread Opportunities
  addSpreadOpportunity: db.prepare(`
    INSERT INTO spread_opportunities (opportunity_type, market_id, event_id, condition_id, question, slug, outcomes_json, prices_json, total_cost, guaranteed_payout, spread_profit, spread_pct, liquidity, volume_24h, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getActiveSpreadOpportunities: db.prepare(`
    SELECT * FROM spread_opportunities WHERE is_active = 1 ORDER BY spread_pct DESC
  `),
  findExistingOpportunity: db.prepare(`
    SELECT * FROM spread_opportunities WHERE is_active = 1 AND opportunity_type = ? AND (market_id = ? OR event_id = ?) LIMIT 1
  `),
  updateOpportunityLastSeen: db.prepare(`
    UPDATE spread_opportunities SET last_seen_at = CURRENT_TIMESTAMP, prices_json = ?, total_cost = ?, spread_profit = ?, spread_pct = ? WHERE id = ?
  `),
  deactivateStaleOpportunities: db.prepare(`
    UPDATE spread_opportunities SET is_active = 0 WHERE is_active = 1 AND last_seen_at < datetime('now', '-5 minutes')
  `),
  clearSpreadOpportunities: db.prepare(`
    DELETE FROM spread_opportunities
  `),

  // Spread Trades
  addSpreadTrade: db.prepare(`
    INSERT INTO spread_trades (opportunity_id, opportunity_type, market_id, event_id, condition_id, question, slug, outcomes_json, end_date, total_cost, guaranteed_payout, expected_profit, size_per_outcome, num_outcomes, total_invested, order_ids_json, status, is_paper_trade)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
  `),
  getOpenSpreadTrades: db.prepare(`
    SELECT * FROM spread_trades WHERE status = 'OPEN' ORDER BY created_at DESC
  `),
  getAllSpreadTrades: db.prepare(`
    SELECT * FROM spread_trades ORDER BY created_at DESC LIMIT ?
  `),
  closeSpreadTrade: db.prepare(`
    UPDATE spread_trades SET status = 'CLOSED', realized_pnl = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?
  `),
  failSpreadTrade: db.prepare(`
    UPDATE spread_trades SET status = 'FAILED', closed_at = CURRENT_TIMESTAMP WHERE id = ?
  `),
  getSpreadTradeStats: db.prepare(`
    SELECT
      COUNT(*) as total_trades,
      SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_trades,
      SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_trades,
      SUM(CASE WHEN status = 'OPEN' THEN total_invested ELSE 0 END) as open_exposure,
      SUM(CASE WHEN status = 'CLOSED' THEN realized_pnl ELSE 0 END) as total_realized_pnl,
      SUM(total_invested) as total_invested
    FROM spread_trades
  `),
  clearOpenSpreadTrades: db.prepare(`
    DELETE FROM spread_trades WHERE status = 'OPEN'
  `),
};

export default db;
