#!/usr/bin/env node

import { CircleMintTester } from './test-functions.js';
import { config } from './config.js';

/**
 * Circle Mint Testing App CLI
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     Circle Mint Testing App                          ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\nEnvironment: ${config.environment}`);
  console.log(`Base URL: ${config.baseUrl}`);
  
  if (!config.apiKey) {
    console.error('\n❌ Error: CIRCLE_API_KEY is not set!');
    console.error('Please create a .env file with your Circle API key.');
    console.error('Example: CIRCLE_API_KEY=your_api_key_here');
    process.exit(1);
  }

  const tester = new CircleMintTester();
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'account':
        console.log('ℹ️  Note: Accounts API was deprecated. Testing business account endpoints...');
        await tester.testGetAccount();
        break;
      
      case 'balance':
        await tester.testGetBalance();
        break;
      
      case 'chains':
        await tester.testGetSupportedChains();
        break;
      
      case 'deposits':
        if (args[1] === 'list') {
          await tester.testListDeposits();
        } else if (args[1] === 'addresses') {
          await tester.testListDepositAddresses();
        } else if (args[1] === 'create' && args[2]) {
          await tester.testCreateDepositAddress(args[2]);
        } else {
          await tester.testListDepositAddresses();
        }
        break;
      
      case 'payouts':
        if (args[1] === 'list') {
          await tester.testListPayouts();
        } else if (args[1] === 'create') {
          // Example: payouts create <address> <chain> <amount> [currency]
          const address = args[2];
          const chain = args[3];
          const amount = args[4];
          const currency = (args[5] as 'USDC' | 'EURC') || 'USDC';
          
          if (!address || !chain || !amount) {
            console.error('Usage: payouts create <address> <chain> <amount> [currency]');
            process.exit(1);
          }
          
          await tester.testCreatePayout({ address, chain, amount, currency });
        } else {
          await tester.testListPayouts();
        }
        break;
      
      case 'all':
      case undefined:
        await tester.runAllTests();
        break;
      
      default:
        console.log('\n📖 Available Commands:');
        console.log('  account              - Get account information');
        console.log('  balance              - Get account balance');
        console.log('  chains               - Get supported chains');
        console.log('  deposits             - List deposit addresses');
        console.log('  deposits addresses   - List deposit addresses');
        console.log('  deposits create <chain> - Create deposit address');
        console.log('  deposits list        - List deposits');
        console.log('  payouts              - List payouts');
        console.log('  payouts list         - List payouts');
        console.log('  payouts create <address> <chain> <amount> [currency] - Create payout');
        console.log('  all                  - Run all tests');
        console.log('\nExample:');
        console.log('  npm run dev account');
        console.log('  npm run dev deposits create ETH');
        console.log('  npm run dev payouts create 0x123... ETH 1000000 USDC');
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
