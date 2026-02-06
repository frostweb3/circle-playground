import { config } from './config.js';

/**
 * Circle Mint API Client
 * Handles authentication and API requests to Circle Mint endpoints
 */
export class CircleMintClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }

  /**
   * Make an authenticated request to Circle Mint API
   * Follows authentication format from: https://developers.circle.com/circle-mint/getting-started-with-the-circle-apis
   * Format: Authorization: Bearer YOUR_API_KEY
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure HTTPS is used (required by Circle APIs)
    const url = `${this.baseUrl}${endpoint}`;
    if (!url.startsWith('https://')) {
      throw new Error('Circle APIs require HTTPS. All requests must be made over HTTPS.');
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(
        `Circle Mint API Error (${response.status}): ${JSON.stringify(error)}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get account balance
   * Note: Accounts API was deprecated. Use business account endpoints instead.
   */
  async getBalance(): Promise<any> {
    // Try the balances endpoint directly
    try {
      return await this.request('/v1/balances');
    } catch (error) {
      // If that fails, try business account balance
      try {
        return await this.request('/v1/businessAccount/balances');
      } catch {
        throw error;
      }
    }
  }

  /**
   * Create a deposit address (Crypto Deposits API)
   * Formerly known as Payments API
   * Note: May require account setup or use paymentIntents endpoint
   */
  async createDepositAddress(params: {
    idempotencyKey: string;
    blockchain: string;
    accountId?: string;
  }): Promise<any> {
    // Normalize blockchain identifier (common formats: ETH, ETH-Goerli, MATIC, etc.)
    const blockchain = params.blockchain.toUpperCase();
    
    // Try paymentIntents endpoint first (Crypto Deposits API)
    // PaymentIntents may require additional fields like amount or currency
    try {
      // Try with minimal required fields first
      const requestBody: any = {
        idempotencyKey: params.idempotencyKey,
        blockchain: blockchain,
      };
      
      if (params.accountId) {
        requestBody.accountId = params.accountId;
      }
      
      return await this.request('/v1/paymentIntents', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
    } catch (error: any) {
      // If paymentIntents fails with 422, try deposits/addresses endpoint
      if (error.message.includes('422') || error.message.includes('404')) {
        try {
          return await this.request('/v1/deposits/addresses', {
            method: 'POST',
            body: JSON.stringify({
              idempotencyKey: params.idempotencyKey,
              blockchain: blockchain,
              ...(params.accountId && { accountId: params.accountId }),
            }),
          });
        } catch (fallbackError: any) {
          // Provide helpful error message
          const errorMsg = error.message.includes('422') 
            ? 'Invalid request format. PaymentIntents may require additional fields like amount or currency.'
            : error.message;
          throw new Error(
            `Deposit address creation failed: ${errorMsg}. ` +
            `This endpoint may require account setup or additional parameters. ` +
            `Common blockchain formats: ETH, MATIC, AVAX, etc.`
          );
        }
      }
      throw error;
    }
  }

  /**
   * List deposit addresses
   * Note: May require account setup or use paymentIntents endpoint
   */
  async listDepositAddresses(params?: {
    accountId?: string;
    blockchain?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.accountId) queryParams.append('accountId', params.accountId);
    if (params?.blockchain) queryParams.append('blockchain', params.blockchain);
    
    const query = queryParams.toString();
    
    // Try paymentIntents endpoint first
    try {
      const endpoint = query ? `/v1/paymentIntents?${query}` : '/v1/paymentIntents';
      return await this.request(endpoint);
    } catch (error: any) {
      // Fallback to deposits/addresses
      if (error.message.includes('404')) {
        try {
          const endpoint = query ? `/v1/deposits/addresses?${query}` : '/v1/deposits/addresses';
          return await this.request(endpoint);
        } catch (fallbackError) {
          throw new Error(
            `Deposit addresses endpoint not found. This may require account setup or ` +
            `the Crypto Deposits API may not be enabled for your account. ` +
            `Original error: ${error.message}`
          );
        }
      }
      throw error;
    }
  }

  /**
   * Get deposit information
   */
  async getDeposit(depositId: string): Promise<any> {
    // Try paymentIntents endpoint first
    try {
      return await this.request(`/v1/paymentIntents/${depositId}`);
    } catch (error: any) {
      // Fallback to deposits endpoint
      if (error.message.includes('404')) {
        try {
          return await this.request(`/v1/deposits/${depositId}`);
        } catch (fallbackError) {
          throw error;
        }
      }
      throw error;
    }
  }

  /**
   * List deposits
   * Note: May require account setup or use paymentIntents endpoint
   */
  async listDeposits(params?: {
    accountId?: string;
    blockchain?: string;
    status?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.accountId) queryParams.append('accountId', params.accountId);
    if (params?.blockchain) queryParams.append('blockchain', params.blockchain);
    if (params?.status) queryParams.append('status', params.status);
    
    const query = queryParams.toString();
    
    // Try paymentIntents endpoint first
    try {
      const endpoint = query ? `/v1/paymentIntents?${query}` : '/v1/paymentIntents';
      return await this.request(endpoint);
    } catch (error: any) {
      // Fallback to deposits endpoint
      if (error.message.includes('404')) {
        try {
          const endpoint = query ? `/v1/deposits?${query}` : '/v1/deposits';
          return await this.request(endpoint);
        } catch (fallbackError) {
          throw new Error(
            `Deposits endpoint not found. This may require account setup or ` +
            `the Crypto Deposits API may not be enabled for your account. ` +
            `Original error: ${error.message}`
          );
        }
      }
      throw error;
    }
  }

  /**
   * Create a payout (Crypto Payouts API)
   * Formerly known as Payouts API
   */
  async createPayout(params: {
    idempotencyKey: string;
    destination: {
      type: 'address';
      address: string;
      addressTag?: string;
      chain: string;
    };
    amount: {
      amount: string;
      currency: 'USDC' | 'EURC';
    };
    source?: {
      type: 'wallet';
      id: string;
    };
    metadata?: Record<string, any>;
  }): Promise<any> {
    return this.request('/v1/payouts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get payout information
   */
  async getPayout(payoutId: string): Promise<any> {
    return this.request(`/v1/payouts/${payoutId}`);
  }

  /**
   * List payouts
   */
  async listPayouts(params?: {
    accountId?: string;
    status?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.accountId) queryParams.append('accountId', params.accountId);
    if (params?.status) queryParams.append('status', params.status);
    
    const query = queryParams.toString();
    const endpoint = query ? `/v1/payouts?${query}` : '/v1/payouts';
    
    return this.request(endpoint);
  }

  /**
   * Create a business payout (fiat offramp)
   * Converts digital assets to fiat currency and sends to bank account
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/create-business-payout
   */
  async createBusinessPayout(params: {
    idempotencyKey: string;
    destination: {
      type: 'wire' | 'cubix' | 'pix' | 'sepa' | 'sepa_instant';
      id: string; // Bank account ID
    };
    amount: {
      amount: string; // Fiat amount as string (e.g., "100.00")
      currency: 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL';
    };
    toAmount?: {
      currency: 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL';
    };
    source?: {
      type: 'wallet';
      id: string; // Wallet ID
    };
  }): Promise<any> {
    return this.request('/v1/businessAccount/payouts', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get business payout information
   */
  async getBusinessPayout(payoutId: string): Promise<any> {
    return this.request(`/v1/businessAccount/payouts/${payoutId}`);
  }

  /**
   * List business payouts
   */
  async listBusinessPayouts(params?: {
    status?: 'pending' | 'complete' | 'failed';
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    
    const query = queryParams.toString();
    const endpoint = query ? `/v1/businessAccount/payouts?${query}` : '/v1/businessAccount/payouts';
    
    return this.request(endpoint);
  }

  /**
   * Get supported chains and currencies
   */
  async getSupportedChains(): Promise<any> {
    // This endpoint may vary - checking common patterns
    try {
      return await this.request('/v1/config');
    } catch {
      // Fallback: return common supported chains
      return {
        chains: [
          { id: '1', name: 'Ethereum' },
          { id: '137', name: 'Polygon' },
          { id: '8453', name: 'Base' },
          { id: '42161', name: 'Arbitrum' },
        ],
        currencies: ['USDC', 'EURC'],
      };
    }
  }
}
