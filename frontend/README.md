# Escrow TEE Frontend

A React + Vite frontend application for interacting with the Escrow TEE server. This application provides a user-friendly interface for viewing escrow statistics and executing balance transfers.

## Features

- **Privy Authentication**: Secure wallet-based authentication
- **Real-time Statistics: View deposits, withdrawals, and transfers
- **Balance Transfers**: Transfer escrow balance to other addresses
- **User Information**: Display authenticated user's email and wallet address

## Prerequisites

- Node.js 18+ and npm
- A running TEE server (see main project README)
- Privy account and app credentials

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your values:

```env
# TEE Server URL (where your backend is running)
VITE_TEE_SERVER_URL=http://localhost:8000

# Privy App ID (from https://dashboard.privy.io)
VITE_PRIVY_APP_ID=your_privy_app_id_here

# Blockchain RPC URL (REQUIRED)
# This must match the network where your Escrow contract is deployed
# Examples:
#   - Base Sepolia: https://sepolia.base.org
#   - Base Sepolia (alternative): https://base-sepolia-rpc.publicnode.com
#   - Ethereum Sepolia: https://ethereum-sepolia-rpc.publicnode.com
VITE_RPC_URL=https://sepolia.base.org

# Optional: Chain ID (defaults to Base Sepolia: 84532)
# VITE_CHAIN_ID=84532
```

### Required Environment Variables

#### `VITE_TEE_SERVER_URL`
- **Description**: The base URL of your TEE server API
- **Examples**:
  - Local development: `http://localhost:8000`
  - Production: `https://your-tee-server.com`
  - Remote server: `http://your-server-ip:8000`
- **Required**: Yes

#### `VITE_PRIVY_APP_ID`
- **Description**: Your Privy application ID
- **How to get**: 
  1. Go to [Privy Dashboard](https://dashboard.privy.io)
  2. Create or select an application
  3. Copy the App ID from the dashboard
- **Required**: Yes

#### `VITE_RPC_URL`
- **Description**: The blockchain RPC endpoint URL
- **Why**: The frontend needs this to query wallet balances, TEE balance, and interact with the blockchain
- **Examples**:
  - Base Sepolia: `https://sepolia.base.org`
  - Base Sepolia (alternative): `https://base-sepolia-rpc.publicnode.com`
  - Ethereum Sepolia: `https://ethereum-sepolia-rpc.publicnode.com`
- **Important**: Must match the network where your Escrow contract is deployed
- **Required**: Yes

#### `VITE_CHAIN_ID` (Optional)
- **Description**: Blockchain chain ID to connect to
- **Default**: `84532` (Base Sepolia testnet)
- **Other common values**:
  - Ethereum Sepolia: `11155111`
  - Base Sepolia: `84532`
- **Required**: No

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Building for Production

Build the production bundle:

```bash
npm run build
```

The built files will be in the `dist/` directory.

Preview the production build:

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── ConnectionStatus.tsx
│   │   ├── StatsDashboard.tsx
│   │   └── TransferForm.tsx
│   ├── config/              # Configuration
│   │   └── constants.ts     # Environment variables
│   ├── services/            # API client
│   │   └── api.ts           # TEE server API calls
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── .env.local.example       # Example environment file
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Usage

### Connecting with Privy

1. Click "Connect Wallet" when prompted
2. Choose your authentication method:
   - **Wallet**: Connect with MetaMask, WalletConnect, or other wallets
   - **Email**: Sign in with email (Privy creates an embedded wallet)

### Viewing Statistics

The dashboard automatically displays:
- **Deposits**: Total ETH deposited to the escrow contract
- **Withdrawals**: Total ETH withdrawn from escrow
- **Transfers**: Total ETH transferred between accounts

Statistics refresh every 5 seconds automatically, or click "Refresh Stats" to update manually.

### Transferring Funds

1. Ensure you're connected with Privy
2. Enter the recipient's Ethereum address
3. Enter the amount in ETH
4. Click "Transfer"
5. Wait for the transaction to be confirmed
6. View the transaction on Etherscan using the provided link

## Troubleshooting

### "Privy client not initialized"
- Check that `VITE_PRIVY_APP_ID` is set in `.env.local`
- Ensure the Privy App ID is correct

### "TEE server connection failed"
- Verify `VITE_TEE_SERVER_URL` is correct
- Ensure the TEE server is running
- Check for CORS issues (server should allow requests from frontend origin)

### "Authentication failed"
- Make sure you're using the correct Privy App ID
- Verify your Privy app is configured correctly in the dashboard
- Check browser console for detailed error messages

## Technologies Used

- **Vite**: Fast build tool and dev server
- **React**: UI framework
- **TypeScript**: Type safety
- **Privy**: Wallet authentication
- **Viem**: Ethereum utilities (for address validation)

## License

MIT

