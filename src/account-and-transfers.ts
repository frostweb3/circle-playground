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
    console.log(`Amount: ${params.amount} (major units, e.g. USD)`);
    console.log(`Currency: ${params.currency || 'USD'}`);

    try {
      // First check balance
      const balance = await this.checkBalance();

      // Validate amount format (Major units string, e.g. "1.00")
      if (!params.amount.match(/^\d+(\.\d+)?$/)) {
        throw new Error('Invalid amount format. Must be a string representing major units (e.g. "1.00").');
      }

      // The Crypto Payouts API requires an address book entry — create one first
      console.log('\n📋 Adding address to address book...');
      const abEntry = await this.client.createAddressBookRecipient({
        idempotencyKey: `ab-${Date.now()}`,
        chain: params.chain,
        address: params.recipientAddress,
        metadata: { nickname: `Transfer target ${params.chain}` },
      });
      const recipientId = abEntry.data?.id;
      if (!recipientId) throw new Error('Failed to add address to address book');
      console.log(`✅ Address book entry created: ${recipientId}`);

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
    testTransfer?: TransferParams;
    autoTest?: boolean;
  }): Promise<void> {
    console.log('\n🚀 Starting Account and Transfer Test Flow');

    try {
      // Step 1: Check balance
      await this.checkBalance();

      // Step 2: Get or Create deposit address
      const blockchain = params?.blockchain || 'ETH';
      let depositAddress;

      try {
        console.log('\n🔍 Checking for existing deposit addresses...');
        const existingAddresses = await this.client.listBusinessDepositAddresses();

        if (existingAddresses.data && existingAddresses.data.length > 0) {
          // Filter for the requested chain if possible (though listBusinessDepositAddresses doesn't seem to take chain param in client currently, we filter client-side)
          const matchedAddress = existingAddresses.data.find((addr: any) => addr.chain === blockchain);

          if (matchedAddress) {
            depositAddress = { data: matchedAddress };
            console.log(`✅ Using existing deposit address: ${depositAddress.data.address}`);
          }
        }

        if (!depositAddress) {
          console.log('ℹ️  No existing address found. Creating new one...');
          depositAddress = await this.createDepositAddress({ chain: blockchain, currency: 'USD' });
        }
      } catch (error: any) {
        console.error('❌ Error getting/creating deposit address:', error.message);
        throw error;
      }

      // Step 3: Attempt test transfer if params provided or autoTest is true
      if (params?.testTransfer || (params?.autoTest && depositAddress.data?.address)) {
        console.log('\n⏳ Waiting 2 seconds before creating transfer...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        let transferParams = params?.testTransfer;

        if (!transferParams && params?.autoTest && depositAddress.data?.address) {
          console.log('🔄 Auto-Test: Preparing Business Transfer...');
          console.log(`   Target Address: ${depositAddress.data.address}`);

          let recipientId;

          try {
            // Check if recipient already exists for this address
            const recipients = await this.client.listRecipientAddresses();
            const existingRecipient = recipients.data?.find((r: any) =>
              r.address === depositAddress.data.address && r.chain === blockchain
            );

            if (existingRecipient) {
              recipientId = existingRecipient.id;
              console.log(`✅ Found existing recipient ID: ${recipientId}`);
            } else {
              console.log('Duplicate recipient not found. Creating new recipient...');
              const newRecipient = await this.createRecipientAddress({
                chain: blockchain,
                address: depositAddress.data.address,
                description: `Auto-created for ${depositAddress.data.address}`,
              });
              recipientId = newRecipient.data?.id;
              console.log(`✅ Created new recipient ID: ${recipientId}`);
              // Wait for propagation
              await new Promise(resolve => setTimeout(resolve, 2000));
            }

            if (recipientId) {
              console.log('🚀 Initiating Business Transfer...');
              const transfer = await this.createBusinessTransfer({
                recipientId,
                amount: '1.00',
                currency: 'USD'
              });

              // Check transfer status
              if (transfer.data?.id) {
                console.log('\n⏳ Waiting 2 seconds before checking status...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.getBusinessTransferStatus(transfer.data.id);
              }
            }

          } catch (autoTestError: any) {
            console.warn('\n⚠️  Auto-transfer execution failed (expected if recipient not verified or low balance). Continuing...');
            console.warn('Error details:', autoTestError.message);
          }
        } else if (transferParams) {
          // Manual transfer params provided
          try {
            const transfer = await this.createTransfer(transferParams);
            if (transfer.data?.id) {
              console.log('\n⏳ Waiting 2 seconds before checking status...');
              await new Promise(resolve => setTimeout(resolve, 2000));
              await this.getTransferStatus(transfer.data.id);
            }
          } catch (err: any) {
            console.error('❌ Transfer failed:', err.message);
          }
        }
      } else {
        console.log('\n💡 To test a transfer, provide transfer parameters:');
        console.log('   recipientAddress, chain, amount, currency');
      }

      console.log('\n✅ Test flow completed!');
    } catch (error: any) {
      console.error('\n❌ Test flow failed:', error.message);
      throw error;
    }
  }

  /**
   * Create a wire bank account
   */
  async createWireBankAccount(): Promise<any> {
    console.log('\n🏦 Creating Wire Bank Account...');
    console.log('─'.repeat(50));

    try {
      const idempotencyKey = crypto.randomUUID();

      // using example data from Circle docs
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

      console.log('Using test parameters:');
      console.log(JSON.stringify(params, null, 2));

      const account = await this.client.createWireBankAccount(params);

      console.log('\n✅ Wire bank account created successfully!');
      console.log(JSON.stringify(account, null, 2));

      if (account.data?.id) {
        console.log(`\n🆔 Account ID: ${account.data.id}`);
        console.log(`📊 Status: ${account.data.status}`);
        console.log(`Tracking Ref: ${account.data.trackingRef}`);
      }

      return account;
    } catch (error: any) {
      console.error('\n❌ Error creating wire bank account:', error.message);
      throw error;
    }
  }

  /**
   * List wire bank accounts
   */
  async listWireBankAccounts(): Promise<any> {
    console.log('\n📋 Listing Wire Bank Accounts...');
    console.log('─'.repeat(50));

    try {
      const accounts = await this.client.listWireBankAccounts();

      console.log('✅ Wire bank accounts retrieved:');
      console.log(JSON.stringify(accounts, null, 2));

      return accounts;
    } catch (error: any) {
      console.error('\n❌ Error listing wire bank accounts:', error.message);
      throw error;
    }
  }

  /**
   * Create a mock wire payment
   */
  async createMockWirePayment(params: {
    trackingRef: string;
    amount: string;
    accountNumber: string;
  }): Promise<any> {
    console.log('\n💸 Creating Mock Wire Payment...');
    console.log('─'.repeat(50));
    console.log(`Tracking Ref: ${params.trackingRef}`);
    console.log(`Amount: ${params.amount}`);
    console.log(`Account Number: ${params.accountNumber}`);

    try {
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

      console.log('\n✅ Mock wire payment created successfully!');
      console.log(JSON.stringify(payment, null, 2));

      if (payment.data?.status) {
        console.log(`\n📊 Status: ${payment.data.status}`);
      }

      return payment;
    } catch (error: any) {
      console.error('\n❌ Error creating mock wire payment:', error.message);
      throw error;
    }
  }

  /**
   * Get wire bank account instructions
   */
  async getWireBankAccountInstructions(id: string): Promise<any> {
    console.log(`\n📄 Getting Wire Instructions for ID: ${id}`);
    console.log('─'.repeat(50));

    try {
      const instructions = await this.client.getWireBankAccountInstructions(id);

      console.log('✅ Instructions retrieved:');
      console.log(JSON.stringify(instructions, null, 2));

      // Check for beneficiary details
      if (instructions.data?.beneficiaryBank?.accountNumber) {
        console.log(`\n🏦 Beneficiary Account Number: ${instructions.data.beneficiaryBank.accountNumber}`);
      }

      return instructions;
    } catch (error: any) {
      console.error('\n❌ Error getting instructions:', error.message);
      throw error;
    }
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
    console.log('\n💸 Creating Business Transfer...');
    console.log('─'.repeat(50));
    console.log(`Recipient ID: ${params.recipientId}`);
    console.log(`Amount: ${params.amount} ${params.currency}`);

    try {
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

      console.log('\n✅ Business transfer created successfully!');
      console.log(JSON.stringify(transfer, null, 2));

      if (transfer.data?.id) {
        console.log(`\n🆔 Transfer ID: ${transfer.data.id}`);
        console.log(`📊 Status: ${transfer.data.status}`);
      }

      return transfer;
    } catch (error: any) {
      console.error('\n❌ Error creating business transfer:', error.message);
      throw error;
    }
  }

  /**
   * Get business transfer status
   */
  async getBusinessTransferStatus(transferId: string): Promise<any> {
    console.log(`\n🔍 Checking Business Transfer Status for ID: ${transferId}`);
    console.log('─'.repeat(50));

    try {
      const transfer = await this.client.getBusinessTransfer(transferId);
      console.log('✅ Transfer Status Retrieved:');
      console.log(JSON.stringify(transfer, null, 2));

      if (transfer.data?.status) {
        console.log(`\n📊 Current Status: ${transfer.data.status}`);
      }
      return transfer;
    } catch (error: any) {
      console.error('❌ Error getting transfer status:', error.message);
      throw error;
    }
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
    console.log('\njm Creating Recipient Address...');
    console.log('─'.repeat(50));
    console.log(`Chain: ${params.chain}`);
    console.log(`Address: ${params.address}`);
    if (params.addressTag) {
      console.log(`Address Tag: ${params.addressTag}`);
    }
    console.log(`Description: ${params.description}`);

    try {
      const idempotencyKey = crypto.randomUUID();
      const recipient = await this.client.createRecipientAddress({
        idempotencyKey,
        chain: params.chain,
        address: params.address,
        currency: 'USD', // Defaulting to USD for now
        description: params.description,
        addressTag: params.addressTag,
      });

      console.log('\n✅ Recipient address created successfully!');
      console.log(JSON.stringify(recipient, null, 2));

      if (recipient.data?.id) {
        console.log(`\n🆔 Recipient ID: ${recipient.data.id}`);
        console.log(`📊 Status: ${recipient.data.status}`);
      }

      return recipient;
    } catch (error: any) {
      console.error('\n❌ Error creating recipient address:', error.message);
      throw error;
    }
  }

  /**
   * List recipient addresses
   */
  async listRecipientAddresses(): Promise<any> {
    console.log('\n📋 Listing Recipient Addresses...');
    console.log('─'.repeat(50));

    try {
      const recipients = await this.client.listRecipientAddresses();

      console.log('✅ Recipient addresses retrieved:');
      console.log(JSON.stringify(recipients, null, 2));

      return recipients;
    } catch (error: any) {
      console.error('\n❌ Error listing recipient addresses:', error.message);
      throw error;
    }
  }

  /**
   * Get a recipient address
   */
  async getRecipientAddress(id: string): Promise<any> {
    console.log(`\n📄 Getting Recipient Address for ID: ${id}`);
    console.log('─'.repeat(50));

    try {
      const recipient = await this.client.getRecipientAddress(id);

      console.log('✅ Recipient address retrieved:');
      console.log(JSON.stringify(recipient, null, 2));

      if (recipient.data?.status) {
        console.log(`\n📊 Status: ${recipient.data.status}`);
      }

      return recipient;
    } catch (error: any) {
      console.error('\n❌ Error getting recipient address:', error.message);
      throw error;
    }
  }

  /**
   * Create a deposit address
   */
  async createDepositAddress(params: {
    chain: string;
    currency: string;
  }): Promise<any> {
    console.log('\n📥 Creating Deposit Address...');
    console.log('─'.repeat(50));
    console.log(`Chain: ${params.chain}`);
    console.log(`Currency: ${params.currency}`);

    try {
      const idempotencyKey = crypto.randomUUID();
      const address = await this.client.createDepositAddress({
        idempotencyKey,
        chain: params.chain,
        currency: params.currency,
      });

      console.log('\n✅ Deposit address created successfully!');
      console.log(JSON.stringify(address, null, 2));

      return address;
    } catch (error: any) {
      console.error('\n❌ Error creating deposit address:', error.message);
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
        await tester.createDepositAddress({ chain: blockchain, currency: 'USD' });
        break;

      case 'transfer':
        // Usage: transfer <address> <chain> <amount> [currency]
        const address = args[1];
        const chain = args[2];
        const amount = args[3];
        const tCurrency = (args[4] as 'USD' | 'EUR') || 'USD';

        if (!address || !chain || !amount) {
          console.error('Usage: transfer <address> <chain> <amount> [currency]');
          console.error('Example: transfer 0x123... ETH 1000000 USDC');
          process.exit(1);
        }

        await tester.createTransfer({ recipientAddress: address, chain, amount, currency: tCurrency });
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
        // Usage: mock-wire <trackingRef> <amount> <accountNumber>
        const trackingRef = args[1];
        const mockAmount = args[2];
        const accountNumber = args[3];

        if (!trackingRef || !mockAmount || !accountNumber) {
          console.error('Usage: mock-wire <trackingRef> <amount> <accountNumber>');
          console.error('Example: mock-wire CIR123 100.00 12345678');
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
          console.error('Usage: get-wire-instructions <account-id>');
          process.exit(1);
        }
        await tester.getWireBankAccountInstructions(instructionId);
        break;

      case 'business-transfer':
        // Usage: business-transfer <recipient-id> <amount> [currency]
        const recipientId = args[1];
        const amountTrsf = args[2];
        const currencyTrsf = (args[3] as 'USD' | 'EUR' | 'BTC' | 'ETH') || 'USD';

        if (!recipientId || !amountTrsf) {
          console.error('Usage: business-transfer <recipient-id> <amount> [currency]');
          console.error('Example: business-transfer 89692bf2... 10.00 USD');
          process.exit(1);
        }

        await tester.createBusinessTransfer({
          recipientId,
          amount: amountTrsf,
          currency: currencyTrsf,
        });
        break;

      case 'create-recipient':
        // Usage: create-recipient <chain> <address> <description> [tag]
        const rChain = args[1];
        const rAddress = args[2];
        const rDesc = args[3];
        const rTag = args[4];

        if (!rChain || !rAddress || !rDesc) {
          console.error('Usage: create-recipient <chain> <address> <description> [tag]');
          console.error('Example: create-recipient ETH 0x123... "My Wallet"');
          console.error('Example (with tag): create-recipient XLM G123... "Stellar Wallet" 12345');
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
          console.error('Usage: get-recipient <recipient-id>');
          process.exit(1);
        }
        await tester.getRecipientAddress(rId);
        break;

      case 'create-deposit-address':
        // Usage: create-deposit-address <chain> <currency>
        const dChain = args[1];
        const dCurrency = args[2] || 'USD';

        if (!dChain) {
          console.error('Usage: create-deposit-address <chain> <currency>');
          console.error('Example: create-deposit-address ETH USD');
          process.exit(1);
        }

        await tester.createDepositAddress({
          chain: dChain,
          currency: dCurrency,
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
        console.log('  create-wire-account         - Create a wire bank account (with test data)');
        console.log('  list-wire-accounts          - List wire bank accounts');
        console.log('  get-wire-instructions <id>  - Get wire instructions');
        console.log('  mock-wire <ref> <amt> <acc> - Create mock wire payment');
        console.log('  create-recipient <chain> <addr> <desc> [tag] - Create recipient address');
        console.log('  list-recipients             - List recipient addresses');
        console.log('  get-recipient <id>          - Get recipient address details');
        console.log('  create-deposit-address <chain> [curr] - Create deposit address');
        console.log('  business-transfer <rec-id> <amt> [curr] - Create business transfer');
        console.log('  test [chain] [addr] [chain] [amount] [currency] - Run complete test flow');
        console.log('\nExamples:');
        console.log('  npm run account balance');
        console.log('  npm run account deposit-address ETH');
        console.log('  npm run account transfer 0x123... ETH 1000000 USDC');
        console.log('  npm run account status payout-123');
        console.log('  npm run account business-payout wire <bank-id> 100.00 USD');
        console.log('  npm run account business-payouts');
        console.log('  npm run account business-status payout-123');
        console.log('  npm run account create-wire-account');
        console.log('  npm run account list-wire-accounts');
        console.log('  npm run account get-wire-instructions <account-id>');
        console.log('  npm run account mock-wire CIR123 100.00 12345678');
        console.log('  npm run account create-recipient ETH 0x123... "My Wallet"');
        console.log('  npm run account get-recipient 89692bf2...');
        console.log('  npm run account create-deposit-address ETH USD');
        console.log('  npm run account business-transfer 89692bf2... 10.00 USD');
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
