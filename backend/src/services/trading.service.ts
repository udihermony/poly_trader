import { queries } from '../config/database';
import { polymarketService } from './polymarket.service';
import { claudeService } from './claude.service';
import { geminiService } from './gemini.service';
import { localLLMService } from './localllm.service';
import { riskService } from './risk.service';
import { MarketData, ClaudeAnalysis, TradeSide, TradeOutcome } from '../types';
import { io } from '../server';

class TradingService {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing trading service...');

      await polymarketService.initialize();
      await claudeService.initialize();
      await geminiService.initialize();
      await localLLMService.initialize();

      console.log('Trading service initialized');
    } catch (error) {
      console.error('Failed to initialize trading service:', error);
      throw error;
    }
  }

  /**
   * Start the trading loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Trading service already running');
      return;
    }

    console.log('Starting trading service...');
    this.isRunning = true;

    // Initial analysis
    await this.runTradingCycle();

    // Set up interval for periodic analysis
    const appConfig: any = queries.getAppConfig.get();
    const intervalMinutes = appConfig?.analysis_interval_minutes || 5;
    const intervalMs = intervalMinutes * 60 * 1000;

    this.intervalId = setInterval(async () => {
      await this.runTradingCycle();
    }, intervalMs);

    console.log(`Trading service started (analyzing every ${intervalMinutes} minutes)`);
  }

  /**
   * Stop the trading loop
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Trading service not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('Trading service stopped');
  }

  /**
   * Main trading cycle - analyzes all monitored markets
   */
  private async runTradingCycle(): Promise<void> {
    try {
      // Always resolve expired trades, even if trading is disabled
      await this.resolveExpiredTrades();

      if (!riskService.isTradingEnabled()) {
        console.log('Trading is disabled, skipping cycle');
        return;
      }

      const markets: any = queries.getMonitoredMarkets.all();
      console.log(`Analyzing ${markets.length} monitored markets...`);

      for (const market of markets) {
        try {
          // Fetch and store price history
          await this.updatePriceHistory(market);

          await this.analyzeAndTrade(market);
          // Small delay between markets to avoid rate limits
          await this.sleep(2000);
        } catch (error) {
          console.error(`Error analyzing market ${market.market_id}:`, error);
          io.emit('error', {
            message: `Failed to analyze market: ${market.question}`,
            type: 'analysis_error',
          });
        }
      }

      console.log('Trading cycle complete');
    } catch (error) {
      console.error('Error in trading cycle:', error);
    }
  }

  /**
   * Resolve trades on markets that have ended
   */
  async resolveExpiredTrades(): Promise<void> {
    try {
      // Deactivate markets that have ended
      queries.deactivateExpiredMarkets.run();

      const unresolvedTrades: any[] = queries.getUnresolvedTrades.all();
      if (unresolvedTrades.length === 0) return;

      console.log(`Resolving ${unresolvedTrades.length} expired trades...`);

      for (const trade of unresolvedTrades) {
        try {
          const gammaData = await polymarketService.getMarketData(trade.market_id);

          if (!gammaData || !gammaData.closed) {
            console.log(`Market ${trade.market_id} not yet closed, skipping resolution`);
            continue;
          }

          // Determine winning outcome from final outcome prices
          // In resolved markets, the winning outcome has price ~1.0
          let resolvedOutcome: string | null = null;

          if (gammaData.outcomePrices) {
            const prices = typeof gammaData.outcomePrices === 'string'
              ? JSON.parse(gammaData.outcomePrices)
              : gammaData.outcomePrices;

            // outcomePrices is typically [yesPrice, noPrice]
            const yesPrice = parseFloat(prices[0] || '0');
            const noPrice = parseFloat(prices[1] || '0');

            if (yesPrice > 0.9) resolvedOutcome = 'YES';
            else if (noPrice > 0.9) resolvedOutcome = 'NO';
          }

          if (!resolvedOutcome) {
            console.log(`Could not determine outcome for market ${trade.market_id}`);
            continue;
          }

          // Calculate P&L
          // shares = size / price, payout = shares * $1 if won, $0 if lost
          const won = trade.outcome === resolvedOutcome;
          const cost = trade.size; // amount risked
          const pnl = trade.price > 0
            ? (won ? (trade.size / trade.price) - trade.size : -trade.size)
            : (won ? 0 : -trade.size); // price=0 means no cost data, assume break-even if won

          // Update trade
          queries.resolveTrade.run('RESOLVED', resolvedOutcome, pnl, trade.id);

          // Update budget with P&L (size=0 since already tracked when trade was placed)
          await riskService.updateBudget(0, pnl);

          console.log(
            `Resolved trade #${trade.id}: ${trade.outcome} @ $${trade.price} -> ${resolvedOutcome} wins | ` +
            `${won ? 'WON' : 'LOST'} | P&L: $${pnl.toFixed(2)}`
          );

          io.emit('trade:resolved', {
            trade_id: trade.id,
            market_id: trade.market_id,
            question: trade.market_question,
            outcome: trade.outcome,
            resolved_outcome: resolvedOutcome,
            won,
            pnl,
          });
        } catch (error) {
          console.error(`Failed to resolve trade #${trade.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error resolving expired trades:', error);
    }
  }

  /**
   * Analyze a single market and execute trade if appropriate
   */
  private async analyzeAndTrade(market: any): Promise<void> {
    try {
      // Check cooldown
      const shouldAnalyze = await riskService.shouldAnalyzeMarket(market.market_id);
      if (!shouldAnalyze) {
        console.log(`Skipping ${market.question} - cooldown period`);
        return;
      }

      // Fetch market data
      const marketData = await this.fetchMarketData(market);
      if (!marketData) {
        console.log(`Failed to fetch data for ${market.question}`);
        return;
      }

      // Get AI analysis (try Claude first, fallback to Gemini, then Local LLM)
      const riskConfig: any = queries.getRiskConfig.get();
      let analysis: ClaudeAnalysis | null = null;
      let aiProvider = 'Claude';

      try {
        analysis = await claudeService.analyzeMarket(marketData, riskConfig);
      } catch (claudeError: any) {
        console.warn('Claude analysis failed:', claudeError.message);

        // Try Gemini
        let geminiSuccess = false;
        if (geminiService.isInitialized()) {
          try {
            console.log('Trying Gemini fallback...');
            analysis = await geminiService.analyzeMarket(marketData, riskConfig);
            aiProvider = 'Gemini';
            geminiSuccess = true;
            console.log('✓ Using Gemini for analysis');
          } catch (geminiError: any) {
            console.warn('Gemini analysis failed:', geminiError.message);
          }
        }

        // If Gemini didn't work, try Local LLM
        if (!geminiSuccess) {
          if (localLLMService.isInitialized()) {
            try {
              console.log('Trying Local LLM fallback...');
              analysis = await localLLMService.analyzeMarket(marketData, riskConfig);
              aiProvider = 'Local LLM';
              console.log('✓ Using Local LLM for analysis');
            } catch (localError: any) {
              console.error('All AI providers failed (Claude, Gemini, Local LLM)');
              throw new Error('All AI providers failed');
            }
          } else {
            console.error('All available AI providers failed. No fallbacks configured.');
            throw new Error('All AI providers failed');
          }
        }
      }

      // Ensure analysis was successful
      if (!analysis) {
        console.error('Failed to get analysis from any AI provider');
        return;
      }

      // Log the analysis
      const analysisLogId = queries.addAnalysisLog.run(
        market.market_id,
        JSON.stringify(marketData),
        `${aiProvider} analysis - see service for prompt template`,
        JSON.stringify(analysis),
        analysis.decision,
        analysis.confidence,
        null // trade_id will be set if a trade is executed
      );

      io.emit('analysis:complete', {
        market_id: market.market_id,
        question: market.question,
        analysis,
      });

      console.log(`Analysis for "${market.question}":`, {
        decision: analysis.decision,
        confidence: `${(analysis.confidence * 100).toFixed(1)}%`,
        size: `$${analysis.suggested_size}`,
      });

      // Update last analysis timestamp
      queries.upsertLastAnalysis.run(market.market_id);

      // If decision is HOLD, skip trading
      if (analysis.decision === 'HOLD') {
        console.log(`Decision: HOLD - no trade executed`);
        return;
      }

      // Handle SELL (exit position)
      if (analysis.decision === 'SELL') {
        await this.executeSell(market, marketData, analysis);
        return;
      }

      // Validate trade with risk management (only for BUY)
      const validation = await riskService.validateTrade({
        market_id: market.market_id,
        size: analysis.suggested_size,
        confidence: analysis.confidence,
      });

      if (!validation.approved) {
        console.log(`Trade rejected: ${validation.reason}`);
        return;
      }

      const tradeSize = validation.adjustedSize || analysis.suggested_size;

      if (validation.reason) {
        console.log(`Trade adjusted: ${validation.reason}`);
      }

      // Execute the trade
      await this.executeTrade(market, analysis, tradeSize);
    } catch (error) {
      console.error(`Error in analyzeAndTrade for ${market.question}:`, error);
      throw error;
    }
  }

  /**
   * Fetch complete market data
   */
  private async fetchMarketData(market: any): Promise<MarketData | null> {
    try {
      // Get market details from Gamma API
      const gammaData = await polymarketService.getMarketData(market.market_id);

      // Get current prices from CLOB
      const prices = await polymarketService.getMarketPrices(market.condition_id);

      if (!prices) {
        return null;
      }

      const endDate = new Date(market.end_date);
      const now = new Date();
      const hoursRemaining = (endDate.getTime() - now.getTime()) / 1000 / 60 / 60;

      // Check for existing position
      const existingPosition: any = queries.getOpenPositionForMarket.get(market.market_id);
      let currentPosition = undefined;

      if (existingPosition) {
        const currentPrice = existingPosition.outcome === 'YES' ? prices.yes_price : prices.no_price;
        const shares = existingPosition.price > 0 ? existingPosition.size / existingPosition.price : 0;
        const currentValue = shares * currentPrice;
        const unrealizedPnl = currentValue - existingPosition.size;

        currentPosition = {
          outcome: existingPosition.outcome,
          size: existingPosition.size,
          entry_price: existingPosition.price,
          current_value: currentValue,
          unrealized_pnl: unrealizedPnl,
        };
      }

      return {
        question: market.question,
        market_id: market.market_id,
        condition_id: market.condition_id,
        yes_price: prices.yes_price,
        no_price: prices.no_price,
        volume_24h: parseFloat(gammaData.volume24hr || 0),
        liquidity: parseFloat(gammaData.liquidity || 0),
        end_date: market.end_date,
        time_remaining_hours: hoursRemaining,
        current_position: currentPosition,
      };
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      return null;
    }
  }

  /**
   * Fetch and store price history for a market
   */
  async updatePriceHistory(market: any): Promise<void> {
    try {
      // Get or fetch CLOB token IDs
      let tokenIds = market.clob_token_ids;
      if (!tokenIds) {
        const gammaData = await polymarketService.getMarketData(market.market_id);
        if (gammaData?.clobTokenIds) {
          tokenIds = JSON.stringify(gammaData.clobTokenIds);
          queries.updateMarketTokenIds.run(tokenIds, market.market_id);
        }
      }

      if (!tokenIds) {
        console.log(`No CLOB token IDs for market ${market.market_id}`);
        return;
      }

      const parsedTokenIds = typeof tokenIds === 'string' ? JSON.parse(tokenIds) : tokenIds;
      const yesTokenId = parsedTokenIds[0]; // First token is YES

      // Fetch last 24h of price history with 15-minute resolution
      const history = await polymarketService.getPriceHistory(yesTokenId, '1d', 15);

      if (history.length === 0) {
        return;
      }

      // Store each price point
      for (const point of history) {
        const yesPrice = point.p;
        const noPrice = 1 - yesPrice;
        queries.addPriceHistory.run(market.market_id, point.t, yesPrice, noPrice);
      }

      console.log(`Updated ${history.length} price points for ${market.question?.slice(0, 40)}...`);

      // Emit update to connected clients
      io.emit('priceHistory:updated', {
        market_id: market.market_id,
        count: history.length,
      });
    } catch (error) {
      console.error(`Failed to update price history for ${market.market_id}:`, error);
    }
  }

  /**
   * Execute a trade
   */
  private async executeTrade(market: any, analysis: ClaudeAnalysis, size: number): Promise<void> {
    try {
      const isPaperMode = riskService.isPaperTradingMode();

      // Parse decision to get side and outcome
      const [action, outcome] = this.parseDecision(analysis.decision);

      console.log(`${isPaperMode ? '[PAPER TRADE]' : '[LIVE TRADE]'} ${action} ${outcome} - $${size}`);

      let orderId = null;

      if (!isPaperMode) {
        // Execute real trade via Polymarket
        const prices = await polymarketService.getMarketPrices(market.condition_id);
        if (!prices) {
          throw new Error('Failed to get current prices');
        }

        // Use mid price for limit order
        const price = outcome === 'YES' ? prices.yes_price : prices.no_price;

        const order = await polymarketService.placeOrder(
          market.condition_id,
          outcome,
          action,
          size,
          price
        );

        orderId = order.orderID;
      } else {
        // Paper trade - generate fake order ID
        orderId = `PAPER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Record trade in database
      const tradeStatus = isPaperMode ? 'EXECUTED' : 'PENDING';
      const executedAt = isPaperMode ? new Date().toISOString() : null;

      // For paper trades, use the mock price as the fill price
      let fillPrice = 0;
      if (isPaperMode) {
        const prices = await polymarketService.getMarketPrices(market.condition_id);
        if (prices) {
          fillPrice = outcome === 'YES' ? prices.yes_price : prices.no_price;
        }
      }

      queries.addTrade.run(
        market.market_id,
        orderId,
        action,
        outcome,
        size,
        fillPrice,
        tradeStatus,
        analysis.reasoning,
        isPaperMode ? 1 : 0,
        executedAt
      );

      // Update budget
      await riskService.updateBudget(size);

      // Emit trade event
      io.emit('trade:executed', {
        market_id: market.market_id,
        question: market.question,
        order_id: orderId,
        side: action,
        outcome,
        size,
        is_paper_trade: isPaperMode,
        reasoning: analysis.reasoning,
      });

      console.log(`Trade executed successfully - Order ID: ${orderId}`);
    } catch (error: any) {
      console.error('Failed to execute trade:', error);

      // Record failed trade
      queries.addTrade.run(
        market.market_id,
        null,
        'BUY', // Placeholder
        'YES', // Placeholder
        size,
        0,
        'FAILED',
        `Error: ${error?.message || 'Unknown error'}`,
        riskService.isPaperTradingMode() ? 1 : 0,
        null
      );

      throw error;
    }
  }

  /**
   * Execute a sell (exit position early)
   */
  private async executeSell(market: any, marketData: MarketData, analysis: ClaudeAnalysis): Promise<void> {
    try {
      const position = marketData.current_position;
      if (!position) {
        console.log('No position to sell');
        return;
      }

      const isPaperMode = riskService.isPaperTradingMode();
      console.log(`${isPaperMode ? '[PAPER TRADE]' : '[LIVE TRADE]'} SELL ${position.outcome} - closing position`);

      let orderId = null;
      let sellPrice = position.outcome === 'YES' ? marketData.yes_price : marketData.no_price;

      if (!isPaperMode) {
        // Execute real sell via Polymarket
        const order = await polymarketService.placeOrder(
          market.condition_id,
          position.outcome,
          'SELL',
          position.size,
          sellPrice
        );
        orderId = order.orderID;
      } else {
        orderId = `PAPER_SELL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Calculate realized P&L
      const shares = position.entry_price > 0 ? position.size / position.entry_price : 0;
      const saleProceeds = shares * sellPrice;
      const realizedPnl = saleProceeds - position.size;

      // Update the original trade to RESOLVED status with the P&L
      const existingTrade: any = queries.getOpenPositionForMarket.get(market.market_id);
      if (existingTrade) {
        queries.resolveTrade.run('RESOLVED', `SOLD_${position.outcome}`, realizedPnl, existingTrade.id);
      }

      // Update budget with P&L
      await riskService.updateBudget(0, realizedPnl);

      io.emit('trade:sold', {
        market_id: market.market_id,
        question: market.question,
        order_id: orderId,
        outcome: position.outcome,
        sell_price: sellPrice,
        realized_pnl: realizedPnl,
        is_paper_trade: isPaperMode,
        reasoning: analysis.reasoning,
      });

      console.log(`Position sold - P&L: $${realizedPnl.toFixed(2)}`);
    } catch (error: any) {
      console.error('Failed to execute sell:', error);
      throw error;
    }
  }

  /**
   * Parse Claude's decision into side and outcome
   */
  private parseDecision(decision: string): [TradeSide, TradeOutcome] {
    const parts = decision.split('_');
    const side = parts[0] as TradeSide;
    const outcome = parts[1] as TradeOutcome;
    return [side, outcome];
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get trading service status
   */
  getStatus() {
    const appConfig: any = queries.getAppConfig.get();
    const markets: any = queries.getActiveNonExpiredMarkets.all();
    const positions: any = queries.getTrueOpenPositions.all();

    return {
      is_running: this.isRunning,
      trading_enabled: appConfig?.trading_enabled || false,
      paper_trading_mode: appConfig?.paper_trading_mode || true,
      active_markets: markets.length,
      open_positions: positions.length,
      polymarket_connected: polymarketService.isInitialized(),
      claude_connected: claudeService.isInitialized(),
    };
  }
}

// Export singleton instance
export const tradingService = new TradingService();
