# Getting Test Funds for Circle Mint

This guide explains how to get test funds for your Circle Mint sandbox account.

## Overview

Circle Mint is for institutional customers to mint and redeem USDC/EURC. Test funds in the sandbox can come from several sources:

## Method 1: Circle Public Faucet (Testnet USDC)

The [Circle Public Faucet](https://faucet.circle.com) provides testnet USDC for development and testing.

### Steps:

1. **Visit the faucet:**
   - Go to: [https://faucet.circle.com](https://faucet.circle.com)

2. **Request testnet USDC:**
   - Enter your wallet address
   - Select the blockchain (Ethereum, Polygon, Base, etc.)
   - Request testnet USDC
   - **Note:** Can be used once per hour

3. **Deposit to Circle Mint:**
   - Once you have testnet USDC in your wallet, you can deposit it to your Circle Mint account
   - Use the deposit address you create via the API

### Supported Blockchains:
- Ethereum (Goerli/Sepolia)
- Polygon (Amoy)
- Base (Base Sepolia)
- Arbitrum (Arbitrum Sepolia)
- Avalanche (Fuji)
- And more...

**Reference:** [Circle Developer Console Faucet](https://developers.circle.com/w3s/developer-console-faucet)

## Method 2: Circle Developer Console Faucet

If you're using Circle Developer Services (Wallets, Contracts, etc.), you can use the Console Faucet:

1. **Access Console Faucet:**
   - Log in to [Circle Developer Console](https://console.circle.com)
   - Navigate to the Faucet section
   - Request testnet USDC directly to your wallets

**Reference:** [Console Faucet Documentation](https://developers.circle.com/w3s/developer-console-faucet)

## Method 3: Sandbox Bank Account Deposits

For Circle Mint specifically, you can simulate bank deposits in the sandbox:

1. **Set up a sandbox bank account:**
   - Log in to [Circle Developer Console](https://console.circle.com)
   - Navigate to your Circle Mint account
   - Add a test bank account (sandbox mode)

2. **Simulate deposits:**
   - In sandbox, you can simulate bank deposits
   - These will convert to USDC in your Circle Mint account
   - Check your balance using: `npm run account balance`

## Method 4: Testnet Faucets by Chain

For native tokens (ETH, MATIC, etc.) needed for gas fees:

### Ethereum Testnets:
- **Goerli/Sepolia:** [Alchemy Faucet](https://www.alchemy.com/best/crypto-faucets)
- **Sepolia:** [Sepolia Faucet](https://sepoliafaucet.com/)

### Polygon:
- **Amoy Testnet:** [Polygon Faucet](https://faucet.polygon.technology/)

### Base:
- **Base Sepolia:** [Base Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)

### Other Chains:
- Check [Alchemy's Crypto Faucet Directory](https://www.alchemy.com/best/crypto-faucets) for more options

## Using Test Funds in Your App

Once you have test funds:

### 1. Check Your Balance:
```bash
npm run account balance
```

### 2. Create a Deposit Address (to receive funds):
```bash
npm run account deposit-address ETH
```

### 3. Send testnet USDC to your deposit address:
- Use the address from step 2
- Send testnet USDC from your wallet (funded via faucet)
- Wait for confirmation

### 4. Verify the deposit:
```bash
npm run dev deposits list
```

### 5. Create a test transfer:
```bash
# Crypto payout (send USDC to blockchain address)
npm run account transfer <address> ETH 1000000 USDC

# Business payout (convert USDC to fiat)
npm run account business-payout wire <bank-id> 100.00 USD
```

## Important Notes

### Amount Formats:
- **Crypto transfers:** Use smallest units (1000000 = 1 USDC)
- **Business payouts:** Use fiat format ("100.00")

### Sandbox vs Production:
- **Sandbox:** Use testnet tokens and simulated bank accounts
- **Production:** Requires real funds and verified bank accounts

### Rate Limits:
- Circle Public Faucet: Once per hour per address
- Console Faucet: Check console for limits

## Troubleshooting

### "Insufficient funds" error:
- Verify you have funds in your Circle Mint account: `npm run account balance`
- Check that deposits have been confirmed
- Ensure you're using the correct amount format

### "Deposit not showing":
- Deposits may take time to confirm on the blockchain
- Check deposit status: `npm run dev deposits list`
- Verify the deposit address is correct

### "Faucet not working":
- Wait for the cooldown period (1 hour for public faucet)
- Try a different testnet
- Check if the faucet is temporarily unavailable

## Resources

- [Circle Public Faucet](https://faucet.circle.com)
- [Circle Developer Console](https://console.circle.com)
- [Circle Developer Console Faucet Docs](https://developers.circle.com/w3s/developer-console-faucet)
- [Alchemy Faucet Directory](https://www.alchemy.com/best/crypto-faucets)
- [Circle Mint Documentation](https://developers.circle.com/circle-mint/introducing-circle-mint)

## Quick Start Example

```bash
# 1. Check current balance
npm run account balance

# 2. Create deposit address for Ethereum
npm run account deposit-address ETH

# 3. Get testnet USDC from faucet.circle.com
#    Send to the deposit address from step 2

# 4. Wait for confirmation, then check balance again
npm run account balance

# 5. Once funded, create a test transfer
npm run account transfer 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb ETH 1000000 USDC
```
