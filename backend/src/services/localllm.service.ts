import OpenAI from 'openai';
import { queries } from '../config/database';
import { MarketData, ClaudeAnalysis } from '../types';

class LocalLLMService {
  private client: OpenAI | null = null;

  async initialize(): Promise<void> {
    try {
      const creds: any = queries.getCredentials.get();

      if (!creds || !creds.local_llm_url) {
        console.warn('Local LLM URL not configured');
        return;
      }

      // Create OpenAI-compatible client pointing to LM Studio
      this.client = new OpenAI({
        baseURL: creds.local_llm_url + '/v1',
        apiKey: 'lm-studio', // LM Studio doesn't require a real API key
      });

      console.log(`Local LLM client initialized (${creds.local_llm_url})`);
    } catch (error) {
      console.error('Failed to initialize Local LLM client:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  async analyzeMarket(marketData: MarketData, riskConfig: any): Promise<ClaudeAnalysis> {
    if (!this.client) {
      throw new Error('Local LLM client not initialized');
    }

    const prompt = this.buildAnalysisPrompt(marketData, riskConfig);

    try {
      const response = await this.client.chat.completions.create({
        model: 'qwen3-8b', // Model loaded in LM Studio
        messages: [
          {
            role: 'system',
            content: 'You are a professional prediction market trader analyzing markets on Polymarket. You MUST respond with ONLY valid JSON in the exact format requested. Do NOT include explanations, thinking, or extra text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more focused output
        max_tokens: 2000, // Increased to ensure complete JSON response
      });

      const text = response.choices[0]?.message?.content || '';
      return this.parseAnalysisResponse(text);
    } catch (error) {
      console.error('Local LLM analysis failed:', error);
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
      ? '"HOLD" or "SELL"'
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
  ? 'You have a position. Decide: HOLD (keep it) or SELL (exit now).'
  : 'You have no position. Decide: BUY_YES, BUY_NO, or HOLD (skip).'}

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "decision": ${decisionOptions},
  "confidence": 0.75,
  "reasoning": "Brief explanation",
  "suggested_size": ${hasPosition ? '0' : '10.00'},
  "key_factors": ["factor 1", "factor 2"],
  "risks": ["risk 1", "risk 2"]
}

IMPORTANT:
- Return ONLY the JSON object, nothing else
- Do NOT include <think> tags or explanations
- JUST the raw JSON object`;
  }

  private parseAnalysisResponse(text: string): ClaudeAnalysis {
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim();

      // Remove <think> tags if present (Qwen models use these)
      cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/g, '');

      // Remove markdown code blocks
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```\n?/g, '');
      }

      // Trim again after removals
      cleanText = cleanText.trim();

      const parsed = JSON.parse(cleanText);

      // Validate required fields
      if (!parsed.decision || !parsed.confidence || !parsed.reasoning) {
        throw new Error('Missing required fields in Local LLM response');
      }

      // Ensure confidence is between 0 and 1
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

      // Ensure arrays exist
      parsed.key_factors = parsed.key_factors || [];
      parsed.risks = parsed.risks || [];

      return parsed as ClaudeAnalysis;
    } catch (error) {
      console.error('Failed to parse Local LLM response:', text);
      console.error('Parse error:', error);

      // Return a safe HOLD decision
      return {
        decision: 'HOLD',
        confidence: 0,
        reasoning: 'Failed to parse Local LLM response',
        suggested_size: 0,
        key_factors: [],
        risks: ['Parse error'],
      };
    }
  }
}

export const localLLMService = new LocalLLMService();
