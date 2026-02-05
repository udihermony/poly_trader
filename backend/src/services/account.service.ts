import axios from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { queries } from '../config/database';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const CLOB_API_BASE = 'https://clob.polymarket.com';
const DATA_API_BASE = 'https://data-api.polymarket.com';
const POLYGON_RPC = 'https://polygon-rpc.com';
const USDC_CONTRACT = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];

interface AccountSummary {
  hasCredentials: boolean;
  profile: any | null;
  onChainBalance: string | null;
  clobBalance: any | null;
  positions: any[] | null;
  activity: any[] | null;
  pnl: any | null;
}

class AccountService {
  private getCredentials(): {
    apiKey: string | null;
    secret: string | null;
    passphrase: string | null;
    funderAddress: string | null;
  } {
    const creds: any = queries.getCredentials.get();
    return {
      apiKey: creds?.polymarket_api_key || null,
      secret: creds?.polymarket_secret || null,
      passphrase: creds?.polymarket_passphrase || null,
      funderAddress: creds?.polymarket_funder_address || null,
    };
  }

  private generateClobHeaders(method: string, requestPath: string): Record<string, string> {
    const { apiKey, secret, passphrase } = this.getCredentials();
    if (!apiKey || !secret || !passphrase) {
      throw new Error('Missing CLOB credentials');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = timestamp + method + requestPath;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64');

    return {
      POLY_API_KEY: apiKey,
      POLY_PASSPHRASE: passphrase,
      POLY_TIMESTAMP: timestamp,
      POLY_SIGNATURE: signature,
    };
  }

  async getProfile(): Promise<any | null> {
    try {
      const { funderAddress } = this.getCredentials();
      if (!funderAddress) return null;

      const res = await axios.get(`${GAMMA_API_BASE}/profiles/${funderAddress}`);
      return res.data;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  }

  async getOnChainBalance(): Promise<string | null> {
    try {
      const { funderAddress } = this.getCredentials();
      if (!funderAddress) return null;

      const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC);
      const contract = new ethers.Contract(USDC_CONTRACT, ERC20_ABI, provider);
      const rawBalance = await contract.balanceOf(funderAddress);
      return ethers.utils.formatUnits(rawBalance, 6);
    } catch (error) {
      console.error('Failed to fetch on-chain balance:', error);
      return null;
    }
  }

  async getClobBalance(): Promise<any | null> {
    try {
      const requestPath = '/balance-allowance?asset_type=USDC';
      const headers = this.generateClobHeaders('GET', requestPath);

      const res = await axios.get(`${CLOB_API_BASE}${requestPath}`, { headers });
      return res.data;
    } catch (error) {
      console.error('Failed to fetch CLOB balance:', error);
      return null;
    }
  }

  async getPositions(): Promise<any[] | null> {
    try {
      const { funderAddress } = this.getCredentials();
      if (!funderAddress) return null;

      const res = await axios.get(`${DATA_API_BASE}/positions`, {
        params: { user: funderAddress },
      });
      return res.data;
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      return null;
    }
  }

  async getActivity(limit = 50): Promise<any[] | null> {
    try {
      const { funderAddress } = this.getCredentials();
      if (!funderAddress) return null;

      const res = await axios.get(`${DATA_API_BASE}/activity`, {
        params: { user: funderAddress, limit },
      });
      return res.data;
    } catch (error) {
      console.error('Failed to fetch activity:', error);
      return null;
    }
  }

  async getPnl(): Promise<any | null> {
    try {
      const { funderAddress } = this.getCredentials();
      if (!funderAddress) return null;

      const res = await axios.get(`${DATA_API_BASE}/pnl`, {
        params: { user: funderAddress },
      });
      return res.data;
    } catch (error) {
      console.error('Failed to fetch PnL:', error);
      return null;
    }
  }

  async getAccountSummary(): Promise<AccountSummary> {
    const { apiKey, secret, passphrase, funderAddress } = this.getCredentials();
    const hasCredentials = !!(apiKey && secret && passphrase && funderAddress);

    const [profileResult, onChainResult, clobResult, positionsResult, activityResult, pnlResult] =
      await Promise.allSettled([
        this.getProfile(),
        this.getOnChainBalance(),
        this.getClobBalance(),
        this.getPositions(),
        this.getActivity(),
        this.getPnl(),
      ]);

    return {
      hasCredentials,
      profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
      onChainBalance: onChainResult.status === 'fulfilled' ? onChainResult.value : null,
      clobBalance: clobResult.status === 'fulfilled' ? clobResult.value : null,
      positions: positionsResult.status === 'fulfilled' ? positionsResult.value : null,
      activity: activityResult.status === 'fulfilled' ? activityResult.value : null,
      pnl: pnlResult.status === 'fulfilled' ? pnlResult.value : null,
    };
  }
}

export const accountService = new AccountService();
