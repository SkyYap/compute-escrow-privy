/**
 * @file index.ts
 * @description Main entry point for the Auction TEE Server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { initializePrivyClient } from './middleware/auth';
import { initializeTeeAccount } from './services/TeeService';
import { initializeBlockchainClient } from './services/BlockchainService';
import { startEventListening } from './services/EventTrackingService';

import { SERVER_PORT, AUCTION_CONTRACT_ADDRESS, RPC_URL } from './config/constants';
import { getTeePublicKey } from './services/TeeService';

import routes from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/', routes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Auction TEE Server',
    version: '1.0.0',
    endpoints: {
      settler: 'GET /settler - Get TEE public address',
      auctionAddress: 'GET /auctionAddress - Get Auction contract address',
      hello: 'GET /hello - Test Privy authentication',
      deposits: 'GET /deposits - Get total deposits',
      withdrawals: 'GET /withdrawals - Get total withdrawals',
      bids: 'GET /bids - Get total bids',
      rounds: 'GET /rounds - Get rounds resolved count',
      resolveRound: 'POST /resolveRound - Resolve current auction round',
    },
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
  });
});

function initializeServices(): void {
  initializePrivyClient();

  try {
    initializeTeeAccount();
  } catch (error) {
    console.error('Failed to initialize TEE account:', error);
  }

  initializeBlockchainClient();
}

async function startServer(): Promise<void> {
  app.listen(SERVER_PORT, async () => {
    console.log(`🚀 Auction TEE Server running on port ${SERVER_PORT}`);
    console.log(`🌐 API: http://localhost:${SERVER_PORT}/`);
    console.log(`🔑 TEE Public Key: ${getTeePublicKey() || 'NOT SET'}`);
    console.log(`📡 RPC URL: ${RPC_URL || 'NOT SET'}`);
    console.log(`📋 Auction Contract: ${AUCTION_CONTRACT_ADDRESS || 'NOT SET'}`);

    try {
      await startEventListening();
    } catch (error) {
      console.error('⚠️  Event listening failed, but server continues:', error);
    }
  });
}

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Auction TEE Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Auction TEE Server...');
  process.exit(0);
});

async function main() {
  try {
    initializeServices();
    await startServer();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
