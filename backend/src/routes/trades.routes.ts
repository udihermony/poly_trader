import { Router } from 'express';
import { queries } from '../config/database';
import { tradingService } from '../services/trading.service';

const router = Router();

// Get all trades
router.get('/', (req, res, next) => {
  try {
    const { market_id, limit = 100 } = req.query;

    let trades;
    if (market_id) {
      trades = queries.getTradesByMarket.all(market_id);
    } else {
      trades = queries.getAllTrades.all();
    }

    // Limit results
    if (limit) {
      trades = trades.slice(0, Number(limit));
    }

    res.json({ success: true, data: trades });
  } catch (error) {
    next(error);
  }
});

// Get open positions
router.get('/positions', (req, res, next) => {
  try {
    const positions = queries.getOpenPositions.all();
    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
});

// Get resolved trades
router.get('/resolved', (req, res, next) => {
  try {
    const resolved = queries.getResolvedTrades.all();
    res.json({ success: true, data: resolved });
  } catch (error) {
    next(error);
  }
});

// Get recent analyses
router.get('/analyses', (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const analyses = queries.getRecentAnalyses.all(Number(limit));
    res.json({ success: true, data: analyses });
  } catch (error) {
    next(error);
  }
});

// Trigger resolution of expired trades
router.post('/resolve', async (req, res, next) => {
  try {
    await tradingService.resolveExpiredTrades();
    const resolved = queries.getResolvedTrades.all();
    res.json({ success: true, data: resolved });
  } catch (error) {
    next(error);
  }
});

// Clear all open (EXECUTED) positions
router.delete('/positions', (req, res, next) => {
  try {
    const result = queries.clearExecutedTrades.run();
    res.json({ success: true, cleared: result.changes });
  } catch (error) {
    next(error);
  }
});

export default router;
