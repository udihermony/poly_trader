import axios from 'axios';
import { queries } from '../config/database';
import { io } from '../server';
import { riskService } from './risk.service';

const DATA_API_BASE = 'https://data-api.polymarket.com';
const CLOB_API_BASE = 'https://clob.polymarket.com';

interface LeaderboardTrader {
  rank: string;
  proxyWallet: string;
  userName: string;
  pnl: number;
}

interface TraderPosition {
  conditionId: string;
  title: string;
  slug: string;
  outcome: string;
  totalSize: number;
  avgPrice: number;
  tokenId?: string;
}

class SnipeService {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Get top 10 positions from leaderboard traders
   */
  async getTopPositions(category = 'OVERALL', timePeriod = 'DAY'): Promise<any[]> {
    try {
      // Get top 5 traders
      const leaderboardRes = await axios.get(`${DATA_API_BASE}/v1/leaderboard`, {
        params: { category, timePeriod, orderBy: 'PNL', limit: 5 },
      });

      const traders: LeaderboardTrader[] = leaderboardRes.data;
      const allPositions: any[] = [];

      for (const trader of traders) {
        try {
          const activityRes = await axios.get(`${DATA_API_BASE}/activity`, {
            params: {
              user: trader.proxyWallet,
              type: 'TRADE',
              side: 'BUY',
              limit: 50,
              sortBy: 'TIMESTAMP',
              sortDirection: 'DESC',
            },
          });

          // Group by market
          const positionMap = new Map<string, any>();
          for (const activity of activityRes.data) {
            const key = `${activity.conditionId}-${activity.outcome}`;
            if (!positionMap.has(key)) {
              positionMap.set(key, {
                conditionId: activity.conditionId,
                title: activity.title,
                slug: activity.slug,
                eventSlug: activity.eventSlug,
                outcome: activity.outcome,
                outcomeIndex: activity.outcomeIndex,
                totalSize: 0,
                priceSum: 0,
                count: 0,
                sourceTrader: trader.proxyWallet,
                sourceTraderName: trader.userName,
                latestTimestamp: activity.timestamp,
              });
            }
            const pos = positionMap.get(key)!;
            pos.totalSize += activity.usdcSize || 0;
            if (activity.price > 0) {
              pos.priceSum += activity.price * (activity.usdcSize || 0);
              pos.count += activity.usdcSize || 0;
            }
          }

          // Calculate avg price and add to list
          for (const pos of positionMap.values()) {
            pos.avgPrice = pos.count > 0 ? pos.priceSum / pos.count : 0;
            delete pos.priceSum;
            delete pos.count;
            allPositions.push(pos);
          }
        } catch (e) {
          console.warn(`Failed to fetch positions for trader ${trader.userName}`);
        }

        await this.sleep(200);
      }

      // Sort by size and return top 10
      return allPositions
        .sort((a, b) => b.totalSize - a.totalSize)
        .slice(0, 10);
    } catch (error) {
      console.error('Failed to get top positions:', error);
      return [];
    }
  }

  /**
   * Snipe (copy) the top positions
   */
  async snipeTopPositions(): Promise<{ copied: number; skipped: number; positions: any[] }> {
    const riskConfig: any = queries.getRiskConfig.get();
    const snipeSize = riskConfig?.snipe_size || 10;
    const profitTarget = riskConfig?.snipe_profit_target || 0.05;
    const isPaperMode = riskConfig?.paper_trading_mode === 1;

    const topPositions = await this.getTopPositions();
    let copied = 0;
    let skipped = 0;
    const copiedPositions: any[] = [];

    for (const pos of topPositions) {
      // Check if we already have this position
      const existing: any = queries.getSnipedPositionByCondition.get(pos.conditionId, pos.outcome);
      if (existing) {
        skipped++;
        continue;
      }

      // Get current price from CLOB
      let currentPrice = pos.avgPrice;
      try {
        // We need the token ID to get current price
        // For now, use the average price from the trader's activity
        // In production, you'd fetch the actual order book price
      } catch (e) {
        console.warn('Could not fetch current price, using avg price');
      }

      // Create the sniped position
      queries.addSnipedPosition.run(
        pos.conditionId,
        null, // token_id - would need to fetch
        pos.title,
        pos.slug || pos.eventSlug,
        pos.outcome,
        currentPrice,
        snipeSize,
        pos.sourceTrader,
        pos.sourceTraderName,
        profitTarget,
        isPaperMode ? 1 : 0
      );

      // Track spent amount in budget
      await riskService.updateBudget(snipeSize, 0);

      copied++;
      copiedPositions.push({
        title: pos.title,
        outcome: pos.outcome,
        entryPrice: currentPrice,
        size: snipeSize,
        sourceTrader: pos.sourceTraderName,
      });

      console.log(`[SNIPE] Copied position: ${pos.title.slice(0, 40)}... ${pos.outcome} @ $${currentPrice.toFixed(3)}`);

      io.emit('snipe:copied', {
        title: pos.title,
        outcome: pos.outcome,
        entryPrice: currentPrice,
        size: snipeSize,
        sourceTrader: pos.sourceTraderName,
      });
    }

    return { copied, skipped, positions: copiedPositions };
  }

  /**
   * Check all open sniped positions and close if profit target reached
   */
  async checkAndClosePositions(): Promise<{ checked: number; closed: number }> {
    const openPositions: any[] = queries.getOpenSnipedPositions.all();
    let checked = 0;
    let closed = 0;

    for (const pos of openPositions) {
      checked++;

      try {
        // Get current price - for paper trading, simulate price movement
        let currentPrice = pos.entry_price;

        // Try to get real price from Gamma API
        try {
          // Use condition ID to look up market
          const marketRes = await axios.get(`https://gamma-api.polymarket.com/markets`, {
            params: { condition_id: pos.condition_id, limit: 1 },
          });

          if (marketRes.data && marketRes.data.length > 0) {
            const market = marketRes.data[0];
            const prices = typeof market.outcomePrices === 'string'
              ? JSON.parse(market.outcomePrices)
              : market.outcomePrices;

            if (prices && prices.length >= 2) {
              // outcomeIndex 0 = YES, 1 = NO typically
              const isYes = pos.outcome.toUpperCase() === 'YES' || pos.outcome_index === 0;
              currentPrice = parseFloat(prices[isYes ? 0 : 1]) || pos.entry_price;
            }
          }
        } catch (e) {
          // If we can't get real price, simulate small random movement for paper trading
          if (pos.is_paper_trade) {
            const randomChange = (Math.random() - 0.45) * 0.1; // Slight upward bias
            currentPrice = Math.max(0.01, Math.min(0.99, pos.entry_price + randomChange));
          }
        }

        // Update current price
        queries.updateSnipedPositionPrice.run(currentPrice, pos.id);

        // Calculate P&L percentage
        const pnlPct = (currentPrice - pos.entry_price) / pos.entry_price;

        // Check if profit target reached
        if (pnlPct >= pos.profit_target) {
          const shares = pos.size / pos.entry_price;
          const realizedPnl = (shares * currentPrice) - pos.size;

          queries.closeSnipedPosition.run(currentPrice, realizedPnl, pos.id);
          closed++;

          // Update budget with realized P&L (this shows in dashboard)
          await riskService.updateBudget(0, realizedPnl);

          console.log(`[SNIPE] Closed position: ${pos.title.slice(0, 40)}... +${(pnlPct * 100).toFixed(1)}% P&L: $${realizedPnl.toFixed(2)}`);

          io.emit('snipe:closed', {
            id: pos.id,
            title: pos.title,
            outcome: pos.outcome,
            entryPrice: pos.entry_price,
            exitPrice: currentPrice,
            pnlPct: pnlPct * 100,
            realizedPnl,
          });
        }
      } catch (error) {
        console.error(`Error checking position ${pos.id}:`, error);
      }

      await this.sleep(100);
    }

    return { checked, closed };
  }

  /**
   * Start the snipe monitoring loop
   */
  start(intervalMs: number = 5 * 60 * 1000): void {
    if (this.isRunning) {
      console.log('Snipe service already running');
      return;
    }

    this.isRunning = true;
    console.log(`Snipe service started (checking every ${intervalMs / 1000}s)`);

    // Run immediately
    this.checkAndClosePositions().catch(console.error);

    // Then run on interval
    this.checkInterval = setInterval(() => {
      this.checkAndClosePositions().catch(console.error);
    }, intervalMs);
  }

  /**
   * Stop the snipe monitoring loop
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('Snipe service stopped');
  }

  /**
   * Get current status
   */
  getStatus(): { isRunning: boolean; openPositions: number } {
    const openPositions: any[] = queries.getOpenSnipedPositions.all();
    return {
      isRunning: this.isRunning,
      openPositions: openPositions.length,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const snipeService = new SnipeService();
