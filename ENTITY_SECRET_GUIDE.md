# Entity Secret Setup Guide

This guide helps you generate and register an Entity Secret for Circle Developer-Controlled Wallets.

**Reference:** [Circle Wallets Entity Secret Documentation](https://developers.circle.com/wallets/dev-controlled/register-entity-secret)

## What is an Entity Secret?

An Entity Secret is a 32-byte private key that secures your developer-controlled wallets. Circle never stores it, so you are responsible for keeping it safe.

## Prerequisites

1. **Install the Circle Wallets SDK:**
   ```bash
   npm install @circle-fin/developer-controlled-wallets
   ```

2. **Set your API key in `.env`:**
   ```env
   CIRCLE_API_KEY=your_api_key_here
   CIRCLE_ENV=sandbox
   ```

## Quick Start

### Option 1: Generate and Register (Recommended)

Generate a new Entity Secret and register it in one step:

```bash
npm run entity-secret generate-and-register
```

This will:
1. Generate a new 32-byte Entity Secret
2. Register it with Circle
3. Save the recovery file to `recovery/entity-secret-recovery.json`

### Option 2: Generate Only

Generate an Entity Secret without registering:

```bash
npm run entity-secret generate
```

### Option 3: Register Existing Secret

Register an Entity Secret you already have:

```bash
npm run entity-secret register <your-entity-secret>
```

## Commands

### Generate Entity Secret
```bash
npm run entity-secret generate
```
- Creates a new 32-byte Entity Secret
- Displays it in the terminal
- **Important:** Save it securely!

### Register Entity Secret
```bash
npm run entity-secret register <entity-secret> [recovery-file-path]
```
- Registers an existing Entity Secret with Circle
- Optionally saves recovery file to specified path

### Generate and Register
```bash
npm run entity-secret generate-and-register [recovery-file-path]
```
- Generates and registers in one step
- Default recovery file: `recovery/entity-secret-recovery.json`

## Security Best Practices

### ⚠️ CRITICAL: Secure Your Entity Secret

1. **Store Securely:**
   - Use a password manager
   - Never commit to version control
   - Don't share it publicly

2. **Save Recovery File:**
   - Store in a safe, separate location
   - This is the ONLY way to reset if lost
   - Circle cannot recover it for you

3. **Add to .env:**
   ```env
   ENTITY_SECRET=your_entity_secret_here
   ```
   - Keep `.env` in `.gitignore`
   - Never commit `.env` files

## What Happens After Registration?

Once registered, you can:

1. **Create Developer-Controlled Wallets**
   - Use the Circle Wallets APIs
   - Create wallets programmatically
   - Manage user funds

2. **Make API Calls**
   - Each request requires a new ciphertext
   - The SDK automatically handles encryption
   - Never reuse ciphertexts

3. **Use Wallet Features**
   - Transfer tokens
   - Deploy contracts
   - Interact with blockchains

## Troubleshooting

### "CIRCLE_API_KEY is not set"
- Add your API key to `.env` file
- Get API key from [Circle Developer Console](https://console.circle.com)

### "401 Unauthorized"
- Check that your API key is correct
- Verify API key has Developer Services permissions
- Ensure you're using the right environment (sandbox vs production)

### "Entity Secret already registered"
- You can only register one Entity Secret per account
- If you need a new one, you must reset using the recovery file

### "Invalid Entity Secret"
- Entity Secret must be exactly 64 hex characters (32 bytes)
- Ensure no extra spaces or characters

## Next Steps

After registering your Entity Secret:

1. **Create Your First Wallet:**
   - See Circle Wallets documentation
   - Use the Developer-Controlled Wallets APIs

2. **Transfer Tokens:**
   - Send USDC/EURC between wallets
   - Interact with smart contracts

3. **Build Your App:**
   - Integrate wallet functionality
   - Create user experiences

## Resources

- [Circle Wallets Documentation](https://developers.circle.com/wallets/dev-controlled)
- [Register Entity Secret Guide](https://developers.circle.com/wallets/dev-controlled/register-entity-secret)
- [Entity Secret Management](https://developers.circle.com/wallets/dev-controlled/entity-secret-management)
- [Circle Developer Console](https://console.circle.com)

## Example Workflow

```bash
# 1. Install SDK (if not already installed)
npm install @circle-fin/developer-controlled-wallets

# 2. Generate and register Entity Secret
npm run entity-secret generate-and-register

# 3. Save Entity Secret to .env
# Add to .env file:
# ENTITY_SECRET=<generated-secret>

# 4. Verify recovery file was saved
ls recovery/

# 5. You're ready to use Circle Wallets APIs!
```

## Important Notes

- **One Entity Secret per account:** You can only register one Entity Secret per Circle account
- **Ciphertext rotation:** Each API request requires a new ciphertext (SDK handles this)
- **No recovery by Circle:** Circle cannot recover your Entity Secret if lost
- **Recovery file is critical:** Save it securely - it's your only backup
