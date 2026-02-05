import Anthropic from '@anthropic-ai/sdk';
import { queries } from '../config/database';
import { ClaudeAnalysis, MarketData } from '../types';

class ClaudeService {
  private client: Anthropic | null = null;
  private initialized: boolean = false;

  /**
   * Initialize Claude client with API key
   */
  async initialize(): Promise<void> {
    try {
      const creds: any = queries.getCredentials.get();

      if (!creds || !creds.claude_api_key) {
        console.warn('Claude API key not configured');
        return;
      }

      this.client = new Anthropic({
        apiKey: creds.claude_api_key,
      });

      this.initialized = true;
      console.log('Claude client initialized');
    } catch (error) {
      console.error('Failed to initialize Claude client:', error);
      throw error;
    }
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Analyze a market and provide trading recommendation
   */
  async analyzeMarket(marketData: MarketData, riskConfig: any): Promise<ClaudeAnalysis> {
    try {
      if (!this.client) {
        throw new Error('Claude client not initialized');
      }

      const prompt = this.buildAnalysisPrompt(marketData, riskConfig);

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract the text content
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const analysisText = content.text;

      // Parse the JSON response
      const analysis = this.parseAnalysisResponse(analysisText);

      return analysis;
    } catch (error) {
      console.error('Failed to analyze market:', error);
      throw error;
    }
  }

  /**
   * Build the analysis prompt for Claude
   */
  private buildAnalysisPrompt(marketData: MarketData, riskConfig: any): string {
    const yesProbability = (marketData.yes_price * 100).toFixed(1);
    const noProbability = (marketData.no_price * 100).toFixed(1);

    const hasPosition = !!marketData.current_position;
    const positionInfo = hasPosition ? `
CURRENT POSITION:
You hold: ${marketData.current_position!.outcome} shares
Entry price: $${marketData.current_position!.entry_price.toFixed(3)}
Position size: $${marketData.current_position!.size.toFixed(2)}
Current value: $${marketData.current_position!.current_value.toFixed(2)}
Unrealized P&L: ${marketData.current_position!.unrealized_pnl >= 0 ? '+' : ''}$${marketData.current_position!.unrealized_pnl.toFixed(2)}
` : `
CURRENT POSITION: None`;

    const decisionOptions = hasPosition
      ? '"HOLD" (keep position) or "SELL" (exit position at current price)'
      : '"BUY_YES", "BUY_NO", or "HOLD" (skip this market)';

    return `You are a trading analyst for prediction markets on Polymarket. Your task is to analyze the following market and provide a trading recommendation.

MARKET INFORMATION:
Question: ${marketData.question}
Current YES price: $${marketData.yes_price.toFixed(3)} (${yesProbability}% implied probability)
Current NO price: $${marketData.no_price.toFixed(3)} (${noProbability}% implied probability)
24h Volume: $${marketData.volume_24h.toLocaleString()}
Liquidity: $${marketData.liquidity.toLocaleString()}
Time until close: ${marketData.time_remaining_hours.toFixed(1)} hours
${marketData.recent_trend ? `Recent price trend: ${marketData.recent_trend}` : ''}
${positionInfo}

TRADING CONSTRAINTS:
Maximum bet size: $${riskConfig.max_bet_size}
Minimum confidence threshold: ${(riskConfig.min_confidence_threshold * 100).toFixed(0)}%

YOUR TASK:
${hasPosition ? `You already have a position in this market. Decide whether to:
- HOLD: Keep your position and wait for resolution
- SELL: Exit your position now at the current market price (to lock in profit or cut losses)

Consider: Has the market moved in your favor? Has new information changed the outlook? Is it better to take profit now or hold to resolution?` : `You have no position in this market. Decide whether to:
- BUY_YES: Buy YES shares if you believe the probability is underpriced
- BUY_NO: Buy NO shares if you believe the probability is overpriced
- HOLD: Skip this market if you don't see a clear edge`}

IMPORTANT GUIDELINES:
- Be conservative - only recommend trades when you have genuine conviction
- Markets are often efficient, so most prices are fair
- Account for time remaining - markets close to expiry have less opportunity for price movement
- Lower liquidity increases slippage risk
${hasPosition ? `- Don't sell just because of small unrealized gains - consider if holding to resolution is better
- DO sell if your thesis has changed or you want to lock in significant profit` : `- Only enter a position once per market - make it count`}

Respond ONLY with a valid JSON object (no markdown, no code blocks):
{
  "decision": ${hasPosition ? '"HOLD" | "SELL"' : '"BUY_YES" | "BUY_NO" | "HOLD"'},
  "confidence": 0.0-1.0,
  "reasoning": "detailed explanation",
  "suggested_size": ${hasPosition ? '0' : 'dollar_amount_within_max_bet_size'},
  "key_factors": ["factor1", "factor2", "factor3"],
  "risks": ["risk1", "risk2", "risk3"]
}`;
  }

  /**
   * Parse Claude's analysis response
   */
  private parseAnalysisResponse(response: string): ClaudeAnalysis {
    try {
      // Try to extract JSON from the response
      // Remove markdown code blocks if present
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const analysis: ClaudeAnalysis = JSON.parse(jsonStr);

      // Validate the response
      if (!analysis.decision || !['BUY_YES', 'BUY_NO', 'SELL_YES', 'SELL_NO', 'SELL', 'HOLD'].includes(analysis.decision)) {
        throw new Error('Invalid decision in Claude response');
      }

      if (typeof analysis.confidence !== 'number' || analysis.confidence < 0 || analysis.confidence > 1) {
        throw new Error('Invalid confidence in Claude response');
      }

      if (!analysis.reasoning || typeof analysis.reasoning !== 'string') {
        throw new Error('Invalid reasoning in Claude response');
      }

      if (typeof analysis.suggested_size !== 'number' || analysis.suggested_size < 0) {
        throw new Error('Invalid suggested_size in Claude response');
      }

      if (!Array.isArray(analysis.key_factors)) {
        analysis.key_factors = [];
      }

      if (!Array.isArray(analysis.risks)) {
        analysis.risks = [];
      }

      return analysis;
    } catch (error: any) {
      console.error('Failed to parse Claude response:', error);
      console.error('Raw response:', response);
      throw new Error(`Failed to parse Claude analysis: ${error?.message || 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const claudeService = new ClaudeService();
