import { ClobClient, Side, AssetType } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import { queries } from '../config/database';
import axios from 'axios';

const HOST = 'https://clob.polymarket.com';
const CHAIN_ID = 137; // Polygon mainnet

interface MarketPrice {
  yes_price: number;
  no_price: number;
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
}

interface OrderResult {
  orderID: string;
  status: string;
  transactionsHashes?: string[];
}

class PolymarketService {
  private client: ClobClient | null = null;
  private initialized: boolean = false;
  private isPaperMode: boolean = true;

  /**
   * Initialize the CLOB client with credentials
   */
  async initialize(): Promise<void> {
    try {
      const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
      const creds: any = queries.getCredentials.get();
      const appConfig: any = queries.getAppConfig.get();

      this.isPaperMode = appConfig?.paper_trading_mode === 1;

      if (!privateKey || !creds?.polymarket_funder_address) {
        console.warn('Polymarket: Missing private key or funder address - paper trading only');
        this.initialized = true;
        return;
      }

      // Create signer from private key
      const signer = new Wallet(privateKey);

      // Initial client to derive/create API keys
      let tempClient = new ClobClient(HOST, CHAIN_ID, signer);

      // Check if we have existing API creds, or derive new ones
      let apiCreds;
      if (creds.polymarket_api_key && creds.polymarket_secret && creds.polymarket_passphrase) {
        apiCreds = {
          key: creds.polymarket_api_key,
          secret: creds.polymarket_secret,
          passphrase: creds.polymarket_passphrase,
        };
        console.log('Polymarket: Using existing API credentials');
      } else {
        // Derive new API credentials
        console.log('Polymarket: Deriving new API credentials...');
        const rawCreds = await tempClient.createOrDeriveApiKey();

        // Convert from ApiKeyRaw to ApiKeyCreds format
        apiCreds = {
          key: (rawCreds as any).apiKey || (rawCreds as any).key,
          secret: rawCreds.secret,
          passphrase: rawCreds.passphrase,
        };

        // Save the derived credentials to database
        queries.upsertCredentials.run(
          apiCreds.key,
          apiCreds.secret,
          apiCreds.passphrase,
          creds.polymarket_funder_address,
          creds.claude_api_key,
          creds.gemini_api_key,
          creds.local_llm_url
        );
        console.log('Polymarket: New API credentials saved');
      }

      // Determine signature type based on wallet setup
      // POLY_PROXY (1) = Magic Link / email login
      // GNOSIS_SAFE (2) = Browser wallet via Polymarket.com
      // EOA (0) = Direct wallet, not through Polymarket.com
      const SIGNATURE_TYPE = 1; // POLY_PROXY for Magic Link / email login
      const FUNDER_ADDRESS = creds.polymarket_funder_address;

      // Create fully authenticated client
      this.client = new ClobClient(
        HOST,
        CHAIN_ID,
        signer,
        apiCreds,
        SIGNATURE_TYPE,
        FUNDER_ADDRESS
      );

      this.initialized = true;
      console.log('Polymarket service initialized successfully');
      console.log(`  - Signature Type: ${SIGNATURE_TYPE} (GNOSIS_SAFE)`);
      console.log(`  - Funder Address: ${FUNDER_ADDRESS}`);
      console.log(`  - Paper Mode: ${this.isPaperMode}`);
    } catch (error) {
      console.error('Failed to initialize Polymarket client:', error);
      this.initialized = true; // Still mark as initialized to allow paper trading
    }
  }

  /**
   * Check if client is initialized for real trading
   */
  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Check if in paper trading mode
   */
  isPaperTrading(): boolean {
    return this.isPaperMode || !this.client;
  }

  /**
   * Get market prices and order book data
   */
  async getMarketPrices(tokenId: string | null): Promise<MarketPrice | null> {
    try {
      if (!tokenId) {
        return this.getMockPrices();
      }

      if (this.client) {
        // Get real order book
        const orderBook = await this.client.getOrderBook(tokenId);

        const bids = orderBook.bids || [];
        const asks = orderBook.asks || [];

        const yesBid = bids.length > 0 ? parseFloat(bids[0].price) : 0;
        const yesAsk = asks.length > 0 ? parseFloat(asks[0].price) : 1;
        const yesPrice = (yesBid + yesAsk) / 2;
        const noPrice = 1 - yesPrice;

        return {
          yes_price: yesPrice,
          no_price: noPrice,
          yes_bid: yesBid,
          yes_ask: yesAsk,
          no_bid: 1 - yesAsk,
          no_ask: 1 - yesBid,
        };
      }

      return this.getMockPrices();
    } catch (error) {
      console.error(`Failed to get market prices for ${tokenId}:`, error);
      return this.getMockPrices();
    }
  }

  private getMockPrices(): MarketPrice {
    const baseYesPrice = 0.45 + Math.random() * 0.1;
    const spread = 0.02;

    const yesBid = parseFloat((baseYesPrice - spread / 2).toFixed(4));
    const yesAsk = parseFloat((baseYesPrice + spread / 2).toFixed(4));
    const yesPrice = parseFloat(((yesBid + yesAsk) / 2).toFixed(4));

    return {
      yes_price: yesPrice,
      no_price: parseFloat((1 - yesPrice).toFixed(4)),
      yes_bid: yesBid,
      yes_ask: yesAsk,
      no_bid: parseFloat((1 - yesAsk).toFixed(4)),
      no_ask: parseFloat((1 - yesBid).toFixed(4)),
    };
  }

  /**
   * Get detailed market data from Gamma API
   */
  async getMarketData(marketId: string) {
    try {
      const response = await axios.get(`https://gamma-api.polymarket.com/markets/${marketId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get market data for ${marketId}:`, error);
      throw error;
    }
  }

  /**
   * Get price history from CLOB API
   */
  async getPriceHistory(tokenId: string, interval: string = '1d', fidelity: number = 15): Promise<{t: number, p: number}[]> {
    try {
      const response = await axios.get(`https://clob.polymarket.com/prices-history`, {
        params: { market: tokenId, interval, fidelity },
      });
      return response.data?.history || [];
    } catch (error) {
      console.error(`Failed to get price history for ${tokenId}:`, error);
      return [];
    }
  }

  /**
   * Place a market order (buy at best available price)
   */
  async placeMarketOrder(
    tokenId: string,
    side: 'BUY' | 'SELL',
    amount: number  // Amount in USDC for BUY, shares for SELL
  ): Promise<OrderResult> {
    if (this.isPaperTrading()) {
      console.log(`[PAPER] Market order: ${side} $${amount} on ${tokenId}`);
      return {
        orderID: `PAPER_${Date.now()}`,
        status: 'FILLED',
      };
    }

    if (!this.client) {
      throw new Error('Polymarket client not initialized');
    }

    try {
      const sideEnum = side === 'BUY' ? Side.BUY : Side.SELL;
      const order = await this.client.createMarketOrder({
        tokenID: tokenId,
        side: sideEnum,
        amount: amount,
      });

      const result = await this.client.postOrder(order);

      console.log(`[LIVE] Market order placed: ${side} $${amount}`, result);
      return {
        orderID: (result as any).orderID || (result as any).id,
        status: (result as any).status || 'PENDING',
        transactionsHashes: (result as any).transactionsHashes,
      };
    } catch (error) {
      console.error('Failed to place market order:', error);
      throw error;
    }
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(
    tokenId: string,
    side: 'BUY' | 'SELL',
    price: number,
    size: number  // Number of shares
  ): Promise<OrderResult> {
    if (this.isPaperTrading()) {
      console.log(`[PAPER] Limit order: ${side} ${size} shares @ $${price} on ${tokenId}`);
      return {
        orderID: `PAPER_${Date.now()}`,
        status: 'OPEN',
      };
    }

    if (!this.client) {
      throw new Error('Polymarket client not initialized');
    }

    try {
      const sideEnum = side === 'BUY' ? Side.BUY : Side.SELL;
      const order = await this.client.createOrder({
        tokenID: tokenId,
        side: sideEnum,
        price: price,
        size: size,
      });

      const result = await this.client.postOrder(order);

      console.log(`[LIVE] Limit order placed: ${side} ${size} @ $${price}`, result);
      return {
        orderID: (result as any).orderID || (result as any).id,
        status: (result as any).status || 'OPEN',
        transactionsHashes: (result as any).transactionsHashes,
      };
    } catch (error) {
      console.error('Failed to place limit order:', error);
      throw error;
    }
  }

  /**
   * Place an order (legacy method for compatibility)
   */
  async placeOrder(
    conditionId: string,
    outcome: 'YES' | 'NO',
    side: 'BUY' | 'SELL',
    size: number,
    price: number
  ): Promise<any> {
    // This is a simplified wrapper - in real usage, you'd need the tokenId
    // For now, just log and return a paper order
    console.log(`placeOrder called: ${side} ${outcome} @ ${price} for ${size}`);
    return this.placeLimitOrder(conditionId, side, price, size);
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<any> {
    if (!this.client || orderId.startsWith('PAPER_')) {
      return { orderID: orderId, status: 'FILLED' };
    }

    try {
      const order = await this.client.getOrder(orderId);
      return order;
    } catch (error) {
      console.error(`Failed to get order status for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    if (!this.client || orderId.startsWith('PAPER_')) {
      console.log(`[PAPER] Order cancelled: ${orderId}`);
      return;
    }

    try {
      await this.client.cancelOrder({ orderID: orderId } as any);
      console.log(`Order cancelled: ${orderId}`);
    } catch (error) {
      console.error(`Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get CLOB trading balance
   */
  async getBalance(): Promise<{ balance: string; allowance: string } | null> {
    if (!this.client) {
      return null;
    }

    try {
      const balanceAllowance = await this.client.getBalanceAllowance({
        asset_type: AssetType.COLLATERAL,
      });
      return balanceAllowance as any;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return null;
    }
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(): Promise<any[]> {
    if (!this.client) {
      return [];
    }

    try {
      const orders = await this.client.getOpenOrders();
      return orders;
    } catch (error) {
      console.error('Failed to get open orders:', error);
      return [];
    }
  }
}

// Export singleton instance
export const polymarketService = new PolymarketService();
