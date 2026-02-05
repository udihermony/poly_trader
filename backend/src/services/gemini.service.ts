import { GoogleGenerativeAI } from '@google/generative-ai';
import { queries } from '../config/database';
import { MarketData, ClaudeAnalysis } from '../types';

class GeminiService {
  private client: GoogleGenerativeAI | null = null;
  private model: any = null;

  async initialize(): Promise<void> {
    try {
      const creds: any = queries.getCredentials.get();

      if (!creds || !creds.gemini_api_key) {
        console.warn('Gemini API key not configured');
        return;
      }

      this.client = new GoogleGenerativeAI(creds.gemini_api_key);
      // Use Gemini Pro (base model, widely available)
      this.model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash' });

      console.log('Gemini client initialized');
    } catch (error) {
      console.error('Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.client !== null && this.model !== null;
  }

  async analyzeMarket(marketData: MarketData, riskConfig: any): Promise<ClaudeAnalysis> {
    if (!this.model) {
      throw new Error('Gemini client not initialized');
    }

    const prompt = this.buildAnalysisPrompt(marketData, riskConfig);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseAnalysisResponse(text);
    } catch (error) {
      console.error('Gemini analysis failed:', error);
      throw error;
    }
  }

  private buildAnalysisPrompt(marketData: MarketData, riskConfig: any): string {
    const hasPosition = !!marketData.current_position;
    const positionInfo = hasPosition ? `
CURRENT POSITION:
You hold: ${marketData.current_position!.outcome} shares
Entry price: $${marketData.current_position!.entry_price.toFixed(3)}
Position size: $${marketData.current_position!.size.toFixed(2)}
Current value: $${marketData.current_position!.current_value.toFixed(2)}
Unrealized P&L: ${marketData.current_position!.unrealized_pnl >= 0 ? '+' : ''}$${marketData.current_position!.unrealized_pnl.toFixed(2)}` : `
CURRENT POSITION: None`;

    const decisionOptions = hasPosition
      ? '"HOLD" (keep position) or "SELL" (exit position)'
      : '"BUY_YES", "BUY_NO", or "HOLD"';

    return `You are a professional prediction market trader analyzing markets on Polymarket.

MARKET INFORMATION:
Question: ${marketData.question}
Current YES price: $${marketData.yes_price.toFixed(4)} (${(marketData.yes_price * 100).toFixed(1)}% probability)
Current NO price: $${marketData.no_price.toFixed(4)} (${(marketData.no_price * 100).toFixed(1)}% probability)
24h Volume: $${marketData.volume_24h.toLocaleString()}
Liquidity: $${marketData.liquidity.toLocaleString()}
Time until close: ${marketData.time_remaining_hours.toFixed(1)} hours
${positionInfo}

RISK LIMITS:
Max bet size: $${riskConfig.max_bet_size}
Min confidence threshold: ${(riskConfig.min_confidence_threshold * 100).toFixed(0)}%

TASK:
${hasPosition
  ? 'You have a position. Decide: HOLD (keep it) or SELL (exit now at current price).'
  : 'You have no position. Decide: BUY_YES, BUY_NO, or HOLD (skip).'}

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "decision": ${decisionOptions},
  "confidence": 0.75,
  "reasoning": "Brief explanation of your decision",
  "suggested_size": ${hasPosition ? '0' : '10.00'},
  "key_factors": ["factor 1", "factor 2"],
  "risks": ["risk 1", "risk 2"]
}

IMPORTANT:
- confidence must be between 0 and 1
${hasPosition ? '- suggested_size should be 0 for HOLD/SELL' : `- suggested_size must be <= ${riskConfig.max_bet_size}`}
- Return JSON only, no additional text`;
  }

  private parseAnalysisResponse(text: string): ClaudeAnalysis {
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(cleanText);

      // Validate required fields
      if (!parsed.decision || !parsed.confidence || !parsed.reasoning) {
        throw new Error('Missing required fields in Gemini response');
      }

      // Ensure confidence is between 0 and 1
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

      // Ensure arrays exist
      parsed.key_factors = parsed.key_factors || [];
      parsed.risks = parsed.risks || [];

      return parsed as ClaudeAnalysis;
    } catch (error) {
      console.error('Failed to parse Gemini response:', text);
      console.error('Parse error:', error);

      // Return a safe HOLD decision
      return {
        decision: 'HOLD',
        confidence: 0,
        reasoning: 'Failed to parse Gemini response',
        suggested_size: 0,
        key_factors: [],
        risks: ['Parse error'],
      };
    }
  }
}

export const geminiService = new GeminiService();
