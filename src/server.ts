#!/usr/bin/env node

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { CircleMintClient } from './circle-mint-client.js';
import { AccountAndTransferTester } from './account-and-transfers.js';
import { ExpressRouteTester } from './express-route.js';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── SSE clients for real-time webhook events ─────────────────────────────

type SseClient = { id: string; res: Response };
const sseClients: SseClient[] = [];

function pushEvent(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => c.res.write(payload));
}

app.get('/api/events', (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  const client: SseClient = { id: crypto.randomUUID(), res };
  sseClients.push(client);

  res.write(`event: connected\ndata: ${JSON.stringify({ id: client.id })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex(c => c.id === client.id);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// ─── Webhook receiver (Circle → your server) ─────────────────────────────

app.head('/webhooks', (_req: Request, res: Response) => {
  // Circle sends a HEAD request to verify the endpoint
  res.sendStatus(200);
});

app.post('/webhooks', (req: Request, res: Response) => {
  const body = req.body;
  pushEvent('notification', {
    timestamp: new Date().toISOString(),
    payload: body,
  });
  res.sendStatus(200);
});

// ─── Utility: capture console output from tester methods ─────────────────

interface RunResult {
  logs: string[];
  data: unknown;
  error?: string;
}

async function run(fn: () => Promise<unknown>): Promise<RunResult> {
  const logs: string[] = [];
  const orig = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
  };

  const capture = (prefix: string) => (...args: unknown[]) => {
    const msg = args
      .map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 2)))
      .join(' ');
    logs.push(prefix + msg);
    orig.log(prefix + msg);
  };

  console.log = capture('');
  console.error = capture('[ERR] ');
  console.warn = capture('[WARN] ');

  try {
    const data = await fn();
    Object.assign(console, orig);
    return { logs, data };
  } catch (err: unknown) {
    Object.assign(console, orig);
    const message = err instanceof Error ? err.message : String(err);
    return { logs, data: null, error: message };
  }
}

// ─── Route helpers ────────────────────────────────────────────────────────

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

async function send(res: Response, result: RunResult) {
  if (result.error) {
    res.status(400).json(result);
  } else {
    res.json(result);
  }
}

// ─── Overview ─────────────────────────────────────────────────────────────

app.get('/api/account', asyncHandler(async (_req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.getWallets()));
}));

app.get('/api/balance', asyncHandler(async (_req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.getBalance()));
}));

app.get('/api/chains', asyncHandler(async (_req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.getSupportedChains()));
}));

// ─── Deposits ─────────────────────────────────────────────────────────────

app.get('/api/deposits', asyncHandler(async (_req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.listDeposits()));
}));

app.get('/api/deposits/addresses', asyncHandler(async (_req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.listBusinessDepositAddresses()));
}));

app.post('/api/deposits/addresses', asyncHandler(async (req, res) => {
  const { chain, currency = 'USD' } = req.body;
  const tester = new AccountAndTransferTester();
  await send(res, await run(() => tester.createDepositAddress({ chain, currency })));
}));

// ─── Payouts ──────────────────────────────────────────────────────────────

// Address book routes MUST come before /api/payouts to avoid prefix conflicts
app.get('/api/payouts/address-book', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const client = new CircleMintClient();
    await send(res, await run(() => client.listAddressBookRecipients()));
  } catch (err) { next(err); }
});

app.post('/api/payouts/address-book', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chain, address, addressTag, nickname, email } = req.body;
    const client = new CircleMintClient();
    await send(res, await run(() => client.createAddressBookRecipient({
      idempotencyKey: crypto.randomUUID(),
      chain,
      address,
      ...(addressTag && { addressTag }),
      metadata: {
        ...(nickname && { nickname }),
        ...(email && { email }),
      },
    })));
  } catch (err) { next(err); }
});

app.delete('/api/payouts/address-book/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = new CircleMintClient();
    await send(res, await run(() => client.deleteAddressBookRecipient(req.params.id as string)));
  } catch (err) { next(err); }
});

app.get('/api/payouts', asyncHandler(async (_req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.listPayouts()));
}));

app.post('/api/payouts', asyncHandler(async (req, res) => {
  const { recipientId, amount, currency = 'USD' } = req.body;
  // Ensure exactly 2 decimal places ("1" → "1.00")
  const formattedAmount = parseFloat(amount).toFixed(2);
  const client = new CircleMintClient();
  await send(res, await run(() => client.createPayout({
    idempotencyKey: crypto.randomUUID(),
    destination: { type: 'address_book', id: recipientId },
    amount: { amount: formattedAmount, currency },
  })));
}));

// ─── Wire Bank Accounts ───────────────────────────────────────────────────

app.get('/api/banks/wires', asyncHandler(async (_req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.listWireBankAccounts()));
}));

app.post('/api/banks/wires', asyncHandler(async (_req, res) => {
  const tester = new AccountAndTransferTester();
  await send(res, await run(() => tester.createWireBankAccount()));
}));

app.get('/api/banks/wires/:id/instructions', asyncHandler(async (req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.getWireBankAccountInstructions(req.params.id as string)));
}));

app.post('/api/mocks/wire', asyncHandler(async (req, res) => {
  const { trackingRef, amount = '100.00', accountNumber } = req.body;
  const tester = new AccountAndTransferTester();
  await send(res, await run(() => tester.createMockWirePayment({ trackingRef, amount, accountNumber })));
}));

app.post('/api/payouts/wire', asyncHandler(async (req, res) => {
  const { bankId, amount, currency = 'USD' } = req.body;
  const tester = new AccountAndTransferTester();
  await send(res, await run(() => tester.createBusinessPayout({
    destinationType: 'wire',
    destinationId: bankId,
    amount: parseFloat(amount).toFixed(2),
    currency,
  })));
}));

// ─── Recipients & Transfers ───────────────────────────────────────────────

app.get('/api/recipients', asyncHandler(async (_req, res) => {
  const tester = new AccountAndTransferTester();
  await send(res, await run(() => tester.listRecipientAddresses()));
}));

app.post('/api/recipients', asyncHandler(async (req, res) => {
  const { chain, address, description, addressTag } = req.body;
  const tester = new AccountAndTransferTester();
  await send(res, await run(() => tester.createRecipientAddress({ chain, address, description, addressTag })));
}));

app.post('/api/transfers/business', asyncHandler(async (req, res) => {
  const { recipientId, amount = '1.00', currency = 'USD' } = req.body;
  const tester = new AccountAndTransferTester();
  await send(res, await run(() => tester.createBusinessTransfer({ recipientId, amount, currency })));
}));

// ─── Express Route steps ──────────────────────────────────────────────────

app.post('/api/express-route/link-bank', asyncHandler(async (req, res) => {
  const { accountNumber, routingNumber } = req.body;
  const tester = new ExpressRouteTester();
  await send(res, await run(() => tester.linkBankAccount({ accountNumber, routingNumber })));
}));

app.post('/api/express-route/link-receipt', asyncHandler(async (req, res) => {
  const { chain = 'ETH', currency = 'USD' } = req.body;
  const tester = new ExpressRouteTester();
  await send(res, await run(() => tester.linkReceiptAddress({ chain, currency })));
}));

app.post('/api/express-route/mock-deposit', asyncHandler(async (req, res) => {
  const { trackingRef, amount, accountNumber } = req.body;
  const tester = new ExpressRouteTester();
  await send(res, await run(() => tester.initiateMockDeposit({ trackingRef, amount, accountNumber })));
}));

app.post('/api/express-route/onchain-deposit', asyncHandler(async (req, res) => {
  const { address, chain, amount } = req.body;
  const tester = new ExpressRouteTester();
  await send(res, await run(() => tester.initiateOnChainDeposit({ address, chain, amount })));
}));

app.post('/api/express-route/transfer', asyncHandler(async (req, res) => {
  const { recipientId, amount, currency } = req.body;
  const tester = new ExpressRouteTester();
  await send(res, await run(() => tester.initiateOnChainTransfer({ recipientId, amount, currency })));
}));

app.post('/api/express-route/withdraw', asyncHandler(async (req, res) => {
  const { bankAccountId, amount, currency } = req.body;
  const tester = new ExpressRouteTester();
  await send(res, await run(() => tester.initiateWithdrawal({ bankAccountId, amount, currency })));
}));

app.post('/api/express-route/create', asyncHandler(async (req, res) => {
  const { receiptAddressId, bankAccountId, destinationType, currency } = req.body;
  const tester = new ExpressRouteTester();
  await send(res, await run(() => tester.createExpressRoute({ receiptAddressId, bankAccountId, destinationType, currency })));
}));

app.post('/api/express-route/run', asyncHandler(async (req, res) => {
  const { chain, amount } = req.body;
  const tester = new ExpressRouteTester();
  await send(res, await run(() => tester.runFullFlow({ chain, amount })));
}));

// ─── Notifications ────────────────────────────────────────────────────────

app.get('/api/notifications/subscriptions', asyncHandler(async (_req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.listSubscriptions()));
}));

app.post('/api/notifications/subscriptions', asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  const client = new CircleMintClient();
  await send(res, await run(() => client.createSubscription(endpoint)));
}));

app.delete('/api/notifications/subscriptions/:id', asyncHandler(async (req, res) => {
  const client = new CircleMintClient();
  await send(res, await run(() => client.deleteSubscription(req.params.id as string)));
}));

// ─── JSON 404 fallback for unmatched /api routes ──────────────────────────

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API route not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  Circle Mint Dashboard                    ║`);
  console.log(`║  http://localhost:${PORT}                    ║`);
  console.log(`╚═══════════════════════════════════════════╝`);
  console.log(`\nEnvironment: ${config.environment}`);
  console.log(`Circle API:  ${config.baseUrl}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhooks\n`);
});
