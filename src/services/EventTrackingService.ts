/**
 * @file services/EventTrackingService.ts
 * @description Event tracking service for Auction contract events
 * 
 * This service listens to blockchain events emitted by the Auction contract and
 * maintains in-memory counters of deposits, bids, and round resolutions.
 */

import { parseAbi, PublicClient } from 'viem';
import { AUCTION_CONTRACT_ADDRESS } from '../config/constants';
import { getPublicClient } from './BlockchainService';

/**
 * Auction contract ABI (events and functions we use)
 */
const AUCTION_ABI = parseAbi([
  'event CollateralDeposited(address indexed user, uint256 amount, uint256 totalCollateral)',
  'event CollateralWithdrawn(address indexed user, uint256 amount, uint256 totalCollateral)',
  'event BidPlaced(address indexed bidder, uint256 amount, uint256 forRound)',
  'event RoundResolved(uint256 indexed round, address indexed winner, uint256 pricePaid, uint256 winningBid)',
  'event LeadershipExpired(address indexed previousLeader, uint256 round)',
  'function resolveRound() external',
  'function currentRoundStart() external view returns (uint256)',
]);

/**
 * In-memory event counters
 */
let totalDeposits = 0n;
let totalWithdrawals = 0n;
let totalBids = 0n;
let roundsResolved = 0;

/**
 * Flag to prevent multiple event watchers
 */
let eventWatchStarted = false;

/**
 * Start listening to Auction contract events
 */
export async function startEventListening(): Promise<void> {
  const publicClient = getPublicClient();

  if (!publicClient || !AUCTION_CONTRACT_ADDRESS || eventWatchStarted) {
    if (!publicClient) {
      console.warn('⚠️  Cannot start event listening: blockchain client not initialized');
    }
    if (!AUCTION_CONTRACT_ADDRESS) {
      console.warn('⚠️  Cannot start event listening: contract address not set');
    }
    return;
  }

  try {
    console.log(`🔍 Starting event listening for Auction contract: ${AUCTION_CONTRACT_ADDRESS}`);

    // Watch for CollateralDeposited events
    publicClient.watchContractEvent({
      address: AUCTION_CONTRACT_ADDRESS,
      abi: AUCTION_ABI,
      eventName: 'CollateralDeposited',
      onLogs: (logs) => {
        for (const log of logs) {
          const amount = log.args.amount as bigint;
          totalDeposits += amount;
          console.log(`📥 Deposit event: ${amount} wei from ${log.args.user}`);
        }
      },
    });

    // Watch for CollateralWithdrawn events
    publicClient.watchContractEvent({
      address: AUCTION_CONTRACT_ADDRESS,
      abi: AUCTION_ABI,
      eventName: 'CollateralWithdrawn',
      onLogs: (logs) => {
        for (const log of logs) {
          const amount = log.args.amount as bigint;
          totalWithdrawals += amount;
          console.log(`📤 Withdrawal event: ${amount} wei from ${log.args.user}`);
        }
      },
    });

    // Watch for BidPlaced events
    publicClient.watchContractEvent({
      address: AUCTION_CONTRACT_ADDRESS,
      abi: AUCTION_ABI,
      eventName: 'BidPlaced',
      onLogs: (logs) => {
        for (const log of logs) {
          const amount = log.args.amount as bigint;
          totalBids += amount;
          console.log(`🎯 Bid event: ${amount} wei from ${log.args.bidder} for round ${log.args.forRound}`);
        }
      },
    });

    // Watch for RoundResolved events
    publicClient.watchContractEvent({
      address: AUCTION_CONTRACT_ADDRESS,
      abi: AUCTION_ABI,
      eventName: 'RoundResolved',
      onLogs: (logs) => {
        for (const log of logs) {
          roundsResolved += 1;
          console.log(`🏆 Round ${log.args.round} resolved: winner=${log.args.winner}, paid=${log.args.pricePaid}`);
        }
      },
    });

    eventWatchStarted = true;
    console.log('✅ Auction event listening started');
  } catch (error) {
    console.error('❌ Failed to start event listening:', error);
    throw error;
  }
}

/**
 * Get total deposits since server started
 */
export function getTotalDeposits() {
  return {
    totalDeposits: totalDeposits.toString(),
    totalDepositsEth: (Number(totalDeposits) / 1e18).toFixed(18),
  };
}

/**
 * Get total withdrawals since server started
 */
export function getTotalWithdrawals() {
  return {
    totalWithdrawals: totalWithdrawals.toString(),
    totalWithdrawalsEth: (Number(totalWithdrawals) / 1e18).toFixed(18),
  };
}

/**
 * Get total bids since server started
 */
export function getTotalBids() {
  return {
    totalBids: totalBids.toString(),
    totalBidsEth: (Number(totalBids) / 1e18).toFixed(18),
  };
}

/**
 * Get rounds resolved count
 */
export function getRoundsResolved() {
  return { roundsResolved };
}

/**
 * Export ABI for use in other services
 */
export { AUCTION_ABI };
