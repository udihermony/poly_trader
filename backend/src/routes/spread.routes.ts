import { Router } from 'express';
import { queries, db } from '../config/database';
import { spreadService } from '../services/spread.service';

const router = Router();

// GET /status — Scanner status + config
router.get('/status', (req, res, next) => {
  try {
    const status = spreadService.getStatus();
    const config: any = queries.getSpreadConfig.get();

    res.json({
      success: true,
      data: {
        ...status,
        spreadEnabled: config?.spread_enabled === 1,
        scanIntervalSeconds: config?.scan_interval_seconds || 60,
        minSpreadThreshold: config?.min_spread_threshold || 0.01,
        maxSpreadBetSize: config?.max_spread_bet_size || 10,
        autoExecute: config?.auto_execute === 1,
        scanMultiOutcome: config?.scan_multi_outcome === 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /opportunities — Active spread opportunities
router.get('/opportunities', (req, res, next) => {
  try {
    const opportunities = queries.getActiveSpreadOpportunities.all();
    res.json({ success: true, data: opportunities });
  } catch (error) {
    next(error);
  }
});

// GET /trades — All spread trades
router.get('/trades', (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const trades = queries.getAllSpreadTrades.all(limit);
    res.json({ success: true, data: trades });
  } catch (error) {
    next(error);
  }
});

// GET /trades/open — Open spread trades
router.get('/trades/open', (req, res, next) => {
  try {
    const trades = queries.getOpenSpreadTrades.all();
    res.json({ success: true, data: trades });
  } catch (error) {
    next(error);
  }
});

// GET /trades/stats — Aggregate stats
router.get('/trades/stats', (req, res, next) => {
  try {
    const stats = queries.getSpreadTradeStats.get();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// POST /scan — Manual scan trigger
router.post('/scan', async (req, res, next) => {
  try {
    const result = await spreadService.scanAll();
    res.json({
      success: true,
      message: `Scan complete: ${result.total} opportunities found`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /execute/:opportunityId — Execute a spread trade
router.post('/execute/:opportunityId', async (req, res, next) => {
  try {
    const opportunityId = parseInt(req.params.opportunityId);
    const { totalInvestment } = req.body;

    if (!totalInvestment || totalInvestment <= 0) {
      return res.status(400).json({ success: false, message: 'totalInvestment is required and must be positive' });
    }

    const config: any = queries.getSpreadConfig.get();
    const maxBet = config?.max_spread_bet_size || 10;
    if (totalInvestment > maxBet) {
      return res.status(400).json({ success: false, message: `Investment exceeds max spread bet size ($${maxBet})` });
    }

    const result = await spreadService.executeSpread(opportunityId, totalInvestment);
    res.json({
      success: true,
      message: `Spread trade executed: $${totalInvestment} invested`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /check — Manually check open trades for resolution
router.post('/check', async (req, res, next) => {
  try {
    const forceAll = req.body.forceAll === true;
    const result = await spreadService.checkOpenTrades(forceAll);
    res.json({
      success: true,
      message: forceAll
        ? `Force-checked all ${result.checked} trades, closed ${result.closed}`
        : `Checked ${result.checked} past-due trades, closed ${result.closed}, skipped ${result.skipped} (not yet ended)`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /start — Start auto-scanner
router.post('/start', (req, res, next) => {
  try {
    const config: any = queries.getSpreadConfig.get();
    const intervalMs = (config?.scan_interval_seconds || 60) * 1000;
    spreadService.start(intervalMs);
    res.json({ success: true, message: 'Spread scanner started' });
  } catch (error) {
    next(error);
  }
});

// POST /stop — Stop auto-scanner
router.post('/stop', (req, res, next) => {
  try {
    spreadService.stop();
    res.json({ success: true, message: 'Spread scanner stopped' });
  } catch (error) {
    next(error);
  }
});

// PATCH /settings — Update spread config
router.patch('/settings', (req, res, next) => {
  try {
    const {
      spreadEnabled,
      scanIntervalSeconds,
      minSpreadThreshold,
      maxSpreadBetSize,
      autoExecute,
      scanMultiOutcome,
    } = req.body;

    const config: any = queries.getSpreadConfig.get();

    queries.updateSpreadConfig.run(
      spreadEnabled !== undefined ? (spreadEnabled ? 1 : 0) : (config?.spread_enabled || 0),
      scanIntervalSeconds !== undefined ? scanIntervalSeconds : (config?.scan_interval_seconds || 60),
      minSpreadThreshold !== undefined ? minSpreadThreshold : (config?.min_spread_threshold || 0.01),
      maxSpreadBetSize !== undefined ? maxSpreadBetSize : (config?.max_spread_bet_size || 10),
      autoExecute !== undefined ? (autoExecute ? 1 : 0) : (config?.auto_execute || 0),
      scanMultiOutcome !== undefined ? (scanMultiOutcome ? 1 : 0) : (config?.scan_multi_outcome ?? 1),
    );

    res.json({ success: true, message: 'Spread settings updated' });
  } catch (error) {
    next(error);
  }
});

// DELETE /trades — Clear open spread trades
router.delete('/trades', (req, res, next) => {
  try {
    queries.clearOpenSpreadTrades.run();
    res.json({ success: true, message: 'Cleared all open spread trades' });
  } catch (error) {
    next(error);
  }
});

// DELETE /opportunities — Clear cached opportunities
router.delete('/opportunities', (req, res, next) => {
  try {
    queries.clearSpreadOpportunities.run();
    res.json({ success: true, message: 'Cleared all spread opportunities' });
  } catch (error) {
    next(error);
  }
});

export default router;
