# Circle Mint Testing App

A testing application for Circle Mint APIs using Circle MCP. This app allows you to test various Circle Mint operations including account management, deposits, payouts, and balance queries.

## Overview

Circle Mint is Circle's platform for institutional customers to mint and redeem USDC and EURC. This testing app provides a CLI interface to interact with Circle Mint APIs for development and testing purposes.

**Learn more:** 
- [Circle Mint Documentation](https://developers.circle.com/circle-mint/introducing-circle-mint)
- [Getting Started with Circle APIs](https://developers.circle.com/circle-mint/getting-started-with-the-circle-apis)

## API Authentication

This app uses Bearer token authentication as specified in the [Circle Mint Getting Started Guide](https://developers.circle.com/circle-mint/getting-started-with-the-circle-apis):

```text
Authorization: Bearer YOUR_API_KEY
```

All requests are made over HTTPS as required by Circle APIs.

## Prerequisites

- Node.js 18+ installed
- A Circle Developer Console account
- Circle Mint API key (sandbox or production)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create a Sandbox Account:**
   If you don't have a sandbox account yet, create one at:
   - [Circle Sandbox Signup](https://app-sandbox.circle.com/signup)
   - Or visit: [https://app-sandbox.circle.com/](https://app-sandbox.circle.com/)

3. **Configure environment:**
   Create a `.env` file in the root directory:
   ```env
   CIRCLE_API_KEY=your_api_key_here
   CIRCLE_ENV=sandbox
   ```

   Get your API key from the [Circle Developer Console](https://console.circle.com).
   
   **Important Security Notes:**
   - API requests without authentication will fail
   - All API requests must be made over HTTPS
   - Keep API keys secure at all times
   - Never commit API keys to version control
   - Never expose API keys in client-side code

3. **Build the project:**
   ```bash
   npm run build
   ```

## Usage

### Run all tests:
```bash
npm run dev all
# or
npm start all
```

### Individual commands:

**Get account information:**
```bash
npm run dev account
```

**Get account balance:**
```bash
npm run dev balance
```

**Get supported chains:**
```bash
npm run dev chains
```

**List deposit addresses:**
```bash
npm run dev deposits
# or
npm run dev deposits addresses
```

**Create deposit address:**
```bash
npm run dev deposits create ETH
```

**List deposits:**
```bash
npm run dev deposits list
```

**List payouts:**
```bash
npm run dev payouts
# or
npm run dev payouts list
```

**Create payout (withdrawal):**
```bash
npm run dev payouts create <address> <chain> <amount> [currency]
# Example:
npm run dev payouts create 0x123... ETH 1000000 USDC
```

### Account & Transfer Commands

**Check account balance:**
```bash
npm run account balance
```

**Create deposit address:**
```bash
npm run account deposit-address ETH
```

**Create a transfer (payout):**
```bash
npm run account transfer <address> <chain> <amount> [currency]
# Example: Transfer 1 USDC to an Ethereum address
npm run account transfer 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb ETH 1000000 USDC
```

**Check transfer status:**
```bash
npm run account status <payout-id>
```

**Create business payout (fiat offramp):**
```bash
npm run account business-payout <type> <bank-account-id> <amount> <currency> [wallet-id]
# Example: Convert USDC to USD and send to bank account
npm run account business-payout wire <bank-account-id> 100.00 USD
```

**List business payouts:**
```bash
npm run account business-payouts [status]
# Example: List only pending payouts
npm run account business-payouts pending
```

**Check business payout status:**
```bash
npm run account business-status <payout-id>
```

**Run demo:**
```bash
npm run demo
```

## Available Test Functions

The app includes the following test functions:

- ✅ Get account balance (using business account endpoints)
- ✅ Get supported chains and currencies
- ✅ List deposit addresses (Crypto Deposits API)
- ✅ Create deposit addresses
- ✅ List deposits
- ✅ List payouts (Crypto Payouts API)
- ✅ Create payouts (withdrawals)

**Note:** The Accounts API was deprecated in December 2024. The app now uses business account endpoints where applicable.

## Supported Blockchains

Circle Mint supports USDC and EURC on multiple blockchains including:

- Ethereum
- Polygon
- Base
- Arbitrum
- Avalanche
- Optimism
- And many more...

See the [Circle Mint Supported Chains](https://developers.circle.com/circle-mint/supported-chains-and-currencies) documentation for the complete list.

## API Reference

For detailed API documentation, visit:
- [Circle Mint API Reference](https://developers.circle.com/api-reference/circle-mint)

## Development

**Run in development mode:**
```bash
npm run dev <command>
```

**Run tests:**
```bash
npm test
```

**Build for production:**
```bash
npm run build
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `CIRCLE_API_KEY` | Your Circle API key | Yes | - |
| `CIRCLE_ENV` | Environment: `sandbox` or `production` | No | `sandbox` |
| `CIRCLE_BASE_URL` | Custom API base URL | No | Auto-detected |

## Getting Test Funds

For testing in the sandbox environment, you can get test funds from:

1. **Circle Public Faucet:** [https://faucet.circle.com](https://faucet.circle.com) - Get testnet USDC (once per hour)
2. **Circle Developer Console:** Access the Console Faucet if you're using Developer Services
3. **Sandbox Bank Deposits:** Simulate bank deposits through the Circle Console

See [TEST_FUNDS_GUIDE.md](./TEST_FUNDS_GUIDE.md) for detailed instructions.

## Account Creation and Transfers

### Creating an Account

Circle Mint accounts are created through the [Circle Developer Console](https://console.circle.com), not via API. Once you have an account:

1. Log in to the Circle Developer Console
2. Navigate to your account settings
3. Complete any required verification steps
4. Generate an API key for sandbox or production

### Making Test Transfers

There are two types of payouts available:

#### 1. Crypto Payouts (On-chain Transfers)

Send USDC/EURC to blockchain addresses:

1. **Check your balance:**
   ```bash
   npm run account balance
   ```

2. **Create a crypto transfer:**
   ```bash
   npm run account transfer <recipient-address> <chain> <amount> [currency]
   ```
   
   Example:
   ```bash
   npm run account transfer 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb ETH 1000000 USDC
   ```
   
   **Important:**
   - Amount is in smallest units: `1000000` = 1 USDC (6 decimals)
   - Chain identifiers: `ETH`, `MATIC`, `AVAX`, `BASE`, `ARB`, etc.
   - You need sufficient balance in your Circle Mint account
   - Transfers may require account verification

3. **Check transfer status:**
   ```bash
   npm run account status <payout-id>
   ```

#### 2. Business Payouts (Fiat Offramp)

Convert digital assets to fiat currency and send to bank accounts. Reference: [Create Business Payout API](https://developers.circle.com/api-reference/circle-mint/account/create-business-payout)

1. **Create a business payout:**
   ```bash
   npm run account business-payout <type> <bank-account-id> <amount> <currency> [wallet-id]
   ```
   
   Example:
   ```bash
   npm run account business-payout wire <bank-account-id> 100.00 USD
   ```
   
   **Important:**
   - Amount is in fiat format: `"100.00"` = 100.00 USD
   - Destination types: `wire`, `cubix`, `pix`, `sepa`, `sepa_instant`
   - Supported currencies: `USD`, `EUR`, `MXN`, `SGD`, `BRL`
   - You need a bank account ID (created through Circle Console)
   - Converts your digital assets (USDC/EURC) to fiat currency

2. **List business payouts:**
   ```bash
   npm run account business-payouts [status]
   ```

3. **Check business payout status:**
   ```bash
   npm run account business-status <payout-id>
   ```

### Amount Format

USDC uses 6 decimal places:
- `1000000` = 1.0 USDC
- `100000` = 0.1 USDC
- `10000` = 0.01 USDC

## Notes

- This is a testing application. Use sandbox environment for development.
- Actual payouts require valid addresses and sufficient account balance.
- All API requests are authenticated using Bearer token authentication.
- The app uses Circle Mint REST APIs directly.
- **Crypto Deposits API**: Some deposit endpoints may return 404 if the Crypto Deposits API is not enabled for your account. This feature may require additional setup or account configuration. See the [Crypto Payments Quickstart](https://developers.circle.com/circle-mint/crypto-payments-quickstart) for more information.
- **Account Creation**: Accounts must be created through the Circle Developer Console, not via API.

## Entity Secret Setup (Circle Wallets)

To use Circle Developer-Controlled Wallets features, you need to generate and register an Entity Secret:

1. **Install the SDK:**
   ```bash
   npm install @circle-fin/developer-controlled-wallets
   ```

2. **Generate and register Entity Secret:**
   ```bash
   npm run entity-secret generate-and-register
   ```

3. **Add to .env:**
   ```env
   ENTITY_SECRET=your_entity_secret_here
   ```

See [ENTITY_SECRET_GUIDE.md](./ENTITY_SECRET_GUIDE.md) for detailed instructions.

**Reference:** [Circle Wallets Entity Secret Documentation](https://developers.circle.com/wallets/dev-controlled/register-entity-secret)

## Resources

- [Circle Mint Documentation](https://developers.circle.com/circle-mint/introducing-circle-mint)
- [Getting Started with Circle APIs](https://developers.circle.com/circle-mint/getting-started-with-the-circle-apis)
- [Circle Developer Console](https://console.circle.com)
- [Circle Sandbox Signup](https://app-sandbox.circle.com/signup)
- [Circle SDKs](https://developers.circle.com/circle-mint/circle-sdks)
- [Circle MCP Server](https://developers.circle.com/ai/mcp)
- [Circle Mint API Reference](https://developers.circle.com/api-reference/circle-mint)

## License

MIT
