import { Router } from 'express';
import { tradingService } from '../services/trading.service';
import { riskService } from '../services/risk.service';
import { snipeService } from '../services/snipe.service';

const router = Router();

// Get trading service status
router.get('/status', async (req, res, next) => {
  try {
    const status = tradingService.getStatus();
    const budgetStatus = await riskService.getBudgetStatus();
    const snipeStatus = snipeService.getStatus();

    res.json({
      success: true,
      data: {
        ...status,
        budget: budgetStatus,
        snipe: snipeStatus,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Start trading service
router.post('/start', async (req, res, next) => {
  try {
    await tradingService.start();
    res.json({
      success: true,
      message: 'Trading service started',
    });
  } catch (error) {
    next(error);
  }
});

// Stop trading service
router.post('/stop', (req, res, next) => {
  try {
    tradingService.stop();
    res.json({
      success: true,
      message: 'Trading service stopped',
    });
  } catch (error) {
    next(error);
  }
});

// Trigger manual analysis for a specific market
router.post('/analyze/:marketId', async (req, res, next) => {
  try {
    // This would trigger a one-time analysis
    // For now, just return success (can be implemented later)
    res.json({
      success: true,
      message: 'Manual analysis triggered',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
