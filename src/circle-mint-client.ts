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
   * Create an address book recipient (Crypto Payouts API)
   * Must be created before a payout can be sent to an address.
   * Reference: POST /v1/addressBook/recipients
   */
  async createAddressBookRecipient(params: {
    idempotencyKey: string;
    chain: string;
    address: string;
    addressTag?: string;
    metadata: {
      nickname?: string;
      email?: string;
      bns?: string;
    };
  }): Promise<any> {
    return this.request('/v1/addressBook/recipients', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List address book recipients
   */
  async listAddressBookRecipients(): Promise<any> {
    return this.request('/v1/addressBook/recipients');
  }

  /**
   * Delete an address book recipient
   */
  async deleteAddressBookRecipient(id: string): Promise<any> {
    return this.request(`/v1/addressBook/recipients/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Create a payout (Crypto Payouts API)
   * destination.id must be an address book recipient UUID.
   * Reference: POST /v1/payouts
   */
  async createPayout(params: {
    idempotencyKey: string;
    destination: {
      type: 'address_book';
      id: string; // address book recipient UUID
    };
    amount: {
      amount: string;
      currency: 'USD' | 'EUR';
    };
    source?: {
      type: 'wallet';
      id: string;
    };
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

  /**
   * Create a business wire bank account
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/create-business-wire-account
   */
  async createWireBankAccount(params: {
    idempotencyKey: string;
    accountNumber: string;
    routingNumber: string;
    billingDetails: {
      name: string;
      city: string;
      country: string;
      line1: string;
      line2?: string;
      district?: string;
      postalCode: string;
    };
    bankAddress: {
      bankName: string;
      city: string;
      country: string;
      line1: string;
      line2?: string;
      district?: string;
    };
  }): Promise<any> {
    return this.request('/v1/businessAccount/banks/wires', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List wire bank accounts
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/list-business-wire-accounts
   */
  async listWireBankAccounts(): Promise<any> {
    return this.request('/v1/businessAccount/banks/wires');
  }

  /**
   * Create a mock Wire payment (Sandbox only)
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/create-mock-wire-payment
   */
  async createMockWirePayment(params: {
    trackingRef: string;
    amount: {
      amount: string;
      currency: 'USD';
    };
    beneficiaryBank: {
      accountNumber: string;
    };
  }): Promise<any> {
    return this.request('/v1/mocks/payments/wire', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get wire bank account instructions
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/get-business-wire-account-instructions
   */
  async getWireBankAccountInstructions(id: string): Promise<any> {
    return this.request(`/v1/businessAccount/banks/wires/${id}/instructions`);
  }

  /**
   * Create a business transfer (to verified blockchain recipient)
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/create-business-transfer
   */
  async createBusinessTransfer(params: {
    idempotencyKey: string;
    destination: {
      type: 'verified_blockchain';
      addressId: string;
    };
    amount: {
      amount: string;
      currency: 'USD' | 'EUR' | 'BTC' | 'ETH';
    };
    source?: {
      type: 'wallet';
      id: string;
    };
  }): Promise<any> {
    return this.request('/v1/businessAccount/transfers', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Get a business transfer
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/get-business-transfer
   */
  async getBusinessTransfer(id: string): Promise<any> {
    return this.request(`/v1/businessAccount/transfers/${id}`);
  }

  /**
   * Create a recipient address
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/create-business-recipient-address
   */
  async createRecipientAddress(params: {
    idempotencyKey: string;
    address: string;
    chain: string;
    currency: string;
    description: string;
    addressTag?: string;
  }): Promise<any> {
    return this.request('/v1/businessAccount/wallets/addresses/recipient', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List recipient addresses
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/list-business-recipient-addresses
   */
  async listRecipientAddresses(): Promise<any> {
    return this.request('/v1/businessAccount/wallets/addresses/recipient');
  }

  /**
   * Get a recipient address
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/get-business-recipient-address
   */
  async getRecipientAddress(id: string): Promise<any> {
    return this.request(`/v1/businessAccount/wallets/addresses/recipient/${id}`);
  }

  /**
   * Create a deposit address
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/create-business-deposit-address
   */
  async createDepositAddress(params: {
    idempotencyKey: string;
    currency: string;
    chain: string;
  }): Promise<any> {
    return this.request('/v1/businessAccount/wallets/addresses/deposit', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List business deposit addresses
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/list-business-deposit-addresses
   */
  async listBusinessDepositAddresses(): Promise<any> {
    return this.request('/v1/businessAccount/wallets/addresses/deposit');
  }

  /**
   * Create a mock blockchain payment (Sandbox only)
   * Simulates an on-chain USDC deposit to a deposit address
   * Reference: POST /v1/mocks/payments/blockchain
   */
  async createMockBlockchainDeposit(params: {
    address: string;
    amount: {
      amount: string;
      currency: 'USD' | 'USDC';
    };
    chain: string;
  }): Promise<any> {
    return this.request('/v1/mocks/payments/blockchain', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Create an express route
   * Ties a receipt (deposit) address to a bank account for automatic fiat redemption
   * Reference: POST /v1/businessAccount/expressRoute
   */
  async createExpressRoute(params: {
    idempotencyKey: string;
    receiptAddressId: string; // deposit address ID
    destinationBankAccountId: string; // wire bank account ID
    destinationType: 'wire' | 'sepa' | 'sepa_instant';
    currency: 'USD' | 'EUR';
  }): Promise<any> {
    return this.request('/v1/businessAccount/expressRoute', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ─── Notification Subscriptions ────────────────────────────────────────

  async createSubscription(endpoint: string): Promise<any> {
    return this.request('/v1/notifications/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    });
  }

  async listSubscriptions(): Promise<any> {
    return this.request('/v1/notifications/subscriptions');
  }

  async deleteSubscription(id: string): Promise<any> {
    return this.request(`/v1/notifications/subscriptions/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * List express routes
   */
  async listExpressRoutes(): Promise<any> {
    return this.request('/v1/businessAccount/expressRoute');
  }

  /**
   * Get a specific express route
   */
  async getExpressRoute(id: string): Promise<any> {
    return this.request(`/v1/businessAccount/expressRoute/${id}`);
  }
}
