import { Router } from 'express';
import { queries } from '../config/database';
import axios from 'axios';
import { tradingService } from '../services/trading.service';

const router = Router();

// Get available tags/categories
router.get('/tags', async (req, res, next) => {
  try {
    const response = await axios.get('https://gamma-api.polymarket.com/tags', {
      params: {
        limit: 100,
      },
    });

    const tags = response.data.map((tag: any) => ({
      id: tag.id,
      label: tag.label,
      slug: tag.slug,
    }));

    res.json({ success: true, data: tags });
  } catch (error) {
    next(error);
  }
});

// Get markets by tag/category
router.get('/category/:tagId', async (req, res, next) => {
  try {
    const { tagId } = req.params;
    const { limit = 20, closesWithin } = req.query;

    let maxCloseDate: Date | null = null;
    if (closesWithin && typeof closesWithin === 'string') {
      maxCloseDate = new Date();
      const match = closesWithin.match(/^(\d+)(h|d)$/);
      if (match) {
        const value = parseInt(match[1]);
        if (match[2] === 'h') maxCloseDate.setHours(maxCloseDate.getHours() + value);
        else if (match[2] === 'd') maxCloseDate.setDate(maxCloseDate.getDate() + value);
      } else {
        maxCloseDate = null;
      }
    }

    const response = await axios.get('https://gamma-api.polymarket.com/events', {
      params: {
        tag_id: tagId,
        active: true,
        closed: false,
        limit: 50,
      },
    });

    let markets: any[] = [];

    // Extract markets from events
    for (const event of response.data) {
      if (event.markets && Array.isArray(event.markets)) {
        for (const market of event.markets) {
          if (!market.closed && market.active) {
            markets.push({
              market_id: market.id,
              condition_id: market.conditionId || market.condition_id,
              question: market.question,
              slug: market.slug,
              end_date: market.endDate || market.end_date_iso || null,
              active: market.active,
              closed: market.closed,
              volume: market.volume,
              liquidity: market.liquidity,
              outcomes: market.outcomes,
              outcomePrices: market.outcomePrices,
              event_title: event.title,
            });
          }
        }
      }
    }

    // Filter by close date if requested
    if (maxCloseDate) {
      markets = markets.filter((m: any) => {
        if (!m.end_date) return false;
        return new Date(m.end_date) <= maxCloseDate!;
      });
    }

    // Limit results
    markets = markets.slice(0, Number(limit) || 20);

    res.json({ success: true, data: markets });
  } catch (error) {
    next(error);
  }
});

// Get current recurring market (e.g. BTC 15m)
router.get('/recurring/:series', async (req, res, next) => {
  try {
    const { series } = req.params;

    // Define known recurring series patterns
    const seriesConfig: Record<string, { slugPrefix: string; intervalSeconds: number }> = {
      'btc-15m': { slugPrefix: 'btc-updown-15m', intervalSeconds: 900 },
    };

    const config = seriesConfig[series];
    if (!config) {
      return res.status(400).json({ success: false, error: 'Unknown series' });
    }

    const now = Math.floor(Date.now() / 1000);
    const currentAligned = now - (now % config.intervalSeconds);
    const nextAligned = currentAligned + config.intervalSeconds;

    // Try current and next slots
    const slugsToTry = [
      `${config.slugPrefix}-${nextAligned}`,
      `${config.slugPrefix}-${currentAligned}`,
    ];

    for (const slug of slugsToTry) {
      try {
        const response = await axios.get('https://gamma-api.polymarket.com/events', {
          params: { slug },
        });

        if (response.data && response.data.length > 0) {
          const event = response.data[0];
          const marketsData = (event.markets || [])
            .filter((m: any) => !m.closed && m.active)
            .map((market: any) => ({
              market_id: market.id,
              condition_id: market.conditionId || market.condition_id,
              question: market.question,
              slug: market.slug,
              end_date: market.endDate || market.endDateIso || null,
              active: market.active,
              closed: market.closed,
              volume: market.volume || market.volumeNum,
              liquidity: market.liquidity || market.liquidityNum,
              outcomes: market.outcomes,
              outcomePrices: market.outcomePrices,
              event_title: event.title,
            }));

          if (marketsData.length > 0) {
            return res.json({ success: true, data: marketsData });
          }
        }
      } catch {
        // Try next slug
      }
    }

    res.json({ success: false, error: 'No active recurring market found' });
  } catch (error) {
    next(error);
  }
});

// Get all monitored markets
router.get('/', (req, res, next) => {
  try {
    const markets = queries.getMonitoredMarkets.all();
    res.json({ success: true, data: markets });
  } catch (error) {
    next(error);
  }
});

// Search Polymarket markets using events API for better results
router.get('/search', async (req, res, next) => {
  try {
    const { query, limit = 20, closesWithin } = req.query;

    let maxCloseDate: Date | null = null;
    if (closesWithin && typeof closesWithin === 'string') {
      maxCloseDate = new Date();
      const match = closesWithin.match(/^(\d+)(h|d)$/);
      if (match) {
        const value = parseInt(match[1]);
        if (match[2] === 'h') maxCloseDate.setHours(maxCloseDate.getHours() + value);
        else if (match[2] === 'd') maxCloseDate.setDate(maxCloseDate.getDate() + value);
      } else {
        maxCloseDate = null;
      }
    }

    let markets: any[] = [];

    if (query && typeof query === 'string') {
      // Use Polymarket's public search endpoint for proper full-text search
      const searchResponse = await axios.get('https://gamma-api.polymarket.com/public-search', {
        params: {
          q: query,
          limit_per_type: 50,
          events_status: 'active',
        },
      });

      const events = searchResponse.data?.events || [];
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          for (const market of event.markets) {
            if (!market.closed && market.active) {
              markets.push({
                market_id: market.id,
                condition_id: market.conditionId || market.condition_id,
                question: market.question,
                slug: market.slug,
                end_date: market.endDate || market.endDateIso || null,
                active: market.active,
                closed: market.closed,
                volume: market.volume || market.volumeNum,
                liquidity: market.liquidity || market.liquidityNum,
                outcomes: market.outcomes,
                outcomePrices: market.outcomePrices,
                event_title: event.title,
                tags: event.tags || [],
              });
            }
          }
        }
      }
    } else {
      // No query - return popular/trending markets
      const response = await axios.get('https://gamma-api.polymarket.com/markets', {
        params: {
          limit: Number(limit) || 20,
          closed: false,
          active: true,
        },
      });

      markets = response.data.map((market: any) => ({
        market_id: market.id,
        condition_id: market.conditionId || market.condition_id,
        question: market.question,
        slug: market.slug,
        end_date: market.endDate || market.end_date_iso || null,
        active: market.active,
        closed: market.closed,
        volume: market.volume,
        liquidity: market.liquidity,
        outcomes: market.outcomes,
        outcomePrices: market.outcomePrices,
      }));
    }

    // Filter by close date if requested
    if (maxCloseDate) {
      markets = markets.filter((m: any) => {
        if (!m.end_date) return false;
        return new Date(m.end_date) <= maxCloseDate!;
      });
    }

    // Limit results
    markets = markets.slice(0, Number(limit) || 20);

    res.json({ success: true, data: markets });
  } catch (error) {
    next(error);
  }
});

// Add market to monitoring
router.post('/', async (req, res, next) => {
  try {
    const { market_id, condition_id, question, slug, end_date } = req.body;

    // Check if already exists
    const existing: any = queries.getMarketById.get(market_id);
    if (existing) {
      if (!existing.is_active) {
        // Reactivate inactive market and update its details
        queries.updateMarketStatus.run(1, market_id);
        return res.json({ success: true, message: 'Market reactivated for monitoring' });
      }
      return res.status(400).json({
        success: false,
        error: 'Market already being monitored',
      });
    }

    // Fetch CLOB token IDs from Gamma API
    let clobTokenIds = null;
    try {
      const gammaResponse = await axios.get(`https://gamma-api.polymarket.com/markets/${market_id}`);
      if (gammaResponse.data?.clobTokenIds) {
        clobTokenIds = JSON.stringify(gammaResponse.data.clobTokenIds);
      }
    } catch (e) {
      console.warn('Could not fetch CLOB token IDs:', e);
    }

    queries.addMonitoredMarket.run(market_id, condition_id, clobTokenIds, question, slug, end_date);

    res.json({ success: true, message: 'Market added to monitoring' });
  } catch (error) {
    next(error);
  }
});

// Toggle market active status
router.patch('/:marketId/status', (req, res, next) => {
  try {
    const { marketId } = req.params;
    const { is_active } = req.body;

    queries.updateMarketStatus.run(is_active ? 1 : 0, marketId);

    res.json({ success: true, message: 'Market status updated' });
  } catch (error) {
    next(error);
  }
});

// Get market details from Polymarket
router.get('/:marketId/details', async (req, res, next) => {
  try {
    const { marketId } = req.params;

    const response = await axios.get(`https://gamma-api.polymarket.com/markets/${marketId}`);

    res.json({ success: true, data: response.data });
  } catch (error) {
    next(error);
  }
});

// Get price history for a market
router.get('/:marketId/price-history', (req, res, next) => {
  try {
    const { marketId } = req.params;
    const { limit } = req.query;

    let history;
    if (limit) {
      history = queries.getRecentPriceHistory.all(marketId, Number(limit));
      // Reverse to get chronological order
      history = history.reverse();
    } else {
      history = queries.getPriceHistory.all(marketId);
    }

    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// Manually refresh price history for a market
router.post('/:marketId/refresh-history', async (req, res, next) => {
  try {
    const { marketId } = req.params;
    const market: any = queries.getMarketById.get(marketId);

    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    await tradingService.updatePriceHistory(market);

    const history = queries.getPriceHistory.all(marketId);
    res.json({ success: true, data: history, count: history.length });
  } catch (error) {
    next(error);
  }
});

export default router;
