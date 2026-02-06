import axios from 'axios';
import { queries } from '../config/database';
import { io } from '../server';
import { riskService } from './risk.service';
import { polymarketService } from './polymarket.service';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

interface SpreadOpportunity {
  opportunity_type: 'SINGLE' | 'MULTI';
  market_id: string | null;
  event_id: string | null;
  condition_id: string | null;
  question: string;
  slug: string | null;
  outcomes: string[];
  prices: number[];
  total_cost: number;
  guaranteed_payout: number;
  spread_profit: number;
  spread_pct: number;
  liquidity: number | null;
  volume_24h: number | null;
  end_date: string | null;
}

class SpreadService {
  private scanInterval: NodeJS.Timeout | null = null;
  private resolveInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isResolverRunning = false;

  /**
   * Scan single binary markets (YES + NO < $1)
   */
  async scanSingleMarkets(): Promise<SpreadOpportunity[]> {
    const opportunities: SpreadOpportunity[] = [];

    try {
      const res = await axios.get(`${GAMMA_API_BASE}/markets`, {
        params: { limit: 100, active: true, closed: false },
      });

      const markets = res.data || [];

      for (const market of markets) {
        try {
          const prices = typeof market.outcomePrices === 'string'
            ? JSON.parse(market.outcomePrices)
            : market.outcomePrices;

          if (!prices || prices.length < 2) continue;

          const yesPrice = parseFloat(prices[0]);
          const noPrice = parseFloat(prices[1]);

          if (isNaN(yesPrice) || isNaN(noPrice)) continue;
          if (yesPrice <= 0 || noPrice <= 0) continue;

          const totalCost = yesPrice + noPrice;
          const guaranteedPayout = 1.0;
          const spreadProfit = guaranteedPayout - totalCost;

          if (spreadProfit <= 0) continue;

          const spreadPct = spreadProfit / totalCost;

          opportunities.push({
            opportunity_type: 'SINGLE',
            market_id: market.id || null,
            event_id: market.eventId || null,
            condition_id: market.conditionId || null,
            question: market.question || 'Unknown',
            slug: market.slug || null,
            outcomes: ['Yes', 'No'],
            prices: [yesPrice, noPrice],
            total_cost: totalCost,
            guaranteed_payout: guaranteedPayout,
            spread_profit: spreadProfit,
            spread_pct: spreadPct,
            liquidity: parseFloat(market.liquidity) || null,
            volume_24h: parseFloat(market.volume24hr) || null,
            end_date: market.endDate || market.end_date_iso || null,
          });
        } catch (e) {
          // Skip malformed market
        }
      }
    } catch (error) {
      console.error('[SPREAD] Failed to scan single markets:', error);
    }

    return opportunities;
  }

  /**
   * Scan multi-outcome events (sum of all YES prices < $1)
   */
  async scanMultiOutcomeEvents(): Promise<SpreadOpportunity[]> {
    const opportunities: SpreadOpportunity[] = [];

    const config: any = queries.getSpreadConfig.get();
    if (!config?.scan_multi_outcome) return opportunities;

    try {
      const res = await axios.get(`${GAMMA_API_BASE}/events`, {
        params: { limit: 100, active: true, closed: false },
      });

      const events = res.data || [];

      for (const event of events) {
        try {
          const markets = event.markets || [];
          if (markets.length < 2) continue;

          const outcomes: string[] = [];
          const prices: number[] = [];
          let totalCost = 0;
          let minLiquidity: number | null = null;
          let earliestEndDate: string | null = null;

          for (const market of markets) {
            const mPrices = typeof market.outcomePrices === 'string'
              ? JSON.parse(market.outcomePrices)
              : market.outcomePrices;

            if (!mPrices || mPrices.length < 1) continue;

            const yesPrice = parseFloat(mPrices[0]);
            if (isNaN(yesPrice) || yesPrice <= 0) continue;

            outcomes.push(market.groupItemTitle || market.question || 'Unknown');
            prices.push(yesPrice);
            totalCost += yesPrice;

            const liq = parseFloat(market.liquidity);
            if (!isNaN(liq)) {
              minLiquidity = minLiquidity === null ? liq : Math.min(minLiquidity, liq);
            }

            const mEndDate = market.endDate || market.end_date_iso;
            if (mEndDate) {
              if (!earliestEndDate || new Date(mEndDate) < new Date(earliestEndDate)) {
                earliestEndDate = mEndDate;
              }
            }
          }

          if (outcomes.length < 2) continue;

          const guaranteedPayout = 1.0;
          const spreadProfit = guaranteedPayout - totalCost;

          if (spreadProfit <= 0) continue;

          const spreadPct = spreadProfit / totalCost;

          opportunities.push({
            opportunity_type: 'MULTI',
            market_id: null,
            event_id: event.id || null,
            condition_id: null,
            question: event.title || 'Unknown Event',
            slug: event.slug || null,
            outcomes,
            prices,
            total_cost: totalCost,
            guaranteed_payout: guaranteedPayout,
            spread_profit: spreadProfit,
            spread_pct: spreadPct,
            liquidity: minLiquidity,
            volume_24h: null,
            end_date: earliestEndDate,
          });
        } catch (e) {
          // Skip malformed event
        }
      }
    } catch (error) {
      console.error('[SPREAD] Failed to scan multi-outcome events:', error);
    }

    return opportunities;
  }

  /**
   * Run both scanners, persist to DB, deactivate stale entries
   */
  async scanAll(): Promise<{ single: number; multi: number; total: number }> {
    const config: any = queries.getSpreadConfig.get();
    const minThreshold = config?.min_spread_threshold || 0.01;

    const [singleOpps, multiOpps] = await Promise.all([
      this.scanSingleMarkets(),
      this.scanMultiOutcomeEvents(),
    ]);

    const allOpps = [...singleOpps, ...multiOpps].filter(
      (o) => o.spread_pct >= minThreshold
    );

    let persisted = 0;

    for (const opp of allOpps) {
      const identifier = opp.market_id || opp.event_id || '';
      const existing: any = queries.findExistingOpportunity.get(
        opp.opportunity_type,
        identifier,
        identifier
      );

      if (existing) {
        queries.updateOpportunityLastSeen.run(
          JSON.stringify(opp.prices),
          opp.total_cost,
          opp.spread_profit,
          opp.spread_pct,
          existing.id
        );
      } else {
        queries.addSpreadOpportunity.run(
          opp.opportunity_type,
          opp.market_id,
          opp.event_id,
          opp.condition_id,
          opp.question,
          opp.slug,
          JSON.stringify(opp.outcomes),
          JSON.stringify(opp.prices),
          opp.total_cost,
          opp.guaranteed_payout,
          opp.spread_profit,
          opp.spread_pct,
          opp.liquidity,
          opp.volume_24h,
          opp.end_date
        );
        persisted++;
      }
    }

    // Deactivate stale opportunities (not seen in 5 minutes)
    queries.deactivateStaleOpportunities.run();

    const result = {
      single: singleOpps.filter((o) => o.spread_pct >= minThreshold).length,
      multi: multiOpps.filter((o) => o.spread_pct >= minThreshold).length,
      total: allOpps.length,
    };

    io.emit('spread:scan_complete', result);
    console.log(`[SPREAD] Scan complete: ${result.single} single, ${result.multi} multi, ${persisted} new`);

    return result;
  }

  /**
   * Execute a spread trade — buy all outcomes for guaranteed profit
   */
  async executeSpread(
    opportunityId: number,
    totalInvestment: number
  ): Promise<any> {
    const opportunities: any[] = queries.getActiveSpreadOpportunities.all();
    const opp = opportunities.find((o: any) => o.id === opportunityId);
    const appConfig: any = queries.getAppConfig.get();
    const isPaperMode = appConfig?.paper_trading_mode === 1;

    if (!opp) {
      throw new Error('Opportunity not found or no longer active');
    }

    const outcomes: string[] = JSON.parse(opp.outcomes_json);
    const numOutcomes = outcomes.length;
    const sizePerOutcome = totalInvestment / numOutcomes;

    let orderIds: string[] = [];
    let isRealTrade = false;

    if (!isPaperMode) {
      // Attempt to place real orders
      try {
        if (!polymarketService.isInitialized()) {
          await polymarketService.initialize();
        }

        // For SINGLE market spread (YES + NO on same market)
        if (opp.opportunity_type === 'SINGLE' && opp.market_id) {
          // Fetch market to get token IDs
          const marketRes = await axios.get(`${GAMMA_API_BASE}/markets`, {
            params: { id: opp.market_id, limit: 1 },
          });

          if (marketRes.data && marketRes.data.length > 0) {
            const market = marketRes.data[0];
            if (market.clobTokenIds) {
              const tokenIds = typeof market.clobTokenIds === 'string'
                ? JSON.parse(market.clobTokenIds)
                : market.clobTokenIds;

              // Place order for YES (token 0)
              const yesOrder = await polymarketService.placeMarketOrder(
                tokenIds[0],
                'BUY',
                sizePerOutcome
              );
              orderIds.push(yesOrder.orderID);
              console.log(`[SPREAD][LIVE] YES order placed: ${yesOrder.orderID}`);

              await this.sleep(500); // Small delay between orders

              // Place order for NO (token 1)
              const noOrder = await polymarketService.placeMarketOrder(
                tokenIds[1],
                'BUY',
                sizePerOutcome
              );
              orderIds.push(noOrder.orderID);
              console.log(`[SPREAD][LIVE] NO order placed: ${noOrder.orderID}`);

              isRealTrade = true;
            }
          }
        } else if (opp.opportunity_type === 'MULTI' && opp.event_id) {
          // For MULTI-outcome events, we need to buy YES on each market
          const eventRes = await axios.get(`${GAMMA_API_BASE}/events`, {
            params: { id: opp.event_id, limit: 1 },
          });

          if (eventRes.data && eventRes.data.length > 0) {
            const event = eventRes.data[0];
            const markets = event.markets || [];

            for (const market of markets) {
              if (market.clobTokenIds) {
                const tokenIds = typeof market.clobTokenIds === 'string'
                  ? JSON.parse(market.clobTokenIds)
                  : market.clobTokenIds;

                // Buy YES on each market (token 0)
                const order = await polymarketService.placeMarketOrder(
                  tokenIds[0],
                  'BUY',
                  sizePerOutcome
                );
                orderIds.push(order.orderID);
                console.log(`[SPREAD][LIVE] Multi-outcome YES order placed: ${order.orderID}`);

                await this.sleep(500);
              }
            }

            if (orderIds.length === markets.length) {
              isRealTrade = true;
            }
          }
        }
      } catch (orderError: any) {
        console.error(`[SPREAD] Failed to place real orders:`, orderError.message);
        // Fall back to paper trade
        orderIds = outcomes.map(
          (_: string, i: number) => `PAPER_SPREAD_${Date.now()}_${i}`
        );
      }
    }

    // If still paper mode or real orders failed, generate simulated order IDs
    if (isPaperMode || !isRealTrade) {
      orderIds = outcomes.map(
        (_: string, i: number) => `PAPER_SPREAD_${Date.now()}_${i}`
      );
    }

    const expectedProfit = (opp.spread_pct * totalInvestment) / (1 + opp.spread_pct);

    queries.addSpreadTrade.run(
      opp.id,
      opp.opportunity_type,
      opp.market_id,
      opp.event_id,
      opp.condition_id,
      opp.question,
      opp.slug,
      opp.outcomes_json,
      opp.end_date || null,
      opp.total_cost,
      opp.guaranteed_payout,
      expectedProfit,
      sizePerOutcome,
      numOutcomes,
      totalInvestment,
      JSON.stringify(orderIds),
      isRealTrade ? 0 : 1 // is_paper_trade
    );

    // Track spending in budget
    await riskService.updateBudget(totalInvestment, 0);

    const trade = {
      opportunityId: opp.id,
      question: opp.question,
      type: opp.opportunity_type,
      outcomes,
      totalInvestment,
      expectedProfit,
      spreadPct: opp.spread_pct,
      orderIds,
      isPaperTrade: !isRealTrade,
    };

    const modeLabel = isRealTrade ? '[LIVE]' : '[PAPER]';
    io.emit('spread:trade_executed', trade);
    console.log(
      `[SPREAD]${modeLabel} Executed: ${opp.question.slice(0, 40)}... $${totalInvestment.toFixed(2)} invested, expected +$${expectedProfit.toFixed(2)}`
    );

    // Auto-start resolver so this trade gets checked for resolution
    this.startResolver();

    return trade;
  }

  /**
   * Check open spread trades — only queries the API for trades whose end_date has passed.
   * Trades with a future end_date are skipped (no wasted API calls).
   */
  async checkOpenTrades(forceAll = false): Promise<{ checked: number; closed: number; skipped: number }> {
    const openTrades: any[] = queries.getOpenSpreadTrades.all();
    let checked = 0;
    let closed = 0;
    let skipped = 0;
    const now = Date.now();

    for (const trade of openTrades) {
      // Skip trades whose market hasn't ended yet (unless forced)
      if (!forceAll && trade.end_date) {
        const endTime = new Date(trade.end_date).getTime();
        if (endTime > now) {
          skipped++;
          continue;
        }
      }

      checked++;

      try {
        let isResolved = false;

        if (trade.market_id) {
          const res = await axios.get(`${GAMMA_API_BASE}/markets`, {
            params: { id: trade.market_id, limit: 1 },
          });

          const market = res.data?.[0];
          if (market && (market.closed === true || market.closed === 'true')) {
            isResolved = true;
          }
        } else if (trade.event_id) {
          const res = await axios.get(`${GAMMA_API_BASE}/events`, {
            params: { id: trade.event_id, limit: 1 },
          });

          const event = res.data?.[0];
          if (event && (event.closed === true || event.closed === 'true')) {
            isResolved = true;
          }
        }

        if (isResolved) {
          const realizedPnl = trade.expected_profit;

          queries.closeSpreadTrade.run(realizedPnl, trade.id);
          await riskService.updateBudget(0, realizedPnl);
          closed++;

          console.log(
            `[SPREAD] Closed trade: ${trade.question.slice(0, 40)}... P&L: +$${realizedPnl.toFixed(2)}`
          );

          io.emit('spread:trade_closed', {
            id: trade.id,
            question: trade.question,
            realizedPnl,
          });
        }
      } catch (error) {
        console.error(`[SPREAD] Error checking trade ${trade.id}:`, error);
      }

      await this.sleep(100);
    }

    if (checked > 0 || closed > 0) {
      console.log(`[SPREAD] Resolution check: ${checked} checked, ${closed} closed, ${skipped} skipped (not yet ended)`);
    }

    return { checked, closed, skipped };
  }

  /**
   * Start auto-scanning interval (opportunity scanner)
   */
  start(intervalMs?: number): void {
    if (this.isRunning) {
      console.log('[SPREAD] Scanner already running');
      return;
    }

    const config: any = queries.getSpreadConfig.get();
    const ms = intervalMs || (config?.scan_interval_seconds || 60) * 1000;

    this.isRunning = true;
    console.log(`[SPREAD] Scanner started (interval: ${ms / 1000}s)`);

    // Run immediately
    this.scanAll().catch(console.error);

    this.scanInterval = setInterval(() => {
      this.scanAll().catch(console.error);
    }, ms);

    // Also ensure the resolver is running
    this.startResolver();
  }

  /**
   * Stop auto-scanning (opportunity scanner)
   */
  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isRunning = false;
    console.log('[SPREAD] Scanner stopped');
    // Note: resolver keeps running independently if there are open trades
  }

  /**
   * Start the resolution checker — runs independently of the scanner.
   * Instead of polling every 60s, it schedules checks based on trade end dates.
   * Only hits the API once a trade's market end_date has passed.
   */
  startResolver(): void {
    if (this.isResolverRunning) return;

    const openTrades: any[] = queries.getOpenSpreadTrades.all();
    if (openTrades.length === 0) return;

    this.isResolverRunning = true;
    console.log(`[SPREAD] Resolution checker started (${openTrades.length} open trades)`);

    this.scheduleNextCheck();
  }

  /**
   * Schedule the next resolution check based on when the earliest trade's market ends.
   */
  private scheduleNextCheck(): void {
    if (this.resolveInterval) {
      clearTimeout(this.resolveInterval);
      this.resolveInterval = null;
    }

    const openTrades: any[] = queries.getOpenSpreadTrades.all();
    if (openTrades.length === 0) {
      this.stopResolver();
      console.log('[SPREAD] Resolution checker stopped — no open trades remaining');
      return;
    }

    const now = Date.now();

    // Find the earliest end_date among open trades
    let earliestEndMs: number | null = null;
    let tradesWithNoEndDate = 0;
    let tradesPastEndDate = 0;

    for (const trade of openTrades) {
      if (!trade.end_date) {
        tradesWithNoEndDate++;
        continue;
      }
      const endMs = new Date(trade.end_date).getTime();
      if (endMs <= now) {
        tradesPastEndDate++;
      } else if (earliestEndMs === null || endMs < earliestEndMs) {
        earliestEndMs = endMs;
      }
    }

    // If any trades are already past their end date (or have no end date), check now
    if (tradesPastEndDate > 0 || tradesWithNoEndDate > 0) {
      this.runCheckAndReschedule();
      return;
    }

    // All trades are in the future — schedule check for when the earliest one ends
    // Add a 60s buffer after end_date since resolution may not be instant
    if (earliestEndMs !== null) {
      const delayMs = Math.max((earliestEndMs - now) + 60_000, 10_000);
      const delayMin = (delayMs / 60_000).toFixed(1);
      console.log(`[SPREAD] Next resolution check in ${delayMin} min (earliest market ends at ${new Date(earliestEndMs).toISOString()})`);

      this.resolveInterval = setTimeout(() => {
        this.runCheckAndReschedule();
      }, delayMs);
    }
  }

  /**
   * Run a resolution check, then schedule the next one.
   */
  private async runCheckAndReschedule(): Promise<void> {
    await this.checkOpenTrades().catch((e) => {
      console.error('[SPREAD] Resolution check error:', e);
    });

    // Re-check if there are still open trades, schedule next
    const remaining: any[] = queries.getOpenSpreadTrades.all();
    if (remaining.length === 0) {
      this.stopResolver();
      console.log('[SPREAD] Resolution checker stopped — no open trades remaining');
      return;
    }

    // For trades past their end_date that weren't resolved yet (API might lag),
    // re-check in 5 minutes
    const now = Date.now();
    const hasPendingPastDue = remaining.some((t: any) => {
      if (!t.end_date) return true;
      return new Date(t.end_date).getTime() <= now;
    });

    if (hasPendingPastDue) {
      const RETRY_MS = 5 * 60_000; // retry every 5 min for past-due trades
      console.log(`[SPREAD] Trades past end_date still open — retrying in 5 min`);
      this.resolveInterval = setTimeout(() => {
        this.runCheckAndReschedule();
      }, RETRY_MS);
    } else {
      this.scheduleNextCheck();
    }
  }

  /**
   * Stop the resolution checker
   */
  stopResolver(): void {
    if (this.resolveInterval) {
      clearTimeout(this.resolveInterval);
      this.resolveInterval = null;
    }
    this.isResolverRunning = false;
  }

  /**
   * Get current scanner status
   */
  getStatus(): { isRunning: boolean; isResolverRunning: boolean; opportunityCount: number; openTrades: number } {
    const opportunities: any[] = queries.getActiveSpreadOpportunities.all();
    const openTrades: any[] = queries.getOpenSpreadTrades.all();

    return {
      isRunning: this.isRunning,
      isResolverRunning: this.isResolverRunning,
      opportunityCount: opportunities.length,
      openTrades: openTrades.length,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const spreadService = new SpreadService();
