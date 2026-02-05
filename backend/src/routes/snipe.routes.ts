import { Router } from 'express';
import { queries, db } from '../config/database';
import { snipeService } from '../services/snipe.service';

const router = Router();

// Get snipe status
router.get('/status', (req, res, next) => {
  try {
    const status = snipeService.getStatus();
    const riskConfig: any = queries.getRiskConfig.get();

    res.json({
      success: true,
      data: {
        ...status,
        snipeEnabled: riskConfig?.snipe_enabled === 1,
        snipeSize: riskConfig?.snipe_size || 10,
        profitTarget: riskConfig?.snipe_profit_target || 0.05,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all sniped positions (open and closed)
router.get('/positions', (req, res, next) => {
  try {
    const positions = queries.getAllSnipedPositions.all();
    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
});

// Get open sniped positions
router.get('/positions/open', (req, res, next) => {
  try {
    const positions = queries.getOpenSnipedPositions.all();
    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
});

// Snipe top positions (copy them)
router.post('/execute', async (req, res, next) => {
  try {
    const result = await snipeService.snipeTopPositions();
    res.json({
      success: true,
      message: `Copied ${result.copied} positions, skipped ${result.skipped} (already held)`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Manually check and close positions
router.post('/check', async (req, res, next) => {
  try {
    const result = await snipeService.checkAndClosePositions();
    res.json({
      success: true,
      message: `Checked ${result.checked} positions, closed ${result.closed}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Start auto-monitoring
router.post('/start', (req, res, next) => {
  try {
    const appConfig: any = queries.getAppConfig.get();
    const intervalMs = (appConfig?.analysis_interval_minutes || 5) * 60 * 1000;

    snipeService.start(intervalMs);
    res.json({ success: true, message: 'Snipe monitoring started' });
  } catch (error) {
    next(error);
  }
});

// Stop auto-monitoring
router.post('/stop', (req, res, next) => {
  try {
    snipeService.stop();
    res.json({ success: true, message: 'Snipe monitoring stopped' });
  } catch (error) {
    next(error);
  }
});

// Clear all open sniped positions
router.delete('/positions', (req, res, next) => {
  try {
    queries.clearOpenSnipedPositions.run();
    res.json({ success: true, message: 'Cleared all open sniped positions' });
  } catch (error) {
    next(error);
  }
});

// Update snipe settings
router.patch('/settings', (req, res, next) => {
  try {
    const { snipeSize, profitTarget, snipeEnabled } = req.body;

    const riskConfig: any = queries.getRiskConfig.get();
    const newSize = snipeSize !== undefined ? snipeSize : riskConfig?.snipe_size || 10;
    const newTarget = profitTarget !== undefined ? profitTarget : riskConfig?.snipe_profit_target || 0.05;
    const newEnabled = snipeEnabled !== undefined ? (snipeEnabled ? 1 : 0) : riskConfig?.snipe_enabled || 0;

    // Update the risk config with snipe settings
    db.prepare(`
      UPDATE risk_config SET snipe_enabled = ?, snipe_size = ?, snipe_profit_target = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1
    `).run(newEnabled, newSize, newTarget);

    res.json({ success: true, message: 'Snipe settings updated' });
  } catch (error) {
    next(error);
  }
});

export default router;
