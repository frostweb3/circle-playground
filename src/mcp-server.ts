#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CircleMintClient } from './circle-mint-client.js';
import { AccountAndTransferTester } from './account-and-transfers.js';
import { ExpressRouteTester } from './express-route.js';
import crypto from 'crypto';

const client = new CircleMintClient();
const accountTester = new AccountAndTransferTester();
const expressRouteTester = new ExpressRouteTester();

const server = new Server(
  { name: 'circle-mint', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ──────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Overview ──────────────────────────────────────────────────────────
    {
      name: 'get_wallets',
      description: 'Get Circle account identity — returns entity ID, wallet ID, and account type.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_balance',
      description: 'Get the Circle business account balance.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_supported_chains',
      description: 'Get supported blockchains and currencies.',
      inputSchema: { type: 'object', properties: {} },
    },

    // ── Deposits ──────────────────────────────────────────────────────────
    {
      name: 'list_deposits',
      description: 'List incoming deposits.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'list_deposit_addresses',
      description: 'List business on-chain deposit addresses.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'create_deposit_address',
      description: 'Create a new on-chain deposit address for a given blockchain.',
      inputSchema: {
        type: 'object',
        required: ['chain'],
        properties: {
          chain: {
            type: 'string',
            description: 'Blockchain to create the address on.',
            enum: ['ETH', 'MATIC', 'AVAX', 'BASE', 'ARB', 'SOL', 'BTC'],
          },
          currency: {
            type: 'string',
            description: 'Currency (default: USD).',
            default: 'USD',
          },
        },
      },
    },

    // ── Address Book ──────────────────────────────────────────────────────
    {
      name: 'list_address_book',
      description: 'List address book recipients for crypto payouts.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'add_address_book_recipient',
      description: 'Add an address to the address book. Required before sending a crypto payout to that address.',
      inputSchema: {
        type: 'object',
        required: ['chain', 'address'],
        properties: {
          chain: {
            type: 'string',
            description: 'Blockchain.',
            enum: ['ETH', 'MATIC', 'AVAX', 'BASE', 'ARB', 'SOL', 'BTC'],
          },
          address: { type: 'string', description: 'Blockchain address.' },
          nickname: { type: 'string', description: 'Optional display name.' },
          email: { type: 'string', description: 'Optional contact email.' },
          addressTag: { type: 'string', description: 'Optional tag/memo (for XLM, HBAR, etc.).' },
        },
      },
    },
    {
      name: 'delete_address_book_recipient',
      description: 'Remove a recipient from the address book.',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Address book recipient UUID.' },
        },
      },
    },

    // ── Payouts ───────────────────────────────────────────────────────────
    {
      name: 'list_payouts',
      description: 'List crypto payouts.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'create_payout',
      description: 'Send a crypto payout (USDC or EURC) to an address book recipient.',
      inputSchema: {
        type: 'object',
        required: ['recipientId', 'amount'],
        properties: {
          recipientId: { type: 'string', description: 'Address book recipient UUID.' },
          amount: { type: 'string', description: 'Amount as a string (e.g. "1.00").' },
          currency: {
            type: 'string',
            description: 'Currency — USD sends USDC, EUR sends EURC (default: USD).',
            enum: ['USD', 'EUR'],
            default: 'USD',
          },
        },
      },
    },

    // ── Wire Bank Accounts ────────────────────────────────────────────────
    {
      name: 'list_wire_accounts',
      description: 'List wire bank accounts.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'create_wire_account',
      description: 'Create a wire bank account. Uses sandbox-safe defaults if fields are omitted.',
      inputSchema: {
        type: 'object',
        properties: {
          accountNumber: { type: 'string', description: 'Bank account number (default: 12340010).' },
          routingNumber: { type: 'string', description: 'ABA routing number (default: 121000248).' },
          billingName: { type: 'string', description: 'Account holder name (default: Satoshi Nakamoto).' },
        },
      },
    },
    {
      name: 'get_wire_instructions',
      description: 'Get wire transfer instructions for a bank account, including the tracking reference and beneficiary account number needed to simulate deposits.',
      inputSchema: {
        type: 'object',
        required: ['bankAccountId'],
        properties: {
          bankAccountId: { type: 'string', description: 'Wire bank account UUID.' },
        },
      },
    },
    {
      name: 'mock_wire_deposit',
      description: 'Simulate an incoming wire deposit (sandbox only). Use get_wire_instructions to obtain trackingRef and accountNumber.',
      inputSchema: {
        type: 'object',
        required: ['trackingRef', 'accountNumber'],
        properties: {
          trackingRef: { type: 'string', description: 'Tracking reference from wire instructions.' },
          amount: { type: 'string', description: 'USD amount (default: 100.00).' },
          accountNumber: { type: 'string', description: 'Beneficiary account number from wire instructions.' },
        },
      },
    },
    {
      name: 'business_payout',
      description: 'Withdraw funds to a wire bank account (fiat offramp).',
      inputSchema: {
        type: 'object',
        required: ['bankId', 'amount'],
        properties: {
          bankId: { type: 'string', description: 'Wire bank account UUID.' },
          amount: { type: 'string', description: 'Amount (e.g. "100.00").' },
          currency: {
            type: 'string',
            description: 'Currency (default: USD).',
            enum: ['USD', 'EUR', 'MXN', 'SGD', 'BRL'],
            default: 'USD',
          },
        },
      },
    },

    // ── Recipients & Transfers ────────────────────────────────────────────
    {
      name: 'list_recipients',
      description: 'List verified recipient addresses for business transfers.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'create_recipient',
      description: 'Register a blockchain address as a verified recipient for business transfers.',
      inputSchema: {
        type: 'object',
        required: ['chain', 'address', 'description'],
        properties: {
          chain: {
            type: 'string',
            description: 'Blockchain.',
            enum: ['ETH', 'MATIC', 'AVAX', 'BASE', 'ARB', 'SOL'],
          },
          address: { type: 'string', description: 'Blockchain address.' },
          description: { type: 'string', description: 'Label for this recipient.' },
          addressTag: { type: 'string', description: 'Optional tag/memo.' },
        },
      },
    },
    {
      name: 'business_transfer',
      description: 'Send an on-chain business transfer to a verified recipient address.',
      inputSchema: {
        type: 'object',
        required: ['recipientId', 'amount'],
        properties: {
          recipientId: { type: 'string', description: 'Verified recipient address UUID.' },
          amount: { type: 'string', description: 'Amount (default: 1.00).' },
          currency: {
            type: 'string',
            description: 'Currency (default: USD).',
            enum: ['USD', 'EUR', 'BTC', 'ETH'],
            default: 'USD',
          },
        },
      },
    },

    // ── Notifications ─────────────────────────────────────────────────────
    {
      name: 'list_subscriptions',
      description: 'List Circle webhook notification subscriptions.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'create_subscription',
      description: 'Subscribe to Circle webhook notifications. The endpoint must be a publicly accessible HTTPS URL.',
      inputSchema: {
        type: 'object',
        required: ['endpoint'],
        properties: {
          endpoint: { type: 'string', description: 'Public HTTPS URL to receive webhooks.' },
        },
      },
    },
    {
      name: 'delete_subscription',
      description: 'Delete a webhook notification subscription.',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Subscription UUID.' },
        },
      },
    },

    // ── Express Route ─────────────────────────────────────────────────────
    {
      name: 'express_route_link_bank',
      description: 'Express Route Step 1: Link a wire bank account as the fiat destination.',
      inputSchema: {
        type: 'object',
        properties: {
          accountNumber: { type: 'string', description: 'Account number (default: 12340010).' },
          routingNumber: { type: 'string', description: 'Routing number (default: 121000248).' },
        },
      },
    },
    {
      name: 'express_route_link_receipt',
      description: 'Express Route Step 2: Create an on-chain receipt address for incoming USDC.',
      inputSchema: {
        type: 'object',
        properties: {
          chain: {
            type: 'string',
            description: 'Blockchain (default: ETH).',
            enum: ['ETH', 'MATIC', 'AVAX', 'BASE', 'ARB', 'SOL'],
            default: 'ETH',
          },
          currency: { type: 'string', description: 'Currency (default: USD).', default: 'USD' },
        },
      },
    },
    {
      name: 'express_route_mock_deposit',
      description: 'Express Route Step 3: Simulate an incoming wire deposit (sandbox). Obtain trackingRef and accountNumber from get_wire_instructions.',
      inputSchema: {
        type: 'object',
        required: ['trackingRef', 'accountNumber'],
        properties: {
          trackingRef: { type: 'string', description: 'Tracking reference from wire instructions.' },
          amount: { type: 'string', description: 'Amount (default: 100.00).' },
          accountNumber: { type: 'string', description: 'Beneficiary account number.' },
        },
      },
    },
    {
      name: 'express_route_onchain_deposit',
      description: 'Express Route Step 4: Simulate an on-chain USDC deposit to the receipt address (sandbox).',
      inputSchema: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string', description: 'Receipt deposit address.' },
          chain: { type: 'string', description: 'Blockchain (default: ETH).', default: 'ETH' },
          amount: { type: 'string', description: 'Amount in USD (default: 10.00).', default: '10.00' },
        },
      },
    },
    {
      name: 'express_route_transfer',
      description: 'Express Route Step 5: Send an on-chain business transfer to a verified recipient.',
      inputSchema: {
        type: 'object',
        required: ['recipientId'],
        properties: {
          recipientId: { type: 'string', description: 'Verified recipient address UUID.' },
          amount: { type: 'string', description: 'Amount (default: 1.00).', default: '1.00' },
          currency: {
            type: 'string',
            description: 'Currency (default: USD).',
            enum: ['USD', 'EUR', 'BTC', 'ETH'],
            default: 'USD',
          },
        },
      },
    },
    {
      name: 'express_route_withdraw',
      description: 'Express Route Step 6: Withdraw USDC to bank as fiat (offramp).',
      inputSchema: {
        type: 'object',
        required: ['bankAccountId'],
        properties: {
          bankAccountId: { type: 'string', description: 'Wire bank account UUID.' },
          amount: { type: 'string', description: 'Amount (default: 10.00).', default: '10.00' },
          currency: {
            type: 'string',
            description: 'Currency (default: USD).',
            enum: ['USD', 'EUR', 'MXN', 'SGD', 'BRL'],
            default: 'USD',
          },
        },
      },
    },
    {
      name: 'express_route_create',
      description: 'Express Route Step 7: Bind a receipt address to a bank account so incoming USDC is automatically redeemed to fiat.',
      inputSchema: {
        type: 'object',
        required: ['receiptAddressId', 'bankAccountId'],
        properties: {
          receiptAddressId: { type: 'string', description: 'Deposit address UUID.' },
          bankAccountId: { type: 'string', description: 'Wire bank account UUID.' },
          destinationType: {
            type: 'string',
            description: 'Destination type (default: wire).',
            enum: ['wire', 'sepa', 'sepa_instant'],
            default: 'wire',
          },
          currency: {
            type: 'string',
            description: 'Currency (default: USD).',
            enum: ['USD', 'EUR'],
            default: 'USD',
          },
        },
      },
    },
    {
      name: 'express_route_run_full',
      description: 'Run the complete Express Route flow (all 7 steps) end-to-end.',
      inputSchema: {
        type: 'object',
        properties: {
          chain: { type: 'string', description: 'Blockchain (default: ETH).', default: 'ETH' },
          amount: { type: 'string', description: 'Deposit amount (default: 10.00).', default: '10.00' },
        },
      },
    },
  ],
}));

// ─── Tool call handler ─────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      // Overview
      case 'get_wallets':
        result = await client.getWallets();
        break;
      case 'get_balance':
        result = await client.getBalance();
        break;
      case 'get_supported_chains':
        result = await client.getSupportedChains();
        break;

      // Deposits
      case 'list_deposits':
        result = await client.listDeposits();
        break;
      case 'list_deposit_addresses':
        result = await client.listBusinessDepositAddresses();
        break;
      case 'create_deposit_address':
        result = await accountTester.createDepositAddress({
          chain: args?.chain as string,
          currency: (args?.currency as string) ?? 'USD',
        });
        break;

      // Address book
      case 'list_address_book':
        result = await client.listAddressBookRecipients();
        break;
      case 'add_address_book_recipient':
        result = await client.createAddressBookRecipient({
          idempotencyKey: crypto.randomUUID(),
          chain: args?.chain as string,
          address: args?.address as string,
          ...(args?.addressTag && { addressTag: args.addressTag as string }),
          metadata: {
            ...(args?.nickname && { nickname: args.nickname as string }),
            ...(args?.email && { email: args.email as string }),
          },
        });
        break;
      case 'delete_address_book_recipient':
        result = await client.deleteAddressBookRecipient(args?.id as string);
        break;

      // Payouts
      case 'list_payouts':
        result = await client.listPayouts();
        break;
      case 'create_payout':
        result = await client.createPayout({
          idempotencyKey: crypto.randomUUID(),
          destination: { type: 'address_book', id: args?.recipientId as string },
          amount: {
            amount: parseFloat(args?.amount as string).toFixed(2),
            currency: (args?.currency as 'USD' | 'EUR') ?? 'USD',
          },
        });
        break;

      // Wire accounts
      case 'list_wire_accounts':
        result = await client.listWireBankAccounts();
        break;
      case 'create_wire_account':
        result = await accountTester.createWireBankAccount({
          accountNumber: args?.accountNumber as string | undefined,
          routingNumber: args?.routingNumber as string | undefined,
          billingName: args?.billingName as string | undefined,
        });
        break;
      case 'get_wire_instructions':
        result = await client.getWireBankAccountInstructions(args?.bankAccountId as string);
        break;
      case 'mock_wire_deposit':
        result = await accountTester.createMockWirePayment({
          trackingRef: args?.trackingRef as string,
          amount: (args?.amount as string) ?? '100.00',
          accountNumber: args?.accountNumber as string,
        });
        break;
      case 'business_payout':
        result = await accountTester.createBusinessPayout({
          destinationType: 'wire',
          destinationId: args?.bankId as string,
          amount: parseFloat(args?.amount as string).toFixed(2),
          currency: (args?.currency as 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL') ?? 'USD',
        });
        break;

      // Recipients & Transfers
      case 'list_recipients':
        result = await accountTester.listRecipientAddresses();
        break;
      case 'create_recipient':
        result = await accountTester.createRecipientAddress({
          chain: args?.chain as string,
          address: args?.address as string,
          description: args?.description as string,
          addressTag: args?.addressTag as string | undefined,
        });
        break;
      case 'business_transfer':
        result = await accountTester.createBusinessTransfer({
          recipientId: args?.recipientId as string,
          amount: (args?.amount as string) ?? '1.00',
          currency: (args?.currency as 'USD' | 'EUR' | 'BTC' | 'ETH') ?? 'USD',
        });
        break;

      // Notifications
      case 'list_subscriptions':
        result = await client.listSubscriptions();
        break;
      case 'create_subscription':
        result = await client.createSubscription(args?.endpoint as string);
        break;
      case 'delete_subscription':
        result = await client.deleteSubscription(args?.id as string);
        break;

      // Express Route
      case 'express_route_link_bank':
        result = await expressRouteTester.linkBankAccount({
          accountNumber: args?.accountNumber as string | undefined,
          routingNumber: args?.routingNumber as string | undefined,
        });
        break;
      case 'express_route_link_receipt':
        result = await expressRouteTester.linkReceiptAddress({
          chain: (args?.chain as string) ?? 'ETH',
          currency: (args?.currency as string) ?? 'USD',
        });
        break;
      case 'express_route_mock_deposit':
        result = await expressRouteTester.initiateMockDeposit({
          trackingRef: args?.trackingRef as string,
          amount: args?.amount as string | undefined,
          accountNumber: args?.accountNumber as string | undefined,
        });
        break;
      case 'express_route_onchain_deposit':
        result = await expressRouteTester.initiateOnChainDeposit({
          address: args?.address as string,
          chain: args?.chain as string | undefined,
          amount: args?.amount as string | undefined,
        });
        break;
      case 'express_route_transfer':
        result = await expressRouteTester.initiateOnChainTransfer({
          recipientId: args?.recipientId as string,
          amount: args?.amount as string | undefined,
          currency: args?.currency as 'USD' | 'EUR' | 'BTC' | 'ETH' | undefined,
        });
        break;
      case 'express_route_withdraw':
        result = await expressRouteTester.initiateWithdrawal({
          bankAccountId: args?.bankAccountId as string,
          amount: args?.amount as string | undefined,
          currency: args?.currency as 'USD' | 'EUR' | 'MXN' | 'SGD' | 'BRL' | undefined,
        });
        break;
      case 'express_route_create':
        result = await expressRouteTester.createExpressRoute({
          receiptAddressId: args?.receiptAddressId as string,
          bankAccountId: args?.bankAccountId as string,
          destinationType: args?.destinationType as 'wire' | 'sepa' | 'sepa_instant' | undefined,
          currency: args?.currency as 'USD' | 'EUR' | undefined,
        });
        break;
      case 'express_route_run_full':
        await expressRouteTester.runFullFlow({
          chain: args?.chain as string | undefined,
          amount: args?.amount as string | undefined,
        });
        result = { message: 'Express Route full flow completed successfully' };
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('Circle Mint MCP server running on stdio\n');
