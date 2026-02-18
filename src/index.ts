#!/usr/bin/env node

import { CircleMintTester } from './test-functions.js';
import { AccountAndTransferTester } from './account-and-transfers.js';
import { ExpressRouteTester } from './express-route.js';
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

      case 'withdraw': {
        const transferTester = new AccountAndTransferTester();
        const sub = args[1];

        if (!sub || sub === 'help') {
          console.log('\n📖 Withdraw (bank payout) commands:');
          console.log('  withdraw list-banks               - List wire bank accounts');
          console.log('  withdraw setup                    - Create a wire bank account (sandbox test data)');
          console.log('  withdraw instructions <bank-id>   - Get wire transfer instructions');
          console.log('  withdraw mock <ref> <amt> <acct>  - Simulate a wire deposit (sandbox only)');
          console.log('  withdraw <bank-id> <amount> [currency] - Withdraw to bank account');
          console.log('\nExamples:');
          console.log('  npm run dev withdraw list-banks');
          console.log('  npm run dev withdraw setup');
          console.log('  npm run dev withdraw instructions <bank-id>');
          console.log('  npm run dev withdraw mock CIR123 100.00 12340010');
          console.log('  npm run dev withdraw <bank-id> 100.00 USD');
        } else if (sub === 'list-banks') {
          await transferTester.listWireBankAccounts();
        } else if (sub === 'setup') {
          await transferTester.createWireBankAccount();
        } else if (sub === 'instructions') {
          const bankId = args[2];
          if (!bankId) {
            console.error('Usage: withdraw instructions <bank-id>');
            process.exit(1);
          }
          await transferTester.getWireBankAccountInstructions(bankId);
        } else if (sub === 'mock') {
          const trackingRef = args[2];
          const mockAmt = args[3];
          const acctNum = args[4];
          if (!trackingRef || !mockAmt || !acctNum) {
            console.error('Usage: withdraw mock <trackingRef> <amount> <accountNumber>');
            process.exit(1);
          }
          await transferTester.createMockWirePayment({ trackingRef, amount: mockAmt, accountNumber: acctNum });
        } else {
          // withdraw <bank-id> <amount> [currency]
          const bankId = args[1];
          const wdRaw = args[2];
          const wdCurrency = (args[3] as 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL') || 'USD';
          if (!bankId || !wdRaw) {
            console.error('Usage: withdraw <bank-id> <amount> [currency]');
            console.error('Example: npm run dev withdraw <bank-id> 100.00 USD');
            process.exit(1);
          }
          // Circle requires exactly 2 decimal places (e.g. "10.00", not "10.0")
          const wdAmount = parseFloat(wdRaw).toFixed(2);
          await transferTester.createBusinessPayout({
            destinationType: 'wire',
            destinationId: bankId,
            amount: wdAmount,
            currency: wdCurrency,
          });
        }
        break;
      }

      case 'express-route': {
        const expressRouteTester = new ExpressRouteTester();
        const sub = args[1];

        if (!sub || sub === 'help') {
          console.log('\nExpress Route Commands:');
          console.log('  express-route link-bank [accNum] [routNum]           - Step 1: Link wire bank account');
          console.log('  express-route link-receipt [chain] [currency]        - Step 2: Create receipt address');
          console.log('  express-route mock-deposit <ref> [amt] [accNum]      - Step 3: Mock wire deposit (sandbox)');
          console.log('  express-route onchain-deposit <address> [chain] [amt]- Step 4: Mock on-chain deposit (sandbox)');
          console.log('  express-route transfer <recipient-id> [amt] [curr]   - Step 5: On-chain transfer');
          console.log('  express-route withdraw <bank-id> [amt] [curr]        - Step 6: Withdraw to bank');
          console.log('  express-route create <receipt-addr-id> <bank-id>     - Step 7: Create express route');
          console.log('  express-route run [chain] [amount]                   - Run full flow end-to-end');
        } else if (sub === 'link-bank') {
          await expressRouteTester.linkBankAccount({
            accountNumber: args[2],
            routingNumber: args[3],
          });
        } else if (sub === 'link-receipt') {
          await expressRouteTester.linkReceiptAddress({
            chain: args[2] ?? 'ETH',
            currency: args[3] ?? 'USD',
          });
        } else if (sub === 'mock-deposit') {
          if (!args[2]) {
            console.error('Usage: express-route mock-deposit <trackingRef> [amount] [accountNumber]');
            process.exit(1);
          }
          await expressRouteTester.initiateMockDeposit({
            trackingRef: args[2],
            amount: args[3],
            accountNumber: args[4],
          });
        } else if (sub === 'onchain-deposit') {
          if (!args[2]) {
            console.error('Usage: express-route onchain-deposit <address> [chain] [amount]');
            process.exit(1);
          }
          await expressRouteTester.initiateOnChainDeposit({
            address: args[2],
            chain: args[3],
            amount: args[4],
          });
        } else if (sub === 'transfer') {
          if (!args[2]) {
            console.error('Usage: express-route transfer <recipient-id> [amount] [currency]');
            process.exit(1);
          }
          await expressRouteTester.initiateOnChainTransfer({
            recipientId: args[2],
            amount: args[3],
            currency: (args[4] as 'USD' | 'EUR' | 'BTC' | 'ETH') ?? 'USD',
          });
        } else if (sub === 'withdraw') {
          if (!args[2]) {
            console.error('Usage: express-route withdraw <bank-account-id> [amount] [currency]');
            process.exit(1);
          }
          await expressRouteTester.initiateWithdrawal({
            bankAccountId: args[2],
            amount: args[3],
            currency: (args[4] as 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL') ?? 'USD',
          });
        } else if (sub === 'create') {
          if (!args[2] || !args[3]) {
            console.error('Usage: express-route create <receipt-address-id> <bank-account-id>');
            process.exit(1);
          }
          await expressRouteTester.createExpressRoute({
            receiptAddressId: args[2],
            bankAccountId: args[3],
            destinationType: (args[4] as 'wire' | 'sepa' | 'sepa_instant') ?? 'wire',
            currency: (args[5] as 'USD' | 'EUR') ?? 'USD',
          });
        } else if (sub === 'run') {
          await expressRouteTester.runFullFlow({
            chain: args[2],
            amount: args[3],
            existingBankId: args[4],
            existingDepositAddressId: args[5],
            existingDepositAddress: args[6],
            existingRecipientId: args[7],
          });
        } else {
          console.error(`Unknown express-route sub-command: ${sub}`);
          console.error('Run: npm run dev express-route help');
          process.exit(1);
        }
        break;
      }

      case 'all':
        await tester.runAllTests();
        break;

      case undefined:
        console.log('ℹ️  Running development test flow (check balance -> deposit address -> auto transfer)...');
        const transferTester = new AccountAndTransferTester();
        await transferTester.runTestFlow({
          autoTest: true,
          blockchain: 'ETH'
        });
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
        console.log('  withdraw             - Withdraw to bank account (see: withdraw help)');
        console.log('  express-route        - Express route flow (auto-redeem on-chain USDC to fiat)');
        console.log('\nExample:');
        console.log('  npm run dev account');
        console.log('  npm run dev deposits create ETH');
        console.log('  npm run dev payouts create 0x123... ETH 1000000 USDC');
        console.log('  npm run dev withdraw list-banks');
        console.log('  npm run dev withdraw <bank-id> 100.00 USD');
        console.log('  npm run dev express-route run');
        console.log('  npm run dev express-route help');
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
