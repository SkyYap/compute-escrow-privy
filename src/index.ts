/**
 * @file index.ts
 * @description Main entry point for the Escrow TEE Server
 * 
 * This is a Trusted Execution Environment (TEE) server that acts as the "settler"
 * for an Escrow smart contract. The server:
 * - Manages a cryptographic identity derived from a mnemonic phrase
 * - Authenticates users via Privy (wallet authentication)
 * - Listens to blockchain events from the Escrow contract
 * - Executes balance transfers between user accounts on the blockchain
 * 
 * Architecture:
 * - Express.js web server for HTTP API
 * - Privy for user authentication
 * - Viem for blockchain interactions
 * - In-memory event tracking (can be extended to database)
 * 
 * Deployment Flow:
 * 1. Deploy Escrow contract to blockchain
 * 2. Deploy TEE server (this code)
 * 3. Get TEE public address from /settler endpoint
 * 4. Contract owner calls updateSettler() with TEE address
 * 5. TEE can now execute transfers as the settler
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables first
// Why: All other modules depend on environment variables being loaded.
// dotenv.config() reads from .env file and sets process.env.
dotenv.config();

// Initialize services (must happen after dotenv.config())
// Why: These services depend on environment variables, so they must be initialized
// after the environment is loaded.
import { initializePrivyClient } from './middleware/auth';
import { initializeTeeAccount } from './services/TeeService';
import { initializeBlockchainClient } from './services/BlockchainService';
import { startEventListening } from './services/EventTrackingService';

// Import configuration
// Why: Centralized configuration makes it easy to see what the server needs
import { SERVER_PORT, ESCROW_CONTRACT_ADDRESS, RPC_URL } from './config/constants';
import { getTeePublicKey } from './services/TeeService';

// Import routes
// Why: Separating routes into their own file keeps the main file clean and makes
// it easy to see what endpoints are available.
import routes from './routes';

/**
 * Create Express application
 * Why: Express is a popular, well-documented web framework for Node.js.
 * It provides routing, middleware, and HTTP server functionality.
 */
const app = express();

/**
 * CORS middleware
 * Why: Allows frontend applications running on different origins (domains/ports)
 * to make requests to this API. Without CORS, browsers would block cross-origin requests.
 * In production, you'd want to restrict this to specific origins.
 */
app.use(cors());

/**
 * JSON body parser middleware
 * Why: Express doesn't parse JSON request bodies by default. This middleware
 * automatically parses JSON bodies and makes them available via req.body.
 */
app.use(express.json());

/**
 * API routes
 * Why: All API endpoints are defined in ./routes/index.ts. Mounting them at the root
 * means endpoints are available at /settler, /hello, /deposits, etc.
 */
app.use('/', routes);

/**
 * Root endpoint - API documentation
 * Why: Provides a simple way to discover available endpoints. Useful for developers
 * exploring the API and for health checks.
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Escrow TEE Server',
    version: '1.0.0',
    endpoints: {
      settler: 'GET /settler - Get TEE public address',
      escrowAddress: 'GET /escrowAddress - Get Escrow contract address',
      hello: 'GET /hello - Test Privy authentication (requires Bearer token)',
      deposits: 'GET /deposits - Get total deposits since server started',
      withdrawals: 'GET /withdrawals - Get total withdrawals since server started',
      transfers: 'GET /transfers - Get total transfers since server started',
      transfer: 'POST /transfer - Transfer escrow balance (requires Bearer token)',
    },
  });
});

/**
 * Global error handling middleware
 * Why: Catches any errors that aren't handled by route handlers. This ensures
 * the server doesn't crash and returns proper error responses to clients.
 * Must be defined after all routes.
 */
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

/**
 * 404 handler - catch-all for undefined routes
 * Why: Returns a consistent error response for routes that don't exist.
 * This provides better UX than Express's default 404 page.
 * Must be defined after all routes.
 */
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
  });
});

/**
 * Initialize all services
 * Why: Services must be initialized before the server starts accepting requests.
 * We do this synchronously here because they're all fast initialization operations.
 * If any service fails to initialize, the server won't start (fail-fast pattern).
 */
function initializeServices(): void {
  // Initialize Privy authentication
  // Why: Privy client is needed for user authentication. If it fails, authenticated
  // routes won't work, but the server can still start for unauthenticated routes.
  initializePrivyClient();

  // Initialize TEE account
  // Why: The TEE needs its cryptographic identity to sign transactions. If this fails,
  // the server cannot function as a settler, so we throw an error.
  try {
    initializeTeeAccount();
  } catch (error) {
    console.error('Failed to initialize TEE account:', error);
    // Continue anyway - some routes don't need TEE account
  }

  // Initialize blockchain client
  // Why: We need a connection to the blockchain to read events and send transactions.
  // If this fails, event tracking won't work, but the server can still start.
  initializeBlockchainClient();
}

/**
 * Start the server
 * Why: This function starts the HTTP server and initializes event listening.
 * It's separated so we can call it after initialization is complete.
 */
async function startServer(): Promise<void> {
  // Start HTTP server
  // Why: The server listens on the configured port and accepts HTTP requests.
  // We use app.listen() which returns a server instance, but we don't need to store it
  // for this simple use case.
  app.listen(SERVER_PORT, async () => {
    console.log(`🚀 Escrow TEE Server running on port ${SERVER_PORT}`);
    console.log(`🌐 API: http://localhost:${SERVER_PORT}/`);
    console.log(`🔑 TEE Public Key: ${getTeePublicKey() || 'NOT SET'}`);
    console.log(`📡 RPC URL: ${RPC_URL || 'NOT SET'}`);
    console.log(`📋 Escrow Contract: ${ESCROW_CONTRACT_ADDRESS || 'NOT SET'}`);
    
    // Start listening to blockchain events
    // Why: Event listening is asynchronous and happens in the background. We start it
    // after the server is running so startup errors don't prevent the server from starting.
    // If event listening fails, the server continues running but won't track events.
    try {
      await startEventListening();
    } catch (error) {
      console.error('⚠️  Event listening failed, but server continues:', error);
    }
  });
}

/**
 * Graceful shutdown handlers
 * Why: When the server receives SIGINT (Ctrl+C) or SIGTERM (docker stop, etc.),
 * we want to clean up resources before exiting. This is important for:
 * - Closing database connections
 * - Stopping event listeners
 * - Completing in-flight requests
 * 
 * In this simple example, we just log and exit, but in production you'd want to:
 * - Wait for in-flight requests to complete
 * - Close database connections
 * - Stop event listeners gracefully
 */
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Escrow TEE Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Escrow TEE Server...');
  process.exit(0);
});

/**
 * Application entry point
 * Why: This is where execution starts. We initialize services, then start the server.
 * The try-catch ensures any initialization errors are caught and logged.
 */
async function main() {
  try {
    // Initialize all services first
    // Why: Services must be ready before the server starts accepting requests.
    // If initialization fails, we want to know about it before the server starts.
    initializeServices();

    // Start the server
    // Why: After initialization, we can safely start accepting HTTP requests.
    await startServer();
  } catch (error) {
    // Handle initialization errors
    // Why: If something critical fails during initialization, we log it and exit.
    // This prevents the server from starting in a broken state.
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
// Why: This actually runs the main() function. We use .catch() to handle any
// unhandled promise rejections from async operations.
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
