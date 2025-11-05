# Source Code Structure

This directory contains the TypeScript source code for the Escrow TEE Server. The codebase is organized into a clean, professional structure that's easy to understand and maintain.

## Directory Structure

```
src/
├── index.ts                    # Main entry point - server initialization
├── config/
│   └── constants.ts            # Environment variables and configuration
├── types/
│   └── index.ts                # TypeScript type definitions
├── middleware/
│   └── auth.ts                 # Privy authentication middleware
├── services/
│   ├── TeeService.ts           # TEE account management
│   ├── BlockchainService.ts   # Blockchain connection management
│   ├── EventTrackingService.ts # Escrow contract event listening
│   └── TransferService.ts      # Balance transfer execution
└── routes/
    └── index.ts                # HTTP route handlers
```

## Architecture Overview

### Entry Point (`index.ts`)
- Initializes all services
- Sets up Express server
- Configures middleware
- Starts event listening
- Handles graceful shutdown

### Configuration (`config/`)
- Centralizes environment variable access
- Provides default values
- Documents required configuration

### Types (`types/`)
- TypeScript interfaces and types
- Ensures type safety across the codebase
- Extends Express types for authentication

### Middleware (`middleware/`)
- Express middleware functions
- Privy authentication logic
- User identity extraction

### Services (`services/`)
Business logic separated into focused services:

- **TeeService**: Manages the TEE's cryptographic identity
- **BlockchainService**: Handles blockchain connections
- **EventTrackingService**: Listens to and tracks contract events
- **TransferService**: Executes balance transfers

### Routes (`routes/`)
- HTTP endpoint definitions
- Request validation
- Response formatting
- Error handling

Available endpoints:
- `GET /settler` - Returns TEE's public Ethereum address
- `GET /escrowAddress` - Returns Escrow contract address configured for this TEE
- `GET /hello` - Test Privy authentication (requires Bearer token)
- `GET /deposits` - Get total deposits since server started
- `GET /withdrawals` - Get total withdrawals since server started
- `GET /transfers` - Get total transfers since server started
- `POST /transfer` - Transfer escrow balance (requires Bearer token)

## Reading Guide

To understand the codebase, read files in this order:

1. **`config/constants.ts`** - Understand what configuration is needed
2. **`types/index.ts`** - Learn the data structures used
3. **`services/TeeService.ts`** - See how TEE identity is managed
4. **`services/BlockchainService.ts`** - Understand blockchain connections
5. **`middleware/auth.ts`** - Learn how authentication works
6. **`services/EventTrackingService.ts`** - See how events are tracked
7. **`services/TransferService.ts`** - Understand transfer execution
8. **`routes/index.ts`** - See all API endpoints
9. **`index.ts`** - Understand how everything comes together

## Key Concepts

### TEE (Trusted Execution Environment)
The server runs as a TEE, which means:
- It has a cryptographic identity (derived from mnemonic)
- It acts as the "settler" on the Escrow contract
- It signs transactions on behalf of users (for settlements)

### Privy Authentication
- Users authenticate with their crypto wallets
- Privy provides JWT tokens for authenticated requests
- Middleware validates tokens and extracts user info

### Event Listening
- Server listens to blockchain events in real-time
- Tracks deposits, withdrawals, and transfers
- Maintains in-memory counters (resets on restart)

### Balance Transfers
- Users request transfers via authenticated API
- TEE validates and executes transfers
- Transactions are signed with TEE's private key
- Recipients receive escrow balance

## Documentation Style

Each file includes:
- **File header** explaining the file's purpose
- **"Why" comments** explaining design decisions
- **Inline comments** for complex logic
- **Function documentation** with JSDoc-style comments

## Extending the Codebase

To add new features:

1. **New API endpoint**: Add route in `routes/index.ts`
2. **New service**: Create file in `services/` directory
3. **New middleware**: Add to `middleware/` directory
4. **New type**: Add to `types/index.ts`
5. **New config**: Add to `config/constants.ts`

## Testing

The codebase is structured to be easily testable:
- Services are pure functions or classes
- Dependencies are injected
- No global state (except module-level singletons)
- Clear separation of concerns

## Production Considerations

For production use, consider:
- Adding database persistence for event tracking
- Implementing rate limiting
- Adding request logging
- Setting up monitoring/alerting
- Implementing retry logic for transactions
- Adding input sanitization
- Setting up CORS for specific origins

