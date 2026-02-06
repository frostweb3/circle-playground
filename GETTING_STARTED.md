# Getting Started with Circle Mint Testing App

This guide is based on the [Circle Mint Getting Started Documentation](https://developers.circle.com/circle-mint/getting-started-with-the-circle-apis).

## Quick Start

### 1. Create a Sandbox Account

If you don't have a sandbox account yet:
- Visit: [https://app-sandbox.circle.com/signup](https://app-sandbox.circle.com/signup)
- Or go to: [https://app-sandbox.circle.com/](https://app-sandbox.circle.com/)

### 2. Get Your API Key

1. Log in to the [Circle Developer Console](https://console.circle.com)
2. Navigate to API Keys section
3. Generate a new API key for sandbox environment
4. Copy the API key (you'll only see it once!)

### 3. Configure the App

Create a `.env` file in the project root:

```env
CIRCLE_API_KEY=your_api_key_here
CIRCLE_ENV=sandbox
```

### 4. Install and Run

```bash
npm install
npm run dev all
```

## API Authentication

Circle Mint APIs use Bearer token authentication:

```text
Authorization: Bearer YOUR_API_KEY
```

The app automatically includes this header in all requests.

## Important Security Requirements

As specified in the [Circle Mint Getting Started Guide](https://developers.circle.com/circle-mint/getting-started-with-the-circle-apis):

✅ **DO:**
- Store API keys in environment variables
- Use HTTPS for all API requests (enforced by the app)
- Keep API keys secure and private
- Use sandbox environment for testing

❌ **DON'T:**
- Commit API keys to version control
- Expose API keys in client-side code
- Share API keys publicly
- Use production keys in development

## API Endpoints

### Base URLs

- **Sandbox:** `https://api-sandbox.circle.com`
- **Production:** `https://api.circle.com`

### Available Endpoints

The app supports the following Circle Mint API endpoints:

#### Crypto Deposits API (formerly Payments API)
- `GET /v1/deposits/addresses` - List deposit addresses
- `POST /v1/deposits/addresses` - Create deposit address
- `GET /v1/deposits` - List deposits
- `GET /v1/deposits/{id}` - Get deposit details

#### Crypto Payouts API (formerly Payouts API)
- `GET /v1/payouts` - List payouts
- `POST /v1/payouts` - Create payout
- `GET /v1/payouts/{id}` - Get payout details

#### Account & Balance
- `GET /v1/balances` - Get account balance
- `GET /v1/businessAccount/balances` - Get business account balance

**Note:** The Accounts API (`/v1/accounts`) was deprecated in December 2024. The app uses business account endpoints instead.

## Testing Commands

```bash
# Run all tests
npm run dev all

# Get account balance
npm run dev balance

# List deposit addresses
npm run dev deposits

# Create deposit address
npm run dev deposits create ETH

# List deposits
npm run dev deposits list

# List payouts
npm run dev payouts

# Create payout
npm run dev payouts create <address> <chain> <amount> [currency]
```

## Troubleshooting

### "CIRCLE_API_KEY is not set"
- Make sure you've created a `.env` file
- Verify the API key is correct
- Check that the `.env` file is in the project root

### "API requests without authentication will fail"
- Verify your API key is valid
- Check that you're using the correct environment (sandbox vs production)
- Ensure the API key hasn't expired

### "All API requests must be made over HTTPS"
- The app enforces HTTPS automatically
- If you see this error, check your network configuration

## Next Steps

- Read the full [Circle Mint Documentation](https://developers.circle.com/circle-mint/introducing-circle-mint)
- Explore the [API Reference](https://developers.circle.com/api-reference/circle-mint)
- Check out [Circle SDKs](https://developers.circle.com/circle-mint/circle-sdks) for more advanced integrations

## Resources

- [Circle Mint Getting Started](https://developers.circle.com/circle-mint/getting-started-with-the-circle-apis)
- [Circle Developer Console](https://console.circle.com)
- [Circle Sandbox](https://app-sandbox.circle.com/)
- [Circle Mint API Reference](https://developers.circle.com/api-reference/circle-mint)
