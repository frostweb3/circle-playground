#!/usr/bin/env node

/**
 * Demo Script: Account Setup and Test Transfers
 * 
 * This script demonstrates:
 * 1. Checking account balance
 * 2. Creating a test transfer (payout)
 * 3. Checking transfer status
 * 
 * Note: For Circle Mint, accounts are created through the Circle console.
 * This script shows how to interact with an existing account.
 */

import { CircleMintClient } from './circle-mint-client.js';
import { config } from './config.js';

async function demo() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     Circle Mint Account & Transfer Demo             ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\nEnvironment: ${config.environment}`);
  console.log(`Base URL: ${config.baseUrl}\n`);

  if (!config.apiKey) {
    console.error('❌ Error: CIRCLE_API_KEY is not set!');
    process.exit(1);
  }

  const client = new CircleMintClient();

  try {
    // Step 1: Check Balance
    console.log('📊 Step 1: Checking Account Balance');
    console.log('─'.repeat(50));
    const balance = await client.getBalance();
    console.log('✅ Balance:', JSON.stringify(balance, null, 2));
    
    // Calculate total
    if (balance.data?.available) {
      const total = balance.data.available.reduce((sum: number, bal: any) => {
        return sum + parseInt(bal.amount || '0', 10);
      }, 0);
      console.log(`\n💵 Total Available: ${total} (${total / 1000000} USDC)`);
    }

    // Step 2: List existing payouts
    console.log('\n📤 Step 2: Listing Existing Payouts/Transfers');
    console.log('─'.repeat(50));
    const payouts = await client.listPayouts();
    console.log('✅ Payouts:', JSON.stringify(payouts, null, 2));
    console.log(`\n📊 Total Payouts: ${payouts.data?.length || 0}`);

    // Step 3: Example of creating a transfer
    console.log('\n💸 Step 3: Example Transfer Creation');
    console.log('─'.repeat(50));
    console.log('ℹ️  To create a transfer, use:');
    console.log('   npm run account transfer <address> <chain> <amount> [currency]');
    console.log('\nExample:');
    console.log('   npm run account transfer 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb ETH 1000000 USDC');
    console.log('\n💡 Note:');
    console.log('   - Amount is in smallest units (1000000 = 1 USDC)');
    console.log('   - Chain identifiers: ETH, MATIC, AVAX, BASE, etc.');
    console.log('   - You need sufficient balance in your account');
    console.log('   - Transfers may require account verification');

    // Step 4: Show how to check transfer status
    if (payouts.data && payouts.data.length > 0) {
      const firstPayout = payouts.data[0];
      console.log('\n📊 Step 4: Checking Transfer Status');
      console.log('─'.repeat(50));
      console.log(`Checking payout: ${firstPayout.id}`);
      const status = await client.getPayout(firstPayout.id);
      console.log('✅ Status:', JSON.stringify(status, null, 2));
    } else {
      console.log('\n📊 Step 4: No transfers to check status');
      console.log('─'.repeat(50));
      console.log('ℹ️  Once you create a transfer, check its status with:');
      console.log('   npm run account status <payout-id>');
    }

    console.log('\n✅ Demo completed successfully!');
    console.log('═'.repeat(50));

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run demo
demo();
