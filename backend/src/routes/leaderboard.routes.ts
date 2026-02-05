import { Router } from 'express';
import axios from 'axios';

const router = Router();

const DATA_API_BASE = 'https://data-api.polymarket.com';

// Get top traders from leaderboard
router.get('/', async (req, res, next) => {
  try {
    const {
      category = 'OVERALL',
      timePeriod = 'DAY',
      orderBy = 'PNL',
      limit = 10
    } = req.query;

    const response = await axios.get(`${DATA_API_BASE}/v1/leaderboard`, {
      params: { category, timePeriod, orderBy, limit },
    });

    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Failed to fetch leaderboard:', error.message);
    next(error);
  }
});

// Get recent positions (BUY trades) for a trader
router.get('/trader/:address/positions', async (req, res, next) => {
  try {
    const { address } = req.params;
    const { limit = 20 } = req.query;

    const response = await axios.get(`${DATA_API_BASE}/activity`, {
      params: {
        user: address,
        type: 'TRADE',
        side: 'BUY',
        limit,
        sortBy: 'TIMESTAMP',
        sortDirection: 'DESC',
      },
    });

    // Group by market to show unique positions
    const positionMap = new Map<string, any>();
    for (const activity of response.data) {
      const key = activity.conditionId;
      if (!positionMap.has(key)) {
        positionMap.set(key, {
          conditionId: activity.conditionId,
          title: activity.title,
          slug: activity.slug,
          eventSlug: activity.eventSlug,
          outcome: activity.outcome,
          icon: activity.icon,
          totalSize: 0,
          avgPrice: 0,
          trades: [],
          latestTimestamp: activity.timestamp,
        });
      }
      const pos = positionMap.get(key)!;
      pos.trades.push({
        price: activity.price,
        size: activity.usdcSize,
        timestamp: activity.timestamp,
      });
      pos.totalSize += activity.usdcSize || 0;
    }

    // Calculate average price weighted by size
    for (const pos of positionMap.values()) {
      let weightedSum = 0;
      let totalSize = 0;
      for (const t of pos.trades) {
        if (t.size > 0 && t.price > 0) {
          weightedSum += t.price * t.size;
          totalSize += t.size;
        }
      }
      pos.avgPrice = totalSize > 0 ? weightedSum / totalSize : 0;
      pos.tradeCount = pos.trades.length;
      delete pos.trades; // Don't send all trades to frontend
    }

    const positions = Array.from(positionMap.values())
      .sort((a, b) => b.latestTimestamp - a.latestTimestamp)
      .slice(0, 10);

    res.json({ success: true, data: positions });
  } catch (error: any) {
    console.error('Failed to fetch trader positions:', error.message);
    next(error);
  }
});

// Get top traders with their recent positions in one call
router.get('/top-positions', async (req, res, next) => {
  try {
    const {
      category = 'OVERALL',
      timePeriod = 'DAY',
      traderLimit = 5,
      positionsPerTrader = 3
    } = req.query;

    // First get top traders
    const leaderboardRes = await axios.get(`${DATA_API_BASE}/v1/leaderboard`, {
      params: {
        category,
        timePeriod,
        orderBy: 'PNL',
        limit: traderLimit,
      },
    });

    const traders = leaderboardRes.data;
    const result = [];

    // Fetch positions for each trader
    for (const trader of traders) {
      try {
        const activityRes = await axios.get(`${DATA_API_BASE}/activity`, {
          params: {
            user: trader.proxyWallet,
            type: 'TRADE',
            side: 'BUY',
            limit: 50, // Fetch more to group properly
            sortBy: 'TIMESTAMP',
            sortDirection: 'DESC',
          },
        });

        // Group by market
        const positionMap = new Map<string, any>();
        for (const activity of activityRes.data) {
          const key = activity.conditionId;
          if (!positionMap.has(key)) {
            positionMap.set(key, {
              conditionId: activity.conditionId,
              title: activity.title,
              slug: activity.slug,
              outcome: activity.outcome,
              icon: activity.icon,
              totalSize: 0,
              avgPrice: 0,
              priceSum: 0,
              count: 0,
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

        // Calculate avg price and get top positions
        const positions = Array.from(positionMap.values())
          .map(p => ({
            ...p,
            avgPrice: p.count > 0 ? p.priceSum / p.count : 0,
          }))
          .sort((a, b) => b.totalSize - a.totalSize)
          .slice(0, Number(positionsPerTrader));

        result.push({
          rank: trader.rank,
          userName: trader.userName,
          proxyWallet: trader.proxyWallet,
          pnl: trader.pnl,
          vol: trader.vol,
          profileImage: trader.profileImage,
          xUsername: trader.xUsername,
          verifiedBadge: trader.verifiedBadge,
          positions,
        });
      } catch (e) {
        // Skip trader if we can't fetch their activity
        result.push({
          rank: trader.rank,
          userName: trader.userName,
          proxyWallet: trader.proxyWallet,
          pnl: trader.pnl,
          vol: trader.vol,
          profileImage: trader.profileImage,
          positions: [],
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Failed to fetch top positions:', error.message);
    next(error);
  }
});

export default router;
