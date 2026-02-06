import { CircleMintClient } from './circle-mint-client.js';

/**
 * Test functions for Circle Mint operations
 */
export class CircleMintTester {
  private client: CircleMintClient;

  constructor() {
    this.client = new CircleMintClient();
  }

  /**
   * Test: Get account information
   * Note: Accounts API was deprecated. This test checks for business account info.
   */
  async testGetAccount(): Promise<void> {
    console.log('\n📋 Testing: Get Account Information');
    console.log('─'.repeat(50));
    console.log('ℹ️  Note: Accounts API was deprecated. Checking business account endpoints...');
    try {
      // Try to get business account info
      const balance = await this.client.getBalance();
      console.log('✅ Account balance retrieved (using business account endpoint):');
      console.log(JSON.stringify(balance, null, 2));
    } catch (error: any) {
      console.error('❌ Error getting account info:', error.message);
      console.log('ℹ️  The Accounts API was removed. Use business account endpoints instead.');
    }
  }

  /**
   * Test: Get account balance
   */
  async testGetBalance(): Promise<void> {
    console.log('\n💰 Testing: Get Account Balance');
    console.log('─'.repeat(50));
    try {
      const balance = await this.client.getBalance();
      console.log('✅ Balance retrieved successfully:');
      console.log(JSON.stringify(balance, null, 2));
    } catch (error: any) {
      console.error('❌ Error getting balance:', error.message);
    }
  }

  /**
   * Test: Get supported chains
   */
  async testGetSupportedChains(): Promise<void> {
    console.log('\n🌐 Testing: Get Supported Chains');
    console.log('─'.repeat(50));
    try {
      const chains = await this.client.getSupportedChains();
      console.log('✅ Supported chains retrieved:');
      console.log(JSON.stringify(chains, null, 2));
    } catch (error: any) {
      console.error('❌ Error getting supported chains:', error.message);
    }
  }

  /**
   * Test: List deposit addresses
   */
  async testListDepositAddresses(): Promise<void> {
    console.log('\n📥 Testing: List Deposit Addresses');
    console.log('─'.repeat(50));
    try {
      const addresses = await this.client.listDepositAddresses();
      console.log('✅ Deposit addresses retrieved:');
      console.log(JSON.stringify(addresses, null, 2));
    } catch (error: any) {
      console.error('❌ Error listing deposit addresses:', error.message);
      console.log('ℹ️  Note: Crypto Deposits API may require account setup or additional configuration.');
      console.log('   Visit: https://developers.circle.com/circle-mint/crypto-payments-quickstart');
    }
  }

  /**
   * Test: Create deposit address
   */
  async testCreateDepositAddress(blockchain: string = 'ETH'): Promise<void> {
    console.log(`\n📝 Testing: Create Deposit Address (${blockchain})`);
    console.log('─'.repeat(50));
    try {
      const idempotencyKey = `test-${Date.now()}`;
      const address = await this.client.createDepositAddress({
        idempotencyKey,
        blockchain,
      });
      console.log('✅ Deposit address created:');
      console.log(JSON.stringify(address, null, 2));
    } catch (error: any) {
      console.error('❌ Error creating deposit address:', error.message);
      console.log('ℹ️  Note: Crypto Deposits API may require account setup or additional configuration.');
      console.log('   Visit: https://developers.circle.com/circle-mint/crypto-payments-quickstart');
    }
  }

  /**
   * Test: List deposits
   */
  async testListDeposits(): Promise<void> {
    console.log('\n📊 Testing: List Deposits');
    console.log('─'.repeat(50));
    try {
      const deposits = await this.client.listDeposits();
      console.log('✅ Deposits retrieved:');
      console.log(JSON.stringify(deposits, null, 2));
    } catch (error: any) {
      console.error('❌ Error listing deposits:', error.message);
      console.log('ℹ️  Note: Crypto Deposits API may require account setup or additional configuration.');
      console.log('   Visit: https://developers.circle.com/circle-mint/crypto-payments-quickstart');
    }
  }

  /**
   * Test: List payouts
   */
  async testListPayouts(): Promise<void> {
    console.log('\n📤 Testing: List Payouts');
    console.log('─'.repeat(50));
    try {
      const payouts = await this.client.listPayouts();
      console.log('✅ Payouts retrieved:');
      console.log(JSON.stringify(payouts, null, 2));
    } catch (error: any) {
      console.error('❌ Error listing payouts:', error.message);
    }
  }

  /**
   * Test: Create payout (withdrawal)
   * Note: This is a test function - actual payouts require valid addresses and funds
   */
  async testCreatePayout(params: {
    address: string;
    chain: string;
    amount: string;
    currency?: 'USDC' | 'EURC';
  }): Promise<void> {
    console.log(`\n💸 Testing: Create Payout`);
    console.log('─'.repeat(50));
    try {
      const idempotencyKey = `payout-${Date.now()}`;
      const payout = await this.client.createPayout({
        idempotencyKey,
        destination: {
          type: 'address',
          address: params.address,
          chain: params.chain,
        },
        amount: {
          amount: params.amount,
          currency: params.currency || 'USDC',
        },
      });
      console.log('✅ Payout created:');
      console.log(JSON.stringify(payout, null, 2));
    } catch (error: any) {
      console.error('❌ Error creating payout:', error.message);
    }
  }

  /**
   * Run all basic tests
   */
  async runAllTests(): Promise<void> {
    console.log('\n🚀 Running All Circle Mint Tests');
    console.log('═'.repeat(50));
    
    await this.testGetAccount();
    await this.testGetBalance();
    await this.testGetSupportedChains();
    await this.testListDepositAddresses();
    await this.testListDeposits();
    await this.testListPayouts();
    
    console.log('\n✅ All tests completed!');
    console.log('═'.repeat(50));
  }
}
