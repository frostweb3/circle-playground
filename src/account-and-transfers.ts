#!/usr/bin/env node

import { CircleMintClient } from './circle-mint-client.js';
import { config } from './config.js';

/**
 * Account and Transfer Testing Script
 * Creates deposit addresses and performs test transfers
 */

interface TransferParams {
  recipientAddress: string;
  chain: string;
  amount: string; // Amount in smallest unit (e.g., "1000000" for 1 USDC)
  currency?: 'USDC' | 'EURC';
}

class AccountAndTransferTester {
  private client: CircleMintClient;

  constructor() {
    this.client = new CircleMintClient();
  }

  /**
   * Create a deposit address for receiving funds
   */
  async createDepositAddress(blockchain: string = 'ETH'): Promise<any> {
    console.log(`\n📝 Creating Deposit Address for ${blockchain}...`);
    console.log('─'.repeat(50));

    try {
      const idempotencyKey = `deposit-addr-${Date.now()}`;
      const result = await this.client.createDepositAddress({
        idempotencyKey,
        blockchain,
      });

      console.log('✅ Deposit address created successfully!');
      console.log(JSON.stringify(result, null, 2));

      // Extract address if available
      if (result.data?.address) {
        console.log(`\n📍 Deposit Address: ${result.data.address}`);
        console.log(`🔗 Blockchain: ${blockchain}`);
        if (result.data.addressTag) {
          console.log(`🏷️  Address Tag: ${result.data.addressTag}`);
        }
      }

      return result;
    } catch (error: any) {
      console.error('❌ Error creating deposit address:', error.message);
      throw error;
    }
  }

  /**
   * Check account balance before transfer
   */
  async checkBalance(): Promise<any> {
    console.log('\n💰 Checking Account Balance...');
    console.log('─'.repeat(50));

    try {
      const balance = await this.client.getBalance();
      console.log('✅ Balance retrieved:');
      console.log(JSON.stringify(balance, null, 2));

      // Calculate total available balance
      if (balance.data?.available) {
        const totalAvailable = balance.data.available.reduce((sum: number, bal: any) => {
          return sum + (parseInt(bal.amount || '0', 10));
        }, 0);
        console.log(`\n💵 Total Available: ${totalAvailable} (smallest units)`);
        if (totalAvailable > 0) {
          console.log(`   ≈ ${totalAvailable / 1000000} USDC`);
        }
      }

      return balance;
    } catch (error: any) {
      console.error('❌ Error checking balance:', error.message);
      throw error;
    }
  }

  /**
   * Create a test transfer (payout)
   */
  async createTransfer(params: TransferParams): Promise<any> {
    console.log(`\n💸 Creating Transfer...`);
    console.log('─'.repeat(50));
    console.log(`Recipient: ${params.recipientAddress}`);
    console.log(`Chain: ${params.chain}`);
    console.log(`Amount: ${params.amount} (smallest units)`);
    console.log(`Currency: ${params.currency || 'USDC'}`);

    try {
      // First check balance
      const balance = await this.checkBalance();
      
      // Validate amount format
      const amountNum = parseInt(params.amount, 10);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Invalid amount. Must be a positive number in smallest units.');
      }

      // Create payout/transfer
      const idempotencyKey = `transfer-${Date.now()}`;
      const payout = await this.client.createPayout({
        idempotencyKey,
        destination: {
          type: 'address',
          address: params.recipientAddress,
          chain: params.chain,
        },
        amount: {
          amount: params.amount,
          currency: params.currency || 'USDC',
        },
      });

      console.log('\n✅ Transfer created successfully!');
      console.log(JSON.stringify(payout, null, 2));

      if (payout.data?.id) {
        console.log(`\n🆔 Transfer ID: ${payout.data.id}`);
        console.log(`📊 Status: ${payout.data.status || 'PENDING'}`);
      }

      return payout;
    } catch (error: any) {
      console.error('\n❌ Error creating transfer:', error.message);
      
      // Provide helpful error messages
      if (error.message.includes('insufficient') || error.message.includes('balance')) {
        console.log('\n💡 Tip: You need funds in your Circle Mint account to make transfers.');
        console.log('   - Deposit funds to your account first');
        console.log('   - Or use the sandbox faucet if available');
      } else if (error.message.includes('404')) {
        console.log('\n💡 Tip: This endpoint may require account setup.');
      } else if (error.message.includes('400') || error.message.includes('validation')) {
        console.log('\n💡 Tip: Check that:');
        console.log('   - The recipient address is valid for the specified chain');
        console.log('   - The chain identifier is correct');
        console.log('   - The amount is in smallest units (e.g., 1000000 for 1 USDC)');
      }
      
      throw error;
    }
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(payoutId: string): Promise<any> {
    console.log(`\n📊 Checking Transfer Status: ${payoutId}`);
    console.log('─'.repeat(50));

    try {
      const payout = await this.client.getPayout(payoutId);
      console.log('✅ Transfer status retrieved:');
      console.log(JSON.stringify(payout, null, 2));

      if (payout.data) {
        console.log(`\n📊 Status: ${payout.data.status}`);
        if (payout.data.fees) {
          console.log(`💰 Fees: ${JSON.stringify(payout.data.fees)}`);
        }
        if (payout.data.txHash) {
          console.log(`🔗 Transaction Hash: ${payout.data.txHash}`);
        }
      }

      return payout;
    } catch (error: any) {
      console.error('❌ Error getting transfer status:', error.message);
      throw error;
    }
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
    console.log(`\n💸 Creating Business Payout (Fiat Offramp)...`);
    console.log('─'.repeat(50));
    console.log(`Destination Type: ${params.destinationType}`);
    console.log(`Destination ID: ${params.destinationId}`);
    console.log(`Amount: ${params.amount} ${params.currency}`);

    try {
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

      console.log('\n✅ Business payout created successfully!');
      console.log(JSON.stringify(payout, null, 2));

      if (payout.data?.id) {
        console.log(`\n🆔 Payout ID: ${payout.data.id}`);
        console.log(`📊 Status: ${payout.data.status || 'PENDING'}`);
        if (payout.data.trackingRef) {
          console.log(`📋 Tracking Ref: ${payout.data.trackingRef}`);
        }
        if (payout.data.fees) {
          console.log(`💰 Fees: ${payout.data.fees.amount} ${payout.data.fees.currency}`);
        }
      }

      return payout;
    } catch (error: any) {
      console.error('\n❌ Error creating business payout:', error.message);
      
      if (error.message.includes('insufficient') || error.message.includes('balance')) {
        console.log('\n💡 Tip: You need sufficient digital asset balance to convert to fiat.');
      } else if (error.message.includes('400') || error.message.includes('validation')) {
        console.log('\n💡 Tip: Check that:');
        console.log('   - The bank account ID is valid');
        console.log('   - The destination type matches your bank account type');
        console.log('   - The amount format is correct (e.g., "100.00")');
        console.log('   - The currency is supported');
      }
      
      throw error;
    }
  }

  /**
   * List business payouts
   */
  async listBusinessPayouts(status?: 'pending' | 'complete' | 'failed'): Promise<any> {
    console.log('\n📤 Listing Business Payouts');
    console.log('─'.repeat(50));
    try {
      const payouts = await this.client.listBusinessPayouts(status ? { status } : undefined);
      console.log('✅ Business payouts retrieved:');
      console.log(JSON.stringify(payouts, null, 2));
      return payouts;
    } catch (error: any) {
      console.error('❌ Error listing business payouts:', error.message);
      throw error;
    }
  }

  /**
   * Get business payout status
   */
  async getBusinessPayoutStatus(payoutId: string): Promise<any> {
    console.log(`\n📊 Checking Business Payout Status: ${payoutId}`);
    console.log('─'.repeat(50));
    try {
      const payout = await this.client.getBusinessPayout(payoutId);
      console.log('✅ Business payout status retrieved:');
      console.log(JSON.stringify(payout, null, 2));
      
      if (payout.data) {
        console.log(`\n📊 Status: ${payout.data.status}`);
        if (payout.data.trackingRef) {
          console.log(`📋 Tracking Ref: ${payout.data.trackingRef}`);
        }
        if (payout.data.fees) {
          console.log(`💰 Fees: ${payout.data.fees.amount} ${payout.data.fees.currency}`);
        }
        if (payout.data.errorCode) {
          console.log(`⚠️  Error Code: ${payout.data.errorCode}`);
        }
      }
      
      return payout;
    } catch (error: any) {
      console.error('❌ Error getting business payout status:', error.message);
      throw error;
    }
  }

  /**
   * Run a complete test flow: create deposit address and attempt transfer
   */
  async runTestFlow(params?: {
    blockchain?: string;
    testTransfer?: {
      recipientAddress: string;
      chain: string;
      amount: string;
      currency?: 'USDC' | 'EURC';
    };
  }): Promise<void> {
    console.log('\n🚀 Starting Account and Transfer Test Flow');
    console.log('═'.repeat(50));

    try {
      // Step 1: Check balance
      await this.checkBalance();

      // Step 2: Create deposit address
      const blockchain = params?.blockchain || 'ETH';
      const depositAddress = await this.createDepositAddress(blockchain);

      // Step 3: Attempt test transfer if params provided
      if (params?.testTransfer) {
        console.log('\n⏳ Waiting 2 seconds before creating transfer...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const transfer = await this.createTransfer(params.testTransfer);

        // Step 4: Check transfer status
        if (transfer.data?.id) {
          console.log('\n⏳ Waiting 2 seconds before checking status...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          await this.getTransferStatus(transfer.data.id);
        }
      } else {
        console.log('\n💡 To test a transfer, provide transfer parameters:');
        console.log('   recipientAddress, chain, amount, currency');
      }

      console.log('\n✅ Test flow completed!');
      console.log('═'.repeat(50));
    } catch (error: any) {
      console.error('\n❌ Test flow failed:', error.message);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     Circle Mint Account & Transfer Tester            ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\nEnvironment: ${config.environment}`);
  console.log(`Base URL: ${config.baseUrl}`);

  if (!config.apiKey) {
    console.error('\n❌ Error: CIRCLE_API_KEY is not set!');
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
        await tester.createDepositAddress(blockchain);
        break;

      case 'transfer':
        // Usage: transfer <address> <chain> <amount> [currency]
        const address = args[1];
        const chain = args[2];
        const amount = args[3];
        const currency = (args[4] as 'USDC' | 'EURC') || 'USDC';

        if (!address || !chain || !amount) {
          console.error('Usage: transfer <address> <chain> <amount> [currency]');
          console.error('Example: transfer 0x123... ETH 1000000 USDC');
          process.exit(1);
        }

        await tester.createTransfer({ recipientAddress: address, chain, amount, currency });
        break;

      case 'status':
        const payoutId = args[1];
        if (!payoutId) {
          console.error('Usage: status <payout-id>');
          process.exit(1);
        }
        await tester.getTransferStatus(payoutId);
        break;

      case 'business-payout':
        // Usage: business-payout <type> <bank-account-id> <amount> <currency> [wallet-id]
        const destType = args[1] as 'wire' | 'cubix' | 'pix' | 'sepa' | 'sepa_instant';
        const bankAccountId = args[2];
        const fiatAmount = args[3];
        const fiatCurrency = (args[4] as 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL') || 'USD';
        const walletId = args[5];

        if (!destType || !bankAccountId || !fiatAmount) {
          console.error('Usage: business-payout <type> <bank-account-id> <amount> <currency> [wallet-id]');
          console.error('Types: wire, cubix, pix, sepa, sepa_instant');
          console.error('Example: business-payout wire <bank-id> 100.00 USD');
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
          console.error('Usage: business-status <payout-id>');
          process.exit(1);
        }
        await tester.getBusinessPayoutStatus(businessPayoutId);
        break;

      case 'test':
        // Run complete test flow
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
                currency: (args[5] as 'USDC' | 'EURC') || 'USDC',
              }
            : undefined,
        });
        break;

      default:
        console.log('\n📖 Available Commands:');
        console.log('  balance                    - Check account balance');
        console.log('  deposit-address [chain]     - Create deposit address (default: ETH)');
        console.log('  transfer <addr> <chain> <amount> [currency] - Create transfer');
        console.log('  status <payout-id>          - Check transfer status');
        console.log('  business-payout <type> <bank-id> <amount> <currency> [wallet-id] - Create fiat payout');
        console.log('  business-payouts [status]    - List business payouts');
        console.log('  business-status <payout-id> - Check business payout status');
        console.log('  test [chain] [addr] [chain] [amount] [currency] - Run complete test flow');
        console.log('\nExamples:');
        console.log('  npm run account balance');
        console.log('  npm run account deposit-address ETH');
        console.log('  npm run account transfer 0x123... ETH 1000000 USDC');
        console.log('  npm run account status payout-123');
        console.log('  npm run account business-payout wire <bank-id> 100.00 USD');
        console.log('  npm run account business-payouts');
        console.log('  npm run account business-status payout-123');
        console.log('  npm run account test ETH 0x123... ETH 1000000 USDC');
        console.log('\n💡 Note:');
        console.log('  - Crypto transfer amounts are in smallest units (1000000 = 1 USDC)');
        console.log('  - Business payout amounts are in fiat format (e.g., "100.00")');
        console.log('  - Business payout types: wire, cubix, pix, sepa, sepa_instant');
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
