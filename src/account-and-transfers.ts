#!/usr/bin/env node

import { CircleMintClient } from './circle-mint-client.js';
import { config } from './config.js';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

/**
 * Account and Transfer Testing Script
 * Creates deposit addresses and performs test transfers
 */

interface TransferParams {
  recipientAddress: string; // Raw blockchain address — will be auto-added to address book
  chain: string;
  amount: string;
  currency?: 'USD' | 'EUR';
}

export class AccountAndTransferTester {
  private client: CircleMintClient;

  constructor() {
    this.client = new CircleMintClient();
  }

  /**
   * Check account balance before transfer
   */
  async checkBalance(): Promise<any> {
    const balance = await this.client.getBalance();

    if (balance.data?.available) {
      balance.data.available.reduce((sum: number, bal: any) => {
        return sum + (parseInt(bal.amount || '0', 10));
      }, 0);
    }

    return balance;
  }

  /**
   * Create a test transfer (payout)
   */
  async createTransfer(params: TransferParams): Promise<any> {
    // First check balance
    await this.checkBalance();

    // Validate amount format (Major units string, e.g. "1.00")
    if (!params.amount.match(/^\d+(\.\d+)?$/)) {
      throw new Error('Invalid amount format. Must be a string representing major units (e.g. "1.00").');
    }

    // The Crypto Payouts API requires an address book entry — create one first
    const abEntry = await this.client.createAddressBookRecipient({
      idempotencyKey: `ab-${Date.now()}`,
      chain: params.chain,
      address: params.recipientAddress,
      metadata: { nickname: `Transfer target ${params.chain}` },
    });
    const recipientId = abEntry.data?.id;
    if (!recipientId) throw new Error('Failed to add address to address book');

    // Create payout using the address book recipient ID
    const idempotencyKey = `transfer-${Date.now()}`;
    const payout = await this.client.createPayout({
      idempotencyKey,
      destination: {
        type: 'address_book',
        id: recipientId,
      },
      amount: {
        amount: parseFloat(params.amount).toFixed(2),
        currency: params.currency || 'USD',
      },
    });

    return payout;
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(payoutId: string): Promise<any> {
    const payout = await this.client.getPayout(payoutId);
    return payout;
  }

  /**
   * Create a business payout (fiat offramp)
   * Converts digital assets to fiat and sends to bank account
   * Reference: https://developers.circle.com/api-reference/circle-mint/account/create-business-payout
   */
  async createBusinessPayout(params: {
    destinationType: 'wire' | 'cubix' | 'pix' | 'sepa' | 'sepa_instant';
    destinationId: string; // Bank account ID
    amount: string; // Fiat amount (e.g., "100.00")
    currency: 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL';
    walletId?: string; // Optional source wallet ID
  }): Promise<any> {
    const idempotencyKey = `business-payout-${Date.now()}`;
    const payout = await this.client.createBusinessPayout({
      idempotencyKey,
      destination: {
        type: params.destinationType,
        id: params.destinationId,
      },
      amount: {
        amount: params.amount,
        currency: params.currency,
      },
      ...(params.walletId && {
        source: {
          type: 'wallet',
          id: params.walletId,
        },
      }),
    });

    return payout;
  }

  /**
   * List business payouts
   */
  async listBusinessPayouts(status?: 'pending' | 'complete' | 'failed'): Promise<any> {
    const payouts = await this.client.listBusinessPayouts(status ? { status } : undefined);
    return payouts;
  }

  /**
   * Get business payout status
   */
  async getBusinessPayoutStatus(payoutId: string): Promise<any> {
    const payout = await this.client.getBusinessPayout(payoutId);
    return payout;
  }

  /**
   * Run a complete test flow: create deposit address and attempt transfer
   */
  async runTestFlow(params?: {
    blockchain?: string;
    testTransfer?: TransferParams;
    autoTest?: boolean;
  }): Promise<void> {
    // Step 1: Check balance
    await this.checkBalance();

    // Step 2: Get or Create deposit address
    const blockchain = params?.blockchain || 'ETH';
    let depositAddress;

    try {
      const existingAddresses = await this.client.listBusinessDepositAddresses();

      if (existingAddresses.data && existingAddresses.data.length > 0) {
        const matchedAddress = existingAddresses.data.find((addr: any) => addr.chain === blockchain);

        if (matchedAddress) {
          depositAddress = { data: matchedAddress };
        }
      }

      if (!depositAddress) {
        depositAddress = await this.createDepositAddress({ chain: blockchain, currency: 'USD' });
      }
    } catch (error: any) {
      throw error;
    }

    // Step 3: Attempt test transfer if params provided or autoTest is true
    if (params?.testTransfer || (params?.autoTest && depositAddress.data?.address)) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      let transferParams = params?.testTransfer;

      if (!transferParams && params?.autoTest && depositAddress.data?.address) {
        let recipientId;

        try {
          // Check if recipient already exists for this address
          const recipients = await this.client.listRecipientAddresses();
          const existingRecipient = recipients.data?.find((r: any) =>
            r.address === depositAddress.data.address && r.chain === blockchain
          );

          if (existingRecipient) {
            recipientId = existingRecipient.id;
          } else {
            const newRecipient = await this.createRecipientAddress({
              chain: blockchain,
              address: depositAddress.data.address,
              description: `Auto-created for ${depositAddress.data.address}`,
            });
            recipientId = newRecipient.data?.id;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          if (recipientId) {
            const transfer = await this.createBusinessTransfer({
              recipientId,
              amount: '1.00',
              currency: 'USD'
            });

            if (transfer.data?.id) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              await this.getBusinessTransferStatus(transfer.data.id);
            }
          }

        } catch {
          // Auto-transfer may fail if recipient not verified or low balance
        }
      } else if (transferParams) {
        try {
          const transfer = await this.createTransfer(transferParams);
          if (transfer.data?.id) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.getTransferStatus(transfer.data.id);
          }
        } catch {
          // Transfer failed
        }
      }
    }
  }

  /**
   * Create a wire bank account
   */
  async createWireBankAccount(): Promise<any> {
    const idempotencyKey = crypto.randomUUID();

    const params = {
      idempotencyKey,
      accountNumber: "12340010",
      routingNumber: "121000248",
      billingDetails: {
        name: "Satoshi Nakamoto",
        city: "Boston",
        country: "US",
        line1: "100 Money Street",
        postalCode: "01234",
        line2: "Suite 1",
        district: "MA"
      },
      bankAddress: {
        country: "US",
        bankName: "SAN FRANCISCO",
        city: "SAN FRANCISCO",
        line1: "100 Money Street",
        line2: "Suite 1",
        district: "CA"
      }
    };

    const account = await this.client.createWireBankAccount(params);
    return account;
  }

  /**
   * List wire bank accounts
   */
  async listWireBankAccounts(): Promise<any> {
    const accounts = await this.client.listWireBankAccounts();
    return accounts;
  }

  /**
   * Create a mock wire payment
   */
  async createMockWirePayment(params: {
    trackingRef: string;
    amount: string;
    accountNumber: string;
  }): Promise<any> {
    const payment = await this.client.createMockWirePayment({
      trackingRef: params.trackingRef,
      amount: {
        amount: params.amount,
        currency: 'USD',
      },
      beneficiaryBank: {
        accountNumber: params.accountNumber,
      },
    });

    return payment;
  }

  /**
   * Get wire bank account instructions
   */
  async getWireBankAccountInstructions(id: string): Promise<any> {
    const instructions = await this.client.getWireBankAccountInstructions(id);
    return instructions;
  }

  /**
   * Create a business transfer (to verified recipient)
   */
  async createBusinessTransfer(params: {
    recipientId: string;
    amount: string;
    currency: 'USD' | 'EUR' | 'BTC' | 'ETH';
    sourceWalletId?: string;
  }): Promise<any> {
    const idempotencyKey = crypto.randomUUID();
    const transfer = await this.client.createBusinessTransfer({
      idempotencyKey,
      destination: {
        type: 'verified_blockchain',
        addressId: params.recipientId,
      },
      amount: {
        amount: params.amount,
        currency: params.currency,
      },
      ...(params.sourceWalletId && {
        source: {
          type: 'wallet',
          id: params.sourceWalletId,
        },
      }),
    });

    return transfer;
  }

  /**
   * Get business transfer status
   */
  async getBusinessTransferStatus(transferId: string): Promise<any> {
    const transfer = await this.client.getBusinessTransfer(transferId);
    return transfer;
  }

  /**
   * Create a recipient address
   */
  async createRecipientAddress(params: {
    chain: string;
    address: string;
    description: string;
    addressTag?: string;
  }): Promise<any> {
    const idempotencyKey = crypto.randomUUID();
    const recipient = await this.client.createRecipientAddress({
      idempotencyKey,
      chain: params.chain,
      address: params.address,
      currency: 'USD',
      description: params.description,
      addressTag: params.addressTag,
    });

    return recipient;
  }

  /**
   * List recipient addresses
   */
  async listRecipientAddresses(): Promise<any> {
    const recipients = await this.client.listRecipientAddresses();
    return recipients;
  }

  /**
   * Get a recipient address
   */
  async getRecipientAddress(id: string): Promise<any> {
    const recipient = await this.client.getRecipientAddress(id);
    return recipient;
  }

  /**
   * Create a deposit address
   */
  async createDepositAddress(params: {
    chain: string;
    currency: string;
  }): Promise<any> {
    const idempotencyKey = crypto.randomUUID();
    const address = await this.client.createDepositAddress({
      idempotencyKey,
      chain: params.chain,
      currency: params.currency,
    });

    return address;
  }
}

// CLI Interface
async function main() {
  if (!config.apiKey) {
    process.stderr.write('Error: CIRCLE_API_KEY is not set!\n');
    process.exit(1);
  }

  const tester = new AccountAndTransferTester();
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'balance':
        await tester.checkBalance();
        break;

      case 'deposit-address':
        const blockchain = args[1] || 'ETH';
        await tester.createDepositAddress({ chain: blockchain, currency: 'USD' });
        break;

      case 'transfer':
        const address = args[1];
        const chain = args[2];
        const amount = args[3];
        const tCurrency = (args[4] as 'USD' | 'EUR') || 'USD';

        if (!address || !chain || !amount) {
          process.stderr.write('Usage: transfer <address> <chain> <amount> [currency]\n');
          process.exit(1);
        }

        await tester.createTransfer({ recipientAddress: address, chain, amount, currency: tCurrency });
        break;

      case 'status':
        const payoutId = args[1];
        if (!payoutId) {
          process.stderr.write('Usage: status <payout-id>\n');
          process.exit(1);
        }
        await tester.getTransferStatus(payoutId);
        break;

      case 'business-payout':
        const destType = args[1] as 'wire' | 'cubix' | 'pix' | 'sepa' | 'sepa_instant';
        const bankAccountId = args[2];
        const fiatAmount = args[3];
        const fiatCurrency = (args[4] as 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL') || 'USD';
        const walletId = args[5];

        if (!destType || !bankAccountId || !fiatAmount) {
          process.stderr.write('Usage: business-payout <type> <bank-account-id> <amount> <currency> [wallet-id]\n');
          process.exit(1);
        }

        await tester.createBusinessPayout({
          destinationType: destType,
          destinationId: bankAccountId,
          amount: fiatAmount,
          currency: fiatCurrency,
          walletId,
        });
        break;

      case 'business-payouts':
        const statusFilter = args[1] as 'pending' | 'complete' | 'failed' | undefined;
        await tester.listBusinessPayouts(statusFilter);
        break;

      case 'business-status':
        const businessPayoutId = args[1];
        if (!businessPayoutId) {
          process.stderr.write('Usage: business-status <payout-id>\n');
          process.exit(1);
        }
        await tester.getBusinessPayoutStatus(businessPayoutId);
        break;

      case 'test':
        const testBlockchain = args[1] || 'ETH';
        const testAddress = args[2];
        const testChain = args[3];
        const testAmount = args[4];

        await tester.runTestFlow({
          blockchain: testBlockchain,
          testTransfer: testAddress && testChain && testAmount
            ? {
              recipientAddress: testAddress,
              chain: testChain,
              amount: testAmount,
              currency: (args[5] as 'USD' | 'EUR') || 'USD',
            }
            : undefined,
        });
        break;

      case 'create-wire-account':
        await tester.createWireBankAccount();
        break;

      case 'list-wire-accounts':
        await tester.listWireBankAccounts();
        break;

      case 'mock-wire':
        const trackingRef = args[1];
        const mockAmount = args[2];
        const accountNumber = args[3];

        if (!trackingRef || !mockAmount || !accountNumber) {
          process.stderr.write('Usage: mock-wire <trackingRef> <amount> <accountNumber>\n');
          process.exit(1);
        }

        await tester.createMockWirePayment({
          trackingRef,
          amount: mockAmount,
          accountNumber,
        });
        break;

      case 'get-wire-instructions':
        const instructionId = args[1];
        if (!instructionId) {
          process.stderr.write('Usage: get-wire-instructions <account-id>\n');
          process.exit(1);
        }
        await tester.getWireBankAccountInstructions(instructionId);
        break;

      case 'business-transfer':
        const recipientId = args[1];
        const amountTrsf = args[2];
        const currencyTrsf = (args[3] as 'USD' | 'EUR' | 'BTC' | 'ETH') || 'USD';

        if (!recipientId || !amountTrsf) {
          process.stderr.write('Usage: business-transfer <recipient-id> <amount> [currency]\n');
          process.exit(1);
        }

        await tester.createBusinessTransfer({
          recipientId,
          amount: amountTrsf,
          currency: currencyTrsf,
        });
        break;

      case 'create-recipient':
        const rChain = args[1];
        const rAddress = args[2];
        const rDesc = args[3];
        const rTag = args[4];

        if (!rChain || !rAddress || !rDesc) {
          process.stderr.write('Usage: create-recipient <chain> <address> <description> [tag]\n');
          process.exit(1);
        }

        await tester.createRecipientAddress({
          chain: rChain,
          address: rAddress,
          description: rDesc,
          addressTag: rTag,
        });
        break;

      case 'list-recipients':
        await tester.listRecipientAddresses();
        break;

      case 'get-recipient':
        const rId = args[1];
        if (!rId) {
          process.stderr.write('Usage: get-recipient <recipient-id>\n');
          process.exit(1);
        }
        await tester.getRecipientAddress(rId);
        break;

      case 'create-deposit-address':
        const dChain = args[1];
        const dCurrency = args[2] || 'USD';

        if (!dChain) {
          process.stderr.write('Usage: create-deposit-address <chain> <currency>\n');
          process.exit(1);
        }

        await tester.createDepositAddress({
          chain: dChain,
          currency: dCurrency,
        });
        break;

      default:
        process.stdout.write([
          'Available Commands:',
          '  balance                    - Check account balance',
          '  deposit-address [chain]    - Create deposit address (default: ETH)',
          '  transfer <addr> <chain> <amount> [currency] - Create transfer',
          '  status <payout-id>         - Check transfer status',
          '  business-payout <type> <bank-id> <amount> <currency> [wallet-id]',
          '  business-payouts [status]  - List business payouts',
          '  business-status <payout-id>',
          '  create-wire-account        - Create a wire bank account',
          '  list-wire-accounts         - List wire bank accounts',
          '  get-wire-instructions <id>',
          '  mock-wire <ref> <amt> <acc>',
          '  create-recipient <chain> <addr> <desc> [tag]',
          '  list-recipients',
          '  get-recipient <id>',
          '  create-deposit-address <chain> [curr]',
          '  business-transfer <rec-id> <amt> [curr]',
          '  test [chain] [addr] [chain] [amount] [currency]',
          '',
        ].join('\n'));
    }
  } catch (error: any) {
    process.stderr.write(`Fatal error: ${error.message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
