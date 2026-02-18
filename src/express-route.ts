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
    console.log('\n[Step 1] Linking Bank Account...');
    console.log('─'.repeat(50));

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

    console.log('Using test bank data (sandbox)');
    try {
      const account = await this.client.createWireBankAccount(body);
      console.log('Bank account linked:');
      console.log(JSON.stringify(account, null, 2));

      if (account.data?.id) {
        console.log(`\nBank Account ID: ${account.data.id}`);
        console.log(`Status:          ${account.data.status}`);
        console.log(`Tracking Ref:    ${account.data.trackingRef}`);
      }

      return account;
    } catch (error: any) {
      if (error.message?.includes('already') || error.message?.includes('2023') || error.message?.includes('400')) {
        console.log('Bank account already exists — fetching existing accounts...');
        const existing = await this.client.listWireBankAccounts();
        const first = existing.data?.[0];
        if (first) {
          console.log(`Reusing bank account: ${first.id} (${first.status})`);
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
    console.log('\n[Step 2] Linking Receipt Address (on-chain deposit address)...');
    console.log('─'.repeat(50));

    const chain = params.chain ?? 'ETH';
    const currency = params.currency ?? 'USD';

    const idempotencyKey = crypto.randomUUID();
    try {
      const address = await this.client.createDepositAddress({
        idempotencyKey,
        chain,
        currency,
      });

      console.log('Receipt address created:');
      console.log(JSON.stringify(address, null, 2));

      if (address.data) {
        console.log(`\nAddress: ${address.data.address}`);
        console.log(`Chain:   ${address.data.chain}`);
      }

      return address;
    } catch (error: any) {
      if (error.message?.includes('2023') || error.message?.includes('already')) {
        console.log(`Deposit address for ${chain} already exists — fetching existing addresses...`);
        const existing = await this.client.listBusinessDepositAddresses();
        const match = existing.data?.find((a: any) => a.chain === chain);
        if (match) {
          console.log(`Reusing deposit address: ${match.address} (${match.chain})`);
          return { data: match };
        }
        // No chain match — return first available
        const first = existing.data?.[0];
        if (first) {
          console.log(`No ${chain} address found — reusing: ${first.address} (${first.chain})`);
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
    console.log('\n[Step 3] Initiating Mock Wire Deposit (sandbox only)...');
    console.log('─'.repeat(50));
    console.log(`Tracking Ref:   ${params.trackingRef}`);
    console.log(`Amount:         ${params.amount ?? '100.00'} USD`);

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

      console.log('\nMock wire deposit created:');
      console.log(JSON.stringify(payment, null, 2));

      return payment;
    } catch (error: any) {
      if (error.message?.includes('already') || error.message?.includes('2023')) {
        console.log('Mock deposit already processed for this tracking ref — skipping.');
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
    console.log('\n[Step 4] Initiating On-Chain Deposit (sandbox mock)...');
    console.log('─'.repeat(50));
    console.log(`Deposit Address: ${params.address}`);
    console.log(`Chain:           ${params.chain ?? 'ETH'}`);
    console.log(`Amount:          ${params.amount ?? '10.00'} USDC`);

    try {
      const deposit = await this.client.createMockBlockchainDeposit({
        address: params.address,
        amount: {
          amount: params.amount ?? '10.00',
          currency: 'USD',
        },
        chain: params.chain ?? 'ETH',
      });

      console.log('\nOn-chain deposit simulated:');
      console.log(JSON.stringify(deposit, null, 2));

      return deposit;
    } catch (error: any) {
      console.warn('\nNote: Mock blockchain deposit endpoint returned an error.');
      console.warn('In production, this step is performed by the external sender.');
      console.warn(`Details: ${error.message}`);
      return null;
    }
  }

  // ─── Step 5: On-Chain Transfer ───────────────────────────────────────────

  async initiateOnChainTransfer(params: {
    recipientId: string;
    amount?: string;
    currency?: 'USD' | 'EUR' | 'BTC' | 'ETH';
  }): Promise<any> {
    console.log('\n[Step 5] Initiating On-Chain Transfer...');
    console.log('─'.repeat(50));
    console.log(`Recipient ID: ${params.recipientId}`);
    console.log(`Amount:       ${params.amount ?? '1.00'} ${params.currency ?? 'USD'}`);

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

    console.log('\nOn-chain transfer created:');
    console.log(JSON.stringify(transfer, null, 2));

    if (transfer.data?.id) {
      console.log(`\nTransfer ID: ${transfer.data.id}`);
      console.log(`Status:      ${transfer.data.status}`);
    }

    return transfer;
  }

  // ─── Step 6: Withdrawal (fiat offramp) ───────────────────────────────────

  async initiateWithdrawal(params: {
    bankAccountId: string;
    amount?: string;
    currency?: 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL';
    destinationType?: 'wire' | 'cubix' | 'pix' | 'sepa' | 'sepa_instant';
  }): Promise<any> {
    console.log('\n[Step 6] Initiating Withdrawal to Bank...');
    console.log('─'.repeat(50));
    console.log(`Bank Account ID: ${params.bankAccountId}`);
    console.log(`Amount:          ${params.amount ?? '10.00'} ${params.currency ?? 'USD'}`);
    console.log(`Type:            ${params.destinationType ?? 'wire'}`);

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

    console.log('\nWithdrawal created:');
    console.log(JSON.stringify(payout, null, 2));

    if (payout.data?.id) {
      console.log(`\nPayout ID:    ${payout.data.id}`);
      console.log(`Status:       ${payout.data.status ?? 'pending'}`);
      if (payout.data.trackingRef) {
        console.log(`Tracking Ref: ${payout.data.trackingRef}`);
      }
    }

    return payout;
  }

  // ─── Step 7: Create Express Route ────────────────────────────────────────

  async createExpressRoute(params: {
    receiptAddressId: string;
    bankAccountId: string;
    destinationType?: 'wire' | 'sepa' | 'sepa_instant';
    currency?: 'USD' | 'EUR';
  }): Promise<any> {
    console.log('\n[Step 7] Creating Express Route...');
    console.log('─'.repeat(50));
    console.log(`Receipt Address ID: ${params.receiptAddressId}`);
    console.log(`Bank Account ID:    ${params.bankAccountId}`);
    console.log(`Type:               ${params.destinationType ?? 'wire'}`);
    console.log(`Currency:           ${params.currency ?? 'USD'}`);
    console.log('\nThis binds the on-chain receipt address to the bank account,');
    console.log('enabling automatic fiat redemption on every on-chain deposit.');

    const idempotencyKey = crypto.randomUUID();
    try {
      const route = await this.client.createExpressRoute({
        idempotencyKey,
        receiptAddressId: params.receiptAddressId,
        destinationBankAccountId: params.bankAccountId,
        destinationType: params.destinationType ?? 'wire',
        currency: params.currency ?? 'USD',
      });

      console.log('\nExpress route created:');
      console.log(JSON.stringify(route, null, 2));

      return route;
    } catch (error: any) {
      if (error.message?.includes('already') || error.message?.includes('2023')) {
        console.log('Express route already exists — fetching existing routes...');
        try {
          const existing = await this.client.listExpressRoutes();
          const match = existing.data?.find(
            (r: any) => r.receiptAddressId === params.receiptAddressId
          ) ?? existing.data?.[0];
          if (match) {
            console.log(`Reusing express route: ${match.id}`);
            return { data: match };
          }
        } catch {
          // list also unsupported — fall through to warning
        }
      }
      console.warn('\nNote: Express route creation returned an error.');
      console.warn('This may require additional account permissions or a different endpoint.');
      console.warn(`Details: ${error.message}`);
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
    console.log('\nExpress Route Setup Flow');
    console.log('═'.repeat(50));
    console.log('Automatically redeeming on-chain USDC to local fiat currency.\n');

    let bankAccountId = params?.existingBankId;
    let depositAddressId = params?.existingDepositAddressId;
    let depositAddress = params?.existingDepositAddress;
    const chain = params?.chain ?? 'ETH';

    // Step 1: Link bank account
    if (!bankAccountId) {
      const bank = await this.linkBankAccount();
      bankAccountId = bank.data?.id;
      if (!bankAccountId) throw new Error('Failed to obtain bank account ID');
    } else {
      console.log(`\n[Step 1] Using existing bank account: ${bankAccountId}`);
    }

    // Step 2: Link receipt address
    if (!depositAddressId || !depositAddress) {
      const addr = await this.linkReceiptAddress({ chain });
      depositAddressId = addr.data?.id;
      depositAddress = addr.data?.address;
      if (!depositAddress) throw new Error('Failed to obtain deposit address');
    } else {
      console.log(`\n[Step 2] Using existing receipt address: ${depositAddress}`);
    }

    // Step 3: Mock wire deposit
    // Wire instructions give us Circle's beneficiary account number — required by the mock endpoint
    console.log('\n[Step 3 prep] Fetching wire instructions to get beneficiary account number...');
    const instructions = await this.client.getWireBankAccountInstructions(bankAccountId!);
    const beneficiaryAccountNumber = instructions.data?.beneficiaryBank?.accountNumber;
    const trackingRef = instructions.data?.trackingRef;

    if (!trackingRef) {
      throw new Error('Could not retrieve tracking ref from wire instructions');
    }
    if (!beneficiaryAccountNumber) {
      throw new Error('Could not retrieve beneficiary account number from wire instructions');
    }

    console.log(`  Tracking Ref:              ${trackingRef}`);
    console.log(`  Beneficiary Account Number: ${beneficiaryAccountNumber}`);

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
    let recipientId = params?.existingRecipientId;
    if (recipientId) {
      await this.initiateOnChainTransfer({ recipientId, amount: '1.00' });
    } else {
      console.log('\n[Step 5] Skipping on-chain transfer — no verified recipient ID provided.');
      console.log('         Use: express-route transfer <recipient-id> [amount]');
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

    console.log('\n═'.repeat(50));
    console.log('Express route setup complete.');
    console.log(`  Bank Account ID:     ${bankAccountId}`);
    console.log(`  Receipt Address:     ${depositAddress}`);
    console.log(`  Receipt Address ID:  ${depositAddressId}`);
  }
}

// ─── CLI ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     Circle Mint Express Route Tester                 ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\nEnvironment: ${config.environment}`);
  console.log(`Base URL:    ${config.baseUrl}`);

  if (!config.apiKey) {
    console.error('\nError: CIRCLE_API_KEY is not set!');
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
          console.error('Usage: express-route mock-deposit <trackingRef> [amount] [accountNumber]');
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
          console.error('Usage: express-route onchain-deposit <address> [chain] [amount]');
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
          console.error('Usage: express-route transfer <recipient-id> [amount] [currency]');
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
          console.error('Usage: express-route withdraw <bank-account-id> [amount] [currency]');
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
          console.error('Usage: express-route create <receipt-address-id> <bank-account-id>');
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
        console.log('\nAvailable Commands:');
        console.log('  link-bank [accNum] [routNum]               - Step 1: Link a wire bank account');
        console.log('  link-receipt [chain] [currency]            - Step 2: Create on-chain receipt address');
        console.log('  mock-deposit <trackRef> [amt] [accNum]     - Step 3: Simulate a wire deposit (sandbox)');
        console.log('  onchain-deposit <address> [chain] [amt]    - Step 4: Simulate an on-chain deposit (sandbox)');
        console.log('  transfer <recipient-id> [amt] [currency]   - Step 5: Send on-chain transfer');
        console.log('  withdraw <bank-id> [amt] [currency]        - Step 6: Withdraw to bank (fiat)');
        console.log('  create <receipt-addr-id> <bank-id>         - Step 7: Create express route');
        console.log('  run [chain] [amount] [bankId] [addrId] [addr] [recipId]');
        console.log('                                             - Run the full flow end-to-end');
        console.log('\nExamples:');
        console.log('  npm run express-route link-bank');
        console.log('  npm run express-route link-receipt ETH USD');
        console.log('  npm run express-route mock-deposit CIR12345 100.00 12340010');
        console.log('  npm run express-route onchain-deposit 0x123... ETH 10.00');
        console.log('  npm run express-route transfer <recipient-id> 1.00 USD');
        console.log('  npm run express-route withdraw <bank-id> 10.00 USD');
        console.log('  npm run express-route create <receipt-addr-id> <bank-id>');
        console.log('  npm run express-route run ETH 10.00');
    }
  } catch (error: any) {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
