/**
 * @file routes/index.ts
 * @description Route handlers for the Escrow TEE Server API
 * 
 * This file defines all HTTP endpoints for the server. Each route is documented
 * with its purpose, expected inputs, and return values.
 * 
 * Why routes are organized here:
 * - Separates HTTP concerns from business logic
 * - Makes it easy to see all available endpoints in one place
 * - Allows for easy testing of routes independently
 * - Follows RESTful API design principles
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { authenticateUser } from '../middleware/auth';
import { getTeePublicKey } from '../services/TeeService';
import { getTotalDeposits, getTotalWithdrawals, getTotalTransfers } from '../services/EventTrackingService';
import { transferEscrowBalance } from '../services/TransferService';
import { ESCROW_CONTRACT_ADDRESS } from '../config/constants';

const router = Router();

/**
 * GET /settler
 * 
 * Purpose: Returns the TEE's public Ethereum address
 * 
 * Why this exists:
 * - Frontend needs to know the TEE's public address to set it as the settler
 * - The settler address is derived from the MNEMONIC environment variable
 * - This endpoint allows the frontend to discover the TEE address dynamically
 * 
 * Usage in deployment flow:
 * 1. TEE boots and this endpoint returns its public address
 * 2. Frontend calls this to get the TEE address
 * 3. Contract owner uses this address to call updateSettler() on the Escrow contract
 * 
 * Returns:
 *   {
 *     "publicKey": "0x..."  // TEE's Ethereum address
 *   }
 * 
 * Errors:
 *   - 503: TEE account not initialized (MNEMONIC not set)
 */
router.get('/settler', (req, res: Response) => {
  const teePublicKey = getTeePublicKey();
  
  if (!teePublicKey) {
    return res.status(503).json({
      error: 'TEE account not initialized. MNEMONIC environment variable not set.',
    });
  }

  res.json({
    publicKey: teePublicKey,
  });
});

/**
 * GET /escrowAddress
 * 
 * Purpose: Returns the Escrow contract address configured for this TEE server
 * 
 * Why this exists:
 * - Frontend needs to know which Escrow contract this TEE server is managing
 * - Allows frontends to interact with the correct contract address
 * - Useful for displaying contract information and building transaction links
 * - Helps verify that the frontend is connected to the correct TEE server
 * 
 * Returns:
 *   {
 *     "address": "0x..."  // Escrow contract address, or null if not configured
 *   }
 * 
 * Note: Returns null if ESCROW_CONTRACT_ADDRESS is not set in environment variables.
 * This is not an error - the server may be running before contract deployment.
 */
router.get('/escrowAddress', (req, res: Response) => {
  res.json({
    address: ESCROW_CONTRACT_ADDRESS,
  });
});

/**
 * GET /hello
 * 
 * Purpose: Test endpoint to verify Privy authentication is working
 * 
 * Why this exists:
 * - Provides a simple way to test Privy integration
 * - Demonstrates how to use authenticated routes
 * - Returns user's email as proof of successful authentication
 * 
 * Authentication: Required (Privy Bearer token)
 * 
 * Headers:
 *   Authorization: Bearer <privy_jwt_token>
 * 
 * Returns:
 *   {
 *     "message": "Privy Authenticated!",
 *     "email": "user@example.com"  // or null if user has no email
 *   }
 * 
 * Errors:
 *   - 401: Authentication failed (invalid or missing token)
 *   - 503: Privy client not initialized
 */
router.get('/hello', authenticateUser, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: 'Privy Authenticated!',
    email: req.user?.email,
  });
});

/**
 * GET /deposits
 * 
 * Purpose: Returns total ETH deposited to the escrow contract since server started
 * 
 * Why this exists:
 * - Provides real-time statistics about deposit activity
 * - Helps monitor contract usage and user activity
 * - Useful for dashboards and analytics
 * 
 * How it works:
 * - Server listens to Deposit events from the Escrow contract
 * - Each event's amount is added to an in-memory counter
 * - This endpoint returns the current total
 * 
 * Note: Counters reset when server restarts (in-memory only)
 * 
 * Returns:
 *   {
 *     "totalDeposits": "1000000000000000000",  // in wei (BigInt as string)
 *     "totalDepositsEth": "1.000000000000000000"  // in ETH
 *   }
 */
router.get('/deposits', (req, res: Response) => {
  res.json(getTotalDeposits());
});

/**
 * GET /withdrawals
 * 
 * Purpose: Returns total ETH withdrawn from the escrow contract since server started
 * 
 * Why this exists:
 * - Tracks withdrawal activity to monitor user behavior
 * - Helps understand contract usage patterns
 * - Useful for financial reporting and analytics
 * 
 * How it works:
 * - Server listens to Withdrawal events from the Escrow contract
 * - Each event's amount is added to an in-memory counter
 * - This endpoint returns the current total
 * 
 * Returns:
 *   {
 *     "totalWithdrawals": "500000000000000000",  // in wei
 *     "totalWithdrawalsEth": "0.500000000000000000"  // in ETH
 *   }
 */
router.get('/withdrawals', (req, res: Response) => {
  res.json(getTotalWithdrawals());
});

/**
 * GET /transfers
 * 
 * Purpose: Returns total ETH transferred between accounts via settler since server started
 * 
 * Why this exists:
 * - Tracks settlement activity (transfers initiated by the TEE)
 * - Monitors the core settlement mechanism of the escrow system
 * - Helps understand settlement volume and patterns
 * 
 * How it works:
 * - Server listens to EscrowTransfer events from the Escrow contract
 * - Only transfers initiated by the settler (TEE) are tracked
 * - Each event's amount is added to an in-memory counter
 * 
 * Returns:
 *   {
 *     "totalTransfers": "2000000000000000000",  // in wei
 *     "totalTransfersEth": "2.000000000000000000"  // in ETH
 *   }
 */
router.get('/transfers', (req, res: Response) => {
  res.json(getTotalTransfers());
});

/**
 * POST /transfer
 * 
 * Purpose: Transfer escrow balance from authenticated user to another address
 * 
 * Why this exists:
 * - This is the core settlement mechanism
 * - Users request transfers, and the TEE (as settler) executes them
 * - Enables game settlements, payouts, and other balance movements
 * 
 * How it works:
 * 1. User authenticates with Privy (via middleware)
 * 2. User sends transfer request (amount, recipient)
 * 3. TEE validates the request
 * 4. TEE signs and submits transaction using its private key
 * 5. Transaction is mined on blockchain
 * 6. Balance is transferred on the Escrow contract
 * 
 * Authentication: Required (Privy Bearer token)
 * 
 * Headers:
 *   Authorization: Bearer <privy_jwt_token>
 *   Content-Type: application/json
 * 
 * Request Body:
 *   {
 *     "amount": "0.5",  // Amount in ETH (will be converted to wei)
 *     "recipient": "0x..."  // Recipient's Ethereum address
 *   }
 * 
 * Returns:
 *   {
 *     "success": true,
 *     "message": "Transfer initiated",
 *     "transactionHash": "0x...",
 *     "from": "0x...",  // Authenticated user's address
 *     "to": "0x...",    // Recipient address
 *     "amount": "500000000000000000",  // Amount in wei
 *     "amountEth": "0.5",  // Amount in ETH
 *     "receipt": {
 *       "blockNumber": "12345678",
 *       "blockHash": "0x...",
 *       "status": "success"
 *     }
 *   }
 * 
 * Errors:
 *   - 400: Invalid request (missing fields, invalid format)
 *   - 401: Authentication failed
 *   - 503: Service not ready (TEE account or blockchain client not initialized)
 *   - 500: Transaction failed
 */
router.post('/transfer', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get authenticated user's address
    // Why: The user is authenticated by middleware, so we can trust req.user exists.
    // The address is normalized to lowercase by the middleware.
    const userAddress = req.user?.address;
    
    if (!userAddress) {
      return res.status(401).json({
        error: 'User address not found',
      });
    }

    // Validate request body
    // Why: We need both amount and recipient to execute a transfer.
    // Validate early to provide clear error messages.
    const { amount, recipient } = req.body;

    if (!amount || !recipient) {
      return res.status(400).json({
        error: 'Missing required fields: amount and recipient',
      });
    }

    // Validate recipient address format
    // Why: Ethereum addresses must be 40 hex characters after '0x'.
    // This validation prevents errors when submitting transactions.
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      return res.status(400).json({
        error: 'Invalid recipient address format',
      });
    }

    // Execute the transfer
    // Why: This service handles all the transaction logic, validation, and submission.
    // It throws errors if something goes wrong, which we catch below.
    const result = await transferEscrowBalance(
      userAddress as `0x${string}`,
      recipient.toLowerCase() as `0x${string}`,
      amount
    );

    // Return success response with transaction details
    // Why: The client needs the transaction hash to track the transaction on the blockchain.
    // The receipt confirms the transaction was mined successfully.
    res.json({
      success: true,
      message: 'Transfer completed',
      transactionHash: result.transactionHash,
      from: userAddress,
      to: recipient.toLowerCase(),
      amount: amount,
      amountWei: result.receipt.status === 'success' ? 'transferred' : 'failed',
      receipt: result.receipt,
    });
  } catch (error) {
    // Handle transfer errors
    // Why: Errors can occur during validation, transaction building, or submission.
    // We catch all errors here and return appropriate HTTP status codes.
    console.error('Transfer error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Determine appropriate status code based on error type
    // Why: Different errors should return different HTTP status codes for proper client handling.
    if (errorMessage.includes('not initialized') || errorMessage.includes('required')) {
      return res.status(503).json({
        error: 'Service not ready',
        details: errorMessage,
      });
    }
    
    if (errorMessage.includes('Invalid') || errorMessage.includes('format')) {
      return res.status(400).json({
        error: 'Invalid request',
        details: errorMessage,
      });
    }

    return res.status(500).json({
      error: 'Transfer failed',
      details: errorMessage,
    });
  }
});

export default router;

