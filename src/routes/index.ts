/**
 * @file routes/index.ts
 * @description Route handlers for the Auction TEE Server API
 */

import { Router, Response } from 'express';
import { getTeePublicKey } from '../services/TeeService';
import { getTotalDeposits, getTotalWithdrawals, getTotalBids, getRoundsResolved } from '../services/EventTrackingService';
import { resolveRound, canResolveRound } from '../services/RoundResolverService';
import { AUCTION_CONTRACT_ADDRESS } from '../config/constants';

const router = Router();

/**
 * GET /settler
 * Returns the TEE's public Ethereum address
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
 * GET /auctionAddress
 * Returns the Auction contract address configured for this TEE server
 */
router.get('/auctionAddress', (req, res: Response) => {
  res.json({
    address: AUCTION_CONTRACT_ADDRESS,
  });
});

/**
 * GET /hello
 * Simple health check endpoint
 */
router.get('/hello', (req, res: Response) => {
  res.json({
    message: 'Auction TEE Server is running!',
  });
});

/**
 * GET /deposits
 * Returns total ETH deposited as collateral since server started
 */
router.get('/deposits', (req, res: Response) => {
  res.json(getTotalDeposits());
});

/**
 * GET /withdrawals
 * Returns total ETH withdrawn from collateral since server started
 */
router.get('/withdrawals', (req, res: Response) => {
  res.json(getTotalWithdrawals());
});

/**
 * GET /bids
 * Returns total bid volume since server started
 */
router.get('/bids', (req, res: Response) => {
  res.json(getTotalBids());
});

/**
 * GET /rounds
 * Returns number of rounds resolved since server started
 */
router.get('/rounds', (req, res: Response) => {
  res.json(getRoundsResolved());
});

/**
 * GET /canResolve
 * Check if the current round can be resolved
 */
router.get('/canResolve', async (req, res: Response) => {
  try {
    const canResolve = await canResolveRound();
    res.json({ canResolve });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check round status' });
  }
});

/**
 * POST /resolveRound
 * Resolve the current auction round (TEE only)
 * 
 * This endpoint triggers the round resolution:
 * - Crowns the highest bidder as the new leader
 * - Winner pays second-highest bid
 * - Starts the next round
 */
router.post('/resolveRound', async (req, res: Response) => {
  try {
    // Check if round can be resolved
    const canResolve = await canResolveRound();
    if (!canResolve) {
      return res.status(400).json({
        error: 'Round cannot be resolved yet',
        message: 'Current round is still active (60 seconds not elapsed)',
      });
    }

    // Execute the resolve
    const result = await resolveRound();

    res.json({
      success: true,
      message: 'Round resolved',
      transactionHash: result.transactionHash,
      receipt: result.receipt,
    });
  } catch (error) {
    console.error('Resolve round error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not initialized') || errorMessage.includes('required')) {
      return res.status(503).json({
        error: 'Service not ready',
        details: errorMessage,
      });
    }

    return res.status(500).json({
      error: 'Resolve round failed',
      details: errorMessage,
    });
  }
});

export default router;
