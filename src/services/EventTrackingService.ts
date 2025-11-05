/**
 * @file services/EventTrackingService.ts
 * @description Event tracking service for Escrow contract events
 * 
 * This service listens to blockchain events emitted by the Escrow contract and
 * maintains in-memory counters of deposits, withdrawals, and transfers.
 * 
 * Why this exists:
 * - Separates event listening logic from route handlers
 * - Provides a clean interface for accessing event statistics
 * - Makes it easy to add persistence (database) later if needed
 * - Centralizes the event watching logic in one place
 * 
 * Note: In-memory tracking means data is lost on server restart. This is intentional
 * for a simple example, but in production you'd want to persist to a database.
 */

import { parseAbi, PublicClient } from 'viem';
import { ESCROW_CONTRACT_ADDRESS } from '../config/constants';
import { getPublicClient } from './BlockchainService';

/**
 * Escrow contract ABI (minimal - only events and functions we use)
 * Why: We only include the events and functions we actually need. This keeps the
 * ABI small and makes it clear what contract functionality we're using.
 */
const ESCROW_ABI = parseAbi([
  'event Deposit(address indexed user, uint256 amount, uint256 totalBalance)',
  'event Withdrawal(address indexed user, uint256 amount, uint256 totalBalance)',
  'event EscrowTransfer(address indexed settler, address indexed from, address indexed to, uint256 amount, uint256 fromBalance, uint256 toBalance)',
  'function transferEscrowBalance(address from, address to, uint256 amount) external',
]);

/**
 * In-memory event counters
 * Why: We use BigInt to avoid precision loss when dealing with wei amounts.
 * These counters track totals since the server last started. They reset on restart.
 * 
 * In production, you'd want to:
 * - Store these in a database
 * - Track per-user or per-time-period statistics
 * - Handle server restarts gracefully
 */
let totalDeposits = 0n;
let totalWithdrawals = 0n;
let totalTransfers = 0n;

/**
 * Flag to prevent multiple event watchers
 * Why: Viem's watchContractEvent can be called multiple times. This flag ensures
 * we only start one set of watchers, even if startEventListening is called multiple times.
 */
let eventWatchStarted = false;

/**
 * Start listening to Escrow contract events
 * Why: We need to watch the blockchain for new events in real-time. This function
 * sets up watchers for Deposit, Withdrawal, and EscrowTransfer events.
 * 
 * The watchers run continuously in the background and update our counters whenever
 * new events are emitted. This is more efficient than polling because:
 * - We only get notified of new events
 * - No unnecessary RPC calls
 * - Lower latency
 * 
 * @throws Error if blockchain client or contract address not configured
 */
export async function startEventListening(): Promise<void> {
  const publicClient = getPublicClient();
  
  if (!publicClient || !ESCROW_CONTRACT_ADDRESS || eventWatchStarted) {
    if (!publicClient) {
      console.warn('⚠️  Cannot start event listening: blockchain client not initialized');
    }
    if (!ESCROW_CONTRACT_ADDRESS) {
      console.warn('⚠️  Cannot start event listening: contract address not set');
    }
    return;
  }

  try {
    console.log(`🔍 Starting event listening for contract: ${ESCROW_CONTRACT_ADDRESS}`);
    
    // Watch for Deposit events
    // Why: Users deposit ETH directly to the contract. We track the total amount
    // deposited so we can report statistics to the frontend.
    publicClient.watchContractEvent({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      eventName: 'Deposit',
      onLogs: (logs) => {
        for (const log of logs) {
          const amount = log.args.amount as bigint;
          totalDeposits += amount;
          console.log(`📥 Deposit event: ${amount} wei from ${log.args.user}`);
        }
      },
    });

    // Watch for Withdrawal events
    // Why: Users withdraw their escrow balance. We track this to monitor
    // withdrawal patterns and total volume.
    publicClient.watchContractEvent({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      eventName: 'Withdrawal',
      onLogs: (logs) => {
        for (const log of logs) {
          const amount = log.args.amount as bigint;
          totalWithdrawals += amount;
          console.log(`📤 Withdrawal event: ${amount} wei from ${log.args.user}`);
        }
      },
    });

    // Watch for EscrowTransfer events
    // Why: The settler (TEE) transfers funds between user accounts during settlements.
    // This is the core settlement mechanism, so we track it to monitor settlement activity.
    publicClient.watchContractEvent({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      eventName: 'EscrowTransfer',
      onLogs: (logs) => {
        for (const log of logs) {
          const amount = log.args.amount as bigint;
          totalTransfers += amount;
          console.log(`🔄 Transfer event: ${amount} wei from ${log.args.from} to ${log.args.to}`);
        }
      },
    });

    eventWatchStarted = true;
    console.log('✅ Event listening started');
  } catch (error) {
    console.error('❌ Failed to start event listening:', error);
    throw error;
  }
}

/**
 * Get total deposits since server started
 * Why: The /deposits route needs to return this data. Separating the getter
 * from the route handler makes it easier to test and reuse.
 * 
 * @returns Object with total deposits in wei and ETH
 */
export function getTotalDeposits() {
  return {
    totalDeposits: totalDeposits.toString(),
    totalDepositsEth: (Number(totalDeposits) / 1e18).toFixed(18),
  };
}

/**
 * Get total withdrawals since server started
 * Why: The /withdrawals route needs to return this data.
 * 
 * @returns Object with total withdrawals in wei and ETH
 */
export function getTotalWithdrawals() {
  return {
    totalWithdrawals: totalWithdrawals.toString(),
    totalWithdrawalsEth: (Number(totalWithdrawals) / 1e18).toFixed(18),
  };
}

/**
 * Get total transfers since server started
 * Why: The /transfers route needs to return this data.
 * 
 * @returns Object with total transfers in wei and ETH
 */
export function getTotalTransfers() {
  return {
    totalTransfers: totalTransfers.toString(),
    totalTransfersEth: (Number(totalTransfers) / 1e18).toFixed(18),
  };
}

/**
 * Export ABI for use in route handlers
 * Why: The /transfer route needs the ABI to build transactions.
 * Exporting it here keeps all contract-related code together.
 */
export { ESCROW_ABI };

