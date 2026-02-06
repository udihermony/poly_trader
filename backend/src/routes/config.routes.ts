import { Router } from 'express';
import { queries } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { tradingService } from '../services/trading.service';
import fs from 'fs';
import path from 'path';

const router = Router();

// Helper to read/write private key from .env file
const ENV_PATH = path.join(__dirname, '../../.env');

function getPrivateKeyFromEnv(): string | null {
  try {
    if (!fs.existsSync(ENV_PATH)) return null;
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const match = content.match(/^POLYMARKET_PRIVATE_KEY=(.*)$/m);
    return match && match[1] ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function setPrivateKeyInEnv(privateKey: string): void {
  let content = '';
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf-8');
  }

  if (content.includes('POLYMARKET_PRIVATE_KEY=')) {
    content = content.replace(/^POLYMARKET_PRIVATE_KEY=.*$/m, `POLYMARKET_PRIVATE_KEY=${privateKey}`);
  } else {
    content = `POLYMARKET_PRIVATE_KEY=${privateKey}\n${content}`;
  }

  fs.writeFileSync(ENV_PATH, content);
  // Update process.env as well
  process.env.POLYMARKET_PRIVATE_KEY = privateKey;
}

// Get risk configuration
router.get('/risk', (req, res, next) => {
  try {
    const config = queries.getRiskConfig.get();
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

// Update risk configuration
router.put('/risk', (req, res, next) => {
  try {
    const { max_bet_size, daily_budget, max_open_positions, min_confidence_threshold, max_market_exposure } = req.body;

    queries.updateRiskConfig.run(
      max_bet_size,
      daily_budget,
      max_open_positions,
      min_confidence_threshold,
      max_market_exposure
    );

    const updated = queries.getRiskConfig.get();
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Get app configuration
router.get('/app', (req, res, next) => {
  try {
    const config = queries.getAppConfig.get();
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

// Update app configuration
router.put('/app', (req, res, next) => {
  try {
    const { paper_trading_mode, trading_enabled, analysis_interval_minutes } = req.body;

    // Convert booleans to integers for SQLite (1 = true, 0 = false)
    queries.updateAppConfig.run(
      paper_trading_mode ? 1 : 0,
      trading_enabled ? 1 : 0,
      analysis_interval_minutes
    );

    const updated = queries.getAppConfig.get();
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Get credentials (without sensitive data exposed to client)
router.get('/credentials', (req, res, next) => {
  try {
    const creds: any = queries.getCredentials.get();
    const hasPrivateKey = !!getPrivateKeyFromEnv();

    if (!creds) {
      return res.json({
        success: true,
        data: {
          hasPolymarketCredentials: false,
          hasClaudeApiKey: false,
          hasPrivateKey,
        },
      });
    }

    res.json({
      success: true,
      data: {
        hasPolymarketCredentials: !!(creds.polymarket_api_key && creds.polymarket_secret && creds.polymarket_passphrase),
        hasClaudeApiKey: !!creds.claude_api_key,
        hasGeminiApiKey: !!creds.gemini_api_key,
        hasLocalLLM: !!creds.local_llm_url,
        hasPrivateKey,
        funderAddress: creds.polymarket_funder_address,
        localLLMUrl: creds.local_llm_url,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update credentials
router.put('/credentials', async (req, res, next) => {
  try {
    const {
      polymarket_api_key,
      polymarket_secret,
      polymarket_passphrase,
      polymarket_funder_address,
      polymarket_private_key,
      claude_api_key,
      gemini_api_key,
      local_llm_url,
    } = req.body;

    // Handle private key separately (stored in .env file, not database)
    if (polymarket_private_key && polymarket_private_key.trim() !== '') {
      setPrivateKeyInEnv(polymarket_private_key.trim());
    }

    // Get existing credentials
    const existing: any = queries.getCredentials.get() || {};

    // Only update fields that are not null (keep existing values for null fields)
    queries.upsertCredentials.run(
      polymarket_api_key !== null ? polymarket_api_key : existing.polymarket_api_key,
      polymarket_secret !== null ? polymarket_secret : existing.polymarket_secret,
      polymarket_passphrase !== null ? polymarket_passphrase : existing.polymarket_passphrase,
      polymarket_funder_address !== null ? polymarket_funder_address : existing.polymarket_funder_address,
      claude_api_key !== null ? claude_api_key : existing.claude_api_key,
      gemini_api_key !== null ? gemini_api_key : existing.gemini_api_key,
      local_llm_url !== null ? local_llm_url : existing.local_llm_url
    );

    // Re-initialize services with new credentials
    try {
      await tradingService.initialize();
    } catch (initError) {
      console.warn('Failed to re-initialize services after credential update:', initError);
    }

    res.json({ success: true, message: 'Credentials updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Get budget tracking
router.get('/budget', (req, res, next) => {
  try {
    let budget: any = queries.getTodayBudget.get();
    if (!budget) {
      queries.createTodayBudget.run();
      budget = queries.getTodayBudget.get();
    }

    // Also get daily_budget from risk_config
    const riskConfig: any = queries.getRiskConfig.get();

    res.json({
      success: true,
      data: {
        ...budget,
        daily_budget: riskConfig?.daily_budget || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
