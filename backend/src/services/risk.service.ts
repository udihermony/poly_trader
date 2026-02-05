import { queries } from '../config/database';
import { ClaudeAnalysis } from '../types';

interface TradeProposal {
  market_id: string;
  size: number;
  confidence: number;
}

interface ValidationResult {
  approved: boolean;
  reason?: string;
  adjustedSize?: number;
}

class RiskService {
  /**
   * Validate a trade proposal against all risk limits
   */
  async validateTrade(proposal: TradeProposal): Promise<ValidationResult> {
    try {
      const riskConfig: any = queries.getRiskConfig.get();
      if (!riskConfig) {
        return { approved: false, reason: 'Risk configuration not found' };
      }

      // 1. Check confidence threshold
      if (proposal.confidence < riskConfig.min_confidence_threshold) {
        return {
          approved: false,
          reason: `Confidence ${(proposal.confidence * 100).toFixed(1)}% below minimum threshold ${(riskConfig.min_confidence_threshold * 100).toFixed(0)}%`,
        };
      }

      // 2. Check bet size limit
      if (proposal.size > riskConfig.max_bet_size) {
        // Auto-adjust to max bet size
        return {
          approved: true,
          adjustedSize: riskConfig.max_bet_size,
          reason: `Bet size adjusted from $${proposal.size} to maximum $${riskConfig.max_bet_size}`,
        };
      }

      if (proposal.size <= 0) {
        return {
          approved: false,
          reason: 'Bet size must be greater than 0',
        };
      }

      // 3. Check daily budget
      let budget: any = queries.getTodayBudget.get();
      if (!budget) {
        queries.createTodayBudget.run();
        budget = queries.getTodayBudget.get();
      }

      const remainingBudget = riskConfig.daily_budget - budget.spent;
      if (remainingBudget <= 0) {
        return {
          approved: false,
          reason: `Daily budget exhausted ($${budget.spent}/$${riskConfig.daily_budget})`,
        };
      }

      if (proposal.size > remainingBudget) {
        // Auto-adjust to remaining budget
        return {
          approved: true,
          adjustedSize: remainingBudget,
          reason: `Bet size adjusted from $${proposal.size} to remaining budget $${remainingBudget.toFixed(2)}`,
        };
      }

      // 4. Check open positions limit
      const openPositions: any = queries.getOpenPositions.all();
      if (openPositions.length >= riskConfig.max_open_positions) {
        return {
          approved: false,
          reason: `Maximum open positions reached (${openPositions.length}/${riskConfig.max_open_positions})`,
        };
      }

      // 5. Check per-market exposure
      const marketExposure = this.calculateMarketExposure(proposal.market_id);
      if (marketExposure + proposal.size > riskConfig.max_market_exposure) {
        const allowedSize = Math.max(0, riskConfig.max_market_exposure - marketExposure);
        if (allowedSize <= 0) {
          return {
            approved: false,
            reason: `Market exposure limit reached ($${marketExposure.toFixed(2)}/$${riskConfig.max_market_exposure})`,
          };
        }

        return {
          approved: true,
          adjustedSize: allowedSize,
          reason: `Bet size adjusted from $${proposal.size} to maintain market exposure limit $${allowedSize.toFixed(2)}`,
        };
      }

      // All checks passed
      return {
        approved: true,
        adjustedSize: proposal.size,
      };
    } catch (error: any) {
      console.error('Risk validation error:', error);
      return {
        approved: false,
        reason: 'Risk validation failed: ' + (error?.message || 'Unknown error'),
      };
    }
  }

  /**
   * Calculate current exposure for a specific market
   */
  private calculateMarketExposure(marketId: string): number {
    try {
      const trades: any = queries.getTradesByMarket.all(marketId);

      // Sum up all executed trades for this market
      const exposure = trades
        .filter((t: any) => t.status === 'EXECUTED')
        .reduce((sum: number, t: any) => sum + t.size, 0);

      return exposure;
    } catch (error) {
      console.error('Failed to calculate market exposure:', error);
      return 0;
    }
  }

  /**
   * Check if analysis is needed (cooldown check)
   */
  async shouldAnalyzeMarket(marketId: string): Promise<boolean> {
    try {
      const appConfig: any = queries.getAppConfig.get();
      const cooldownMinutes = appConfig?.analysis_interval_minutes || 5;

      const lastAnalysis: any = queries.getLastAnalysis.get(marketId);

      if (!lastAnalysis) {
        return true; // Never analyzed before
      }

      const lastAnalyzedAt = new Date(lastAnalysis.last_analyzed_at).getTime();
      const now = Date.now();
      const minutesSinceLastAnalysis = (now - lastAnalyzedAt) / 1000 / 60;

      return minutesSinceLastAnalysis >= cooldownMinutes;
    } catch (error: any) {
      console.error('Failed to check analysis cooldown:', error);
      return true; // Default to allowing analysis on error
    }
  }

  /**
   * Update budget tracking after a trade
   */
  async updateBudget(size: number, profitLoss: number = 0): Promise<void> {
    try {
      let budget: any = queries.getTodayBudget.get();
      if (!budget) {
        queries.createTodayBudget.run();
      }

      queries.updateBudget.run(size, profitLoss);
    } catch (error) {
      console.error('Failed to update budget:', error);
    }
  }

  /**
   * Get current budget status
   */
  async getBudgetStatus(): Promise<any> {
    try {
      const riskConfig: any = queries.getRiskConfig.get();
      let budget: any = queries.getTodayBudget.get();

      if (!budget) {
        queries.createTodayBudget.run();
        budget = queries.getTodayBudget.get();
      }

      return {
        daily_budget: riskConfig.daily_budget,
        spent: budget.spent,
        remaining: riskConfig.daily_budget - budget.spent,
        profit_loss: budget.profit_loss,
        trades_count: budget.trades_count,
        utilization_pct: (budget.spent / riskConfig.daily_budget) * 100,
      };
    } catch (error) {
      console.error('Failed to get budget status:', error);
      return null;
    }
  }

  /**
   * Check if trading is currently enabled
   */
  isTradingEnabled(): boolean {
    try {
      const appConfig: any = queries.getAppConfig.get();
      return appConfig?.trading_enabled || false;
    } catch (error) {
      console.error('Failed to check trading status:', error);
      return false;
    }
  }

  /**
   * Check if in paper trading mode
   */
  isPaperTradingMode(): boolean {
    try {
      const appConfig: any = queries.getAppConfig.get();
      return appConfig?.paper_trading_mode || true; // Default to paper trading
    } catch (error) {
      console.error('Failed to check paper trading mode:', error);
      return true; // Default to paper trading on error
    }
  }
}

// Export singleton instance
export const riskService = new RiskService();
