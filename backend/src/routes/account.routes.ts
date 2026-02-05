import { Router } from 'express';
import { accountService } from '../services/account.service';

const router = Router();

// GET /summary — All-in-one account data
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await accountService.getAccountSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// GET /profile — Polymarket profile info
router.get('/profile', async (req, res, next) => {
  try {
    const profile = await accountService.getProfile();
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// GET /balance — On-chain + CLOB balances
router.get('/balance', async (req, res, next) => {
  try {
    const [onChain, clob] = await Promise.all([
      accountService.getOnChainBalance(),
      accountService.getClobBalance(),
    ]);
    res.json({ success: true, data: { onChainBalance: onChain, clobBalance: clob } });
  } catch (error) {
    next(error);
  }
});

// GET /positions — Real Polymarket positions
router.get('/positions', async (req, res, next) => {
  try {
    const positions = await accountService.getPositions();
    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
});

// GET /activity — Recent trading activity
router.get('/activity', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const activity = await accountService.getActivity(limit);
    res.json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
});

// GET /pnl — Profit & loss summary
router.get('/pnl', async (req, res, next) => {
  try {
    const pnl = await accountService.getPnl();
    res.json({ success: true, data: pnl });
  } catch (error) {
    next(error);
  }
});

export default router;
