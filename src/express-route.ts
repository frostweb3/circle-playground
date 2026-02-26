#!/usr/bin/env node

import { CircleMintClient } from './circle-mint-client.js';
import { config } from './config.js';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

/**
 * Express Route Flow
 *
 * An express route automatically redeems on-chain USDC to local fiat currency
 * and delivers it to a linked bank account. The full setup flow is:
 *
 * 1. Link bank account      — register the fiat destination
 * 2. Link receipt address   — create the on-chain deposit address
 * 3. Mock deposit           — simulate a wire deposit (sandbox)
 * 4. On-chain deposit       — simulate an on-chain USDC deposit (sandbox)
 * 5. On-chain transfer      — send USDC to a verified recipient address
 * 6. Withdrawal             — convert USDC to fiat and wire to bank
 * 7. Create express route   — bind receipt address to bank for auto-redemption
 */
export class ExpressRouteTester {
  private client: CircleMintClient;

  constructor() {
    this.client = new CircleMintClient();
  }

  // ─── Step 1: Link Bank Account ───────────────────────────────────────────

  async linkBankAccount(params?: {
    accountNumber?: string;
    routingNumber?: string;
  }): Promise<any> {
    const idempotencyKey = crypto.randomUUID();
    const body = {
      idempotencyKey,
      accountNumber: params?.accountNumber ?? '12340010',
      routingNumber: params?.routingNumber ?? '121000248',
      billingDetails: {
        name: 'Satoshi Nakamoto',
        city: 'Boston',
        country: 'US',
        line1: '100 Money Street',
        postalCode: '01234',
        line2: 'Suite 1',
        district: 'MA',
      },
      bankAddress: {
        country: 'US',
        bankName: 'SAN FRANCISCO',
        city: 'SAN FRANCISCO',
        line1: '100 Money Street',
        line2: 'Suite 1',
        district: 'CA',
      },
    };

    try {
      const account = await this.client.createWireBankAccount(body);
      return account;
    } catch (error: any) {
      if (error.message?.includes('already') || error.message?.includes('2023') || error.message?.includes('400')) {
        const existing = await this.client.listWireBankAccounts();
        const first = existing.data?.[0];
        if (first) {
          return { data: first };
        }
      }
      throw error;
    }
  }

  // ─── Step 2: Link Receipt Address ────────────────────────────────────────

  async linkReceiptAddress(params: {
    chain?: string;
    currency?: string;
  } = {}): Promise<any> {
    const chain = params.chain ?? 'ETH';
    const currency = params.currency ?? 'USD';

    const idempotencyKey = crypto.randomUUID();
    try {
      const address = await this.client.createDepositAddress({
        idempotencyKey,
        chain,
        currency,
      });

      return address;
    } catch (error: any) {
      if (error.message?.includes('2023') || error.message?.includes('already')) {
        const existing = await this.client.listBusinessDepositAddresses();
        const match = existing.data?.find((a: any) => a.chain === chain);
        if (match) {
          return { data: match };
        }
        const first = existing.data?.[0];
        if (first) {
          return { data: first };
        }
      }
      throw error;
    }
  }

  // ─── Step 3: Mock Deposit (sandbox wire) ─────────────────────────────────

  async initiateMockDeposit(params: {
    trackingRef: string;
    amount?: string;
    accountNumber?: string;
  }): Promise<any> {
    try {
      const payment = await this.client.createMockWirePayment({
        trackingRef: params.trackingRef,
        amount: {
          amount: params.amount ?? '100.00',
          currency: 'USD',
        },
        beneficiaryBank: {
          accountNumber: params.accountNumber ?? '12340010',
        },
      });

      return payment;
    } catch (error: any) {
      if (error.message?.includes('already') || error.message?.includes('2023')) {
        return null;
      }
      throw error;
    }
  }

  // ─── Step 4: On-Chain Deposit (mock blockchain payment) ──────────────────

  async initiateOnChainDeposit(params: {
    address: string;
    chain?: string;
    amount?: string;
  }): Promise<any> {
    try {
      const deposit = await this.client.createMockBlockchainDeposit({
        address: params.address,
        amount: {
          amount: params.amount ?? '10.00',
          currency: 'USD',
        },
        chain: params.chain ?? 'ETH',
      });

      return deposit;
    } catch {
      return null;
    }
  }

  // ─── Step 5: On-Chain Transfer ───────────────────────────────────────────

  async initiateOnChainTransfer(params: {
    recipientId: string;
    amount?: string;
    currency?: 'USD' | 'EUR' | 'BTC' | 'ETH';
  }): Promise<any> {
    const idempotencyKey = crypto.randomUUID();
    const transfer = await this.client.createBusinessTransfer({
      idempotencyKey,
      destination: {
        type: 'verified_blockchain',
        addressId: params.recipientId,
      },
      amount: {
        amount: params.amount ?? '1.00',
        currency: params.currency ?? 'USD',
      },
    });

    return transfer;
  }

  // ─── Step 6: Withdrawal (fiat offramp) ───────────────────────────────────

  async initiateWithdrawal(params: {
    bankAccountId: string;
    amount?: string;
    currency?: 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL';
    destinationType?: 'wire' | 'cubix' | 'pix' | 'sepa' | 'sepa_instant';
  }): Promise<any> {
    const idempotencyKey = crypto.randomUUID();
    const payout = await this.client.createBusinessPayout({
      idempotencyKey,
      destination: {
        type: params.destinationType ?? 'wire',
        id: params.bankAccountId,
      },
      amount: {
        amount: params.amount ?? '10.00',
        currency: params.currency ?? 'USD',
      },
    });

    return payout;
  }

  // ─── Step 7: Create Express Route ────────────────────────────────────────

  async createExpressRoute(params: {
    receiptAddressId: string;
    bankAccountId: string;
    destinationType?: 'wire' | 'sepa' | 'sepa_instant';
    currency?: 'USD' | 'EUR';
  }): Promise<any> {
    const idempotencyKey = crypto.randomUUID();
    try {
      const route = await this.client.createExpressRoute({
        idempotencyKey,
        receiptAddressId: params.receiptAddressId,
        destinationBankAccountId: params.bankAccountId,
        destinationType: params.destinationType ?? 'wire',
        currency: params.currency ?? 'USD',
      });

      return route;
    } catch (error: any) {
      if (error.message?.includes('already') || error.message?.includes('2023')) {
        try {
          const existing = await this.client.listExpressRoutes();
          const match = existing.data?.find(
            (r: any) => r.receiptAddressId === params.receiptAddressId
          ) ?? existing.data?.[0];
          if (match) {
            return { data: match };
          }
        } catch {
          // list also unsupported — fall through to warning
        }
      }
      return null;
    }
  }

  // ─── Full Flow ────────────────────────────────────────────────────────────

  async runFullFlow(params?: {
    chain?: string;
    amount?: string;
    existingBankId?: string;
    existingDepositAddressId?: string;
    existingDepositAddress?: string;
    existingRecipientId?: string;
  }): Promise<void> {
    let bankAccountId = params?.existingBankId;
    let depositAddressId = params?.existingDepositAddressId;
    let depositAddress = params?.existingDepositAddress;
    const chain = params?.chain ?? 'ETH';

    // Step 1: Link bank account
    if (!bankAccountId) {
      const bank = await this.linkBankAccount();
      bankAccountId = bank.data?.id;
      if (!bankAccountId) throw new Error('Failed to obtain bank account ID');
    }

    // Step 2: Link receipt address
    if (!depositAddressId || !depositAddress) {
      const addr = await this.linkReceiptAddress({ chain });
      depositAddressId = addr.data?.id;
      depositAddress = addr.data?.address;
      if (!depositAddress) throw new Error('Failed to obtain deposit address');
    }

    // Step 3: Mock wire deposit
    const instructions = await this.client.getWireBankAccountInstructions(bankAccountId!);
    const beneficiaryAccountNumber = instructions.data?.beneficiaryBank?.accountNumber;
    const trackingRef = instructions.data?.trackingRef;

    if (!trackingRef) {
      throw new Error('Could not retrieve tracking ref from wire instructions');
    }
    if (!beneficiaryAccountNumber) {
      throw new Error('Could not retrieve beneficiary account number from wire instructions');
    }

    await this.initiateMockDeposit({
      trackingRef,
      amount: params?.amount ?? '100.00',
      accountNumber: beneficiaryAccountNumber,
    });

    // Step 4: On-chain deposit
    await this.initiateOnChainDeposit({
      address: depositAddress!,
      chain,
      amount: params?.amount ?? '10.00',
    });

    // Step 5: On-chain transfer (requires a verified recipient)
    const recipientId = params?.existingRecipientId;
    if (recipientId) {
      await this.initiateOnChainTransfer({ recipientId, amount: '1.00' });
    }

    // Step 6: Withdrawal
    await this.initiateWithdrawal({
      bankAccountId: bankAccountId!,
      amount: '10.00',
    });

    // Step 7: Create express route
    await this.createExpressRoute({
      receiptAddressId: depositAddressId!,
      bankAccountId: bankAccountId!,
    });
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────────

async function main() {
  if (!config.apiKey) {
    process.stderr.write('Error: CIRCLE_API_KEY is not set!\n');
    process.exit(1);
  }

  const tester = new ExpressRouteTester();
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'link-bank':
        await tester.linkBankAccount({
          accountNumber: args[1],
          routingNumber: args[2],
        });
        break;

      case 'link-receipt':
        await tester.linkReceiptAddress({
          chain: args[1] ?? 'ETH',
          currency: args[2] ?? 'USD',
        });
        break;

      case 'mock-deposit':
        if (!args[1]) {
          process.stderr.write('Usage: express-route mock-deposit <trackingRef> [amount] [accountNumber]\n');
          process.exit(1);
        }
        await tester.initiateMockDeposit({
          trackingRef: args[1],
          amount: args[2],
          accountNumber: args[3],
        });
        break;

      case 'onchain-deposit':
        if (!args[1]) {
          process.stderr.write('Usage: express-route onchain-deposit <address> [chain] [amount]\n');
          process.exit(1);
        }
        await tester.initiateOnChainDeposit({
          address: args[1],
          chain: args[2],
          amount: args[3],
        });
        break;

      case 'transfer':
        if (!args[1]) {
          process.stderr.write('Usage: express-route transfer <recipient-id> [amount] [currency]\n');
          process.exit(1);
        }
        await tester.initiateOnChainTransfer({
          recipientId: args[1],
          amount: args[2],
          currency: (args[3] as 'USD' | 'EUR' | 'BTC' | 'ETH') ?? 'USD',
        });
        break;

      case 'withdraw':
        if (!args[1]) {
          process.stderr.write('Usage: express-route withdraw <bank-account-id> [amount] [currency]\n');
          process.exit(1);
        }
        await tester.initiateWithdrawal({
          bankAccountId: args[1],
          amount: args[2],
          currency: (args[3] as 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL') ?? 'USD',
        });
        break;

      case 'create':
        if (!args[1] || !args[2]) {
          process.stderr.write('Usage: express-route create <receipt-address-id> <bank-account-id>\n');
          process.exit(1);
        }
        await tester.createExpressRoute({
          receiptAddressId: args[1],
          bankAccountId: args[2],
          destinationType: (args[3] as 'wire' | 'sepa' | 'sepa_instant') ?? 'wire',
          currency: (args[4] as 'USD' | 'EUR') ?? 'USD',
        });
        break;

      case 'run':
        await tester.runFullFlow({
          chain: args[1],
          amount: args[2],
          existingBankId: args[3],
          existingDepositAddressId: args[4],
          existingDepositAddress: args[5],
          existingRecipientId: args[6],
        });
        break;

      default:
        process.stdout.write([
          'Available Commands:',
          '  link-bank [accNum] [routNum]               - Step 1: Link a wire bank account',
          '  link-receipt [chain] [currency]            - Step 2: Create on-chain receipt address',
          '  mock-deposit <trackRef> [amt] [accNum]     - Step 3: Simulate a wire deposit (sandbox)',
          '  onchain-deposit <address> [chain] [amt]    - Step 4: Simulate an on-chain deposit (sandbox)',
          '  transfer <recipient-id> [amt] [currency]   - Step 5: Send on-chain transfer',
          '  withdraw <bank-id> [amt] [currency]        - Step 6: Withdraw to bank (fiat)',
          '  create <receipt-addr-id> <bank-id>         - Step 7: Create express route',
          '  run [chain] [amount] [bankId] [addrId] [addr] [recipId]',
          '                                             - Run the full flow end-to-end',
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
