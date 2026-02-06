import { Router } from 'express';
import axios from 'axios';
import { queries } from '../config/database';
import { polymarketService } from '../services/polymarket.service';

const router = Router();
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

// Search markets
router.get('/search', async (req, res, next) => {
  try {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const response = await axios.get(`${GAMMA_API_BASE}/markets`, {
      params: {
        closed: false,
        active: true,
        limit: 20,
      },
    });

    // Filter by search query (Gamma API doesn't have text search)
    const markets = (response.data || [])
      .filter((m: any) =>
        m.question?.toLowerCase().includes(query.toLowerCase()) ||
        m.description?.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10)
      .map((m: any) => ({
        id: m.id,
        conditionId: m.conditionId,
        question: m.question,
        slug: m.slug,
        endDate: m.endDate,
        liquidity: m.liquidity,
        volume24hr: m.volume24hr,
        outcomePrices: m.outcomePrices,
        clobTokenIds: m.clobTokenIds,
      }));

    res.json({ success: true, data: markets });
  } catch (error) {
    next(error);
  }
});

// Get trending/popular markets
router.get('/trending', async (req, res, next) => {
  try {
    const response = await axios.get(`${GAMMA_API_BASE}/markets`, {
      params: {
        closed: false,
        active: true,
        limit: 20,
        order: 'volume24hr',
        ascending: false,
      },
    });

    const markets = (response.data || []).slice(0, 10).map((m: any) => ({
      id: m.id,
      conditionId: m.conditionId,
      question: m.question,
      slug: m.slug,
      endDate: m.endDate,
      liquidity: m.liquidity,
      volume24hr: m.volume24hr,
      outcomePrices: m.outcomePrices,
      clobTokenIds: m.clobTokenIds,
    }));

    res.json({ success: true, data: markets });
  } catch (error) {
    next(error);
  }
});

// Get market details with live prices
router.get('/market/:id', async (req, res, next) => {
  try {
    const marketId = req.params.id;

    const response = await axios.get(`${GAMMA_API_BASE}/markets`, {
      params: { id: marketId, limit: 1 },
    });

    if (!response.data || response.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    const market = response.data[0];

    // Parse prices
    let yesPrice = 0.5;
    let noPrice = 0.5;
    if (market.outcomePrices) {
      const prices = typeof market.outcomePrices === 'string'
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices;
      yesPrice = parseFloat(prices[0]) || 0.5;
      noPrice = parseFloat(prices[1]) || 0.5;
    }

    // Parse token IDs
    let tokenIds: string[] = [];
    if (market.clobTokenIds) {
      tokenIds = typeof market.clobTokenIds === 'string'
        ? JSON.parse(market.clobTokenIds)
        : market.clobTokenIds;
    }

    res.json({
      success: true,
      data: {
        id: market.id,
        conditionId: market.conditionId,
        question: market.question,
        description: market.description,
        slug: market.slug,
        endDate: market.endDate,
        liquidity: parseFloat(market.liquidity) || 0,
        volume24hr: parseFloat(market.volume24hr) || 0,
        yesPrice,
        noPrice,
        yesTokenId: tokenIds[0] || null,
        noTokenId: tokenIds[1] || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Place a manual trade
router.post('/execute', async (req, res, next) => {
  try {
    const { marketId, tokenId, outcome, amount } = req.body;

    if (!tokenId || !outcome || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenId, outcome, amount',
      });
    }

    if (amount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Minimum order amount is $1',
      });
    }

    const appConfig: any = queries.getAppConfig.get();
    const isPaperMode = appConfig?.paper_trading_mode === 1;

    // Ensure polymarket service is initialized
    if (!polymarketService.isInitialized()) {
      await polymarketService.initialize();
    }

    let orderId: string;
    let status: string;

    if (isPaperMode) {
      // Paper trade
      orderId = `PAPER_MANUAL_${Date.now()}`;
      status = 'FILLED';
      console.log(`[MANUAL][PAPER] ${outcome} $${amount} on market ${marketId}`);
    } else {
      // Real trade
      const orderResult = await polymarketService.placeMarketOrder(tokenId, 'BUY', amount);
      orderId = orderResult.orderID;
      status = orderResult.status;
      console.log(`[MANUAL][LIVE] ${outcome} $${amount} - Order ID: ${orderId}`);
    }

    res.json({
      success: true,
      data: {
        orderId,
        status,
        outcome,
        amount,
        isPaperTrade: isPaperMode,
      },
    });
  } catch (error: any) {
    console.error('Manual trade failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Trade execution failed',
    });
  }
});

export default router;
